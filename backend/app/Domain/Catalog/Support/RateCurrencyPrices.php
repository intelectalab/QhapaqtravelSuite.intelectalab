<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Booking\Support\TenantBookingEngine;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class RateCurrencyPrices
{
    public const MAX = 3;

    public const PAYABLE = ['PEN', 'USD'];

    public function __construct(
        private readonly TenantSettings $settings,
        private readonly TenantBookingEngine $engine,
        private readonly AuditLogger $audit,
    ) {}

    public static function rules(): array
    {
        return [
            'alt_prices' => ['nullable', 'array', 'max:'.self::MAX],
            'alt_prices.*.currency' => ['required', 'string', 'size:3', 'distinct'],
            'alt_prices.*.price' => ['required', 'numeric', 'gt:0', 'max:999999'],
        ];
    }

    public static function messages(): array
    {
        return [
            'alt_prices.max' => 'Agrega hasta '.self::MAX.' precios en otras monedas.',
            'alt_prices.*.currency.*' => 'Elige una moneda de cobro distinta en cada precio.',
            'alt_prices.*.price.*' => 'El precio en otra moneda debe ser mayor que cero.',
        ];
    }

    public function enabled(): bool
    {
        return (bool) ($this->settings->section('currency')['charge_multi_currency'] ?? false);
    }

    public function chargeCurrencies(): array
    {
        $codes = DB::table('fin_currencies')->where('active', true)->where('is_charge', true)->orderByDesc('is_base')->orderBy('code')->pluck('code')
            ->map(fn (mixed $code): string => trim((string) $code))->filter(fn (string $code): bool => in_array($code, self::PAYABLE, true))->values()->all();

        return $codes === [] ? self::PAYABLE : $codes;
    }

    public function forRates(array $rateIds): array
    {
        if ($rateIds === []) {
            return [];
        }

        return DB::table('catalog_rate_prices')->whereIn('rate_id', $rateIds)->orderBy('currency')->get(['rate_id', 'currency', 'price'])
            ->groupBy('rate_id')
            ->map(fn ($rows): array => $rows->map(fn (object $row): array => ['currency' => trim((string) $row->currency), 'price' => Decimal::toApi((string) $row->price)])->values()->all())
            ->all();
    }

    public function priceIn(string $rateId, string $currency): ?string
    {
        $price = DB::table('catalog_rate_prices')->where('rate_id', $rateId)->where('currency', $currency)->value('price');

        return $price === null ? null : (string) $price;
    }

    public function convert(string $amount, string $from, string $to): ?string
    {
        try {
            return (string) $this->engine->fx()->convert(BigDecimal::of($amount), $from, $to)->toScale(2, RoundingMode::HALF_UP);
        } catch (InvalidArgumentException) {
            return null;
        }
    }

    public function sync(object $rate, ?array $prices, User $actor): void
    {
        if ($prices === null) {
            return;
        }

        $currency = trim((string) $rate->currency);
        $wanted = [];
        foreach ($prices as $row) {
            $wanted[strtoupper(trim((string) $row['currency']))] = Decimal::round2((string) $row['price']);
        }

        if ($wanted !== [] && ! $this->enabled()) {
            throw ApiException::unprocessable('CAT-BR-MULTICURRENCY', 'Activa «Cobrar en varias monedas» en Configuración › Moneda e impuestos para agregar precios en otra moneda.');
        }

        $charge = $this->chargeCurrencies();
        foreach ($wanted as $code => $price) {
            if ($code === $currency) {
                throw ApiException::unprocessable('CAT-BR-MULTICURRENCY', "El precio principal ya está en {$code}: elige otra moneda de cobro.");
            }
            if (! in_array($code, $charge, true)) {
                throw ApiException::unprocessable('CAT-BR-MULTICURRENCY', "{$code} no es una moneda de cobro. Actívala como moneda de cobro en Monedas.");
            }
            $this->guardRange($rate, $code, $price);
        }

        $current = DB::table('catalog_rate_prices')->where('rate_id', $rate->id)->get(['id', 'currency', 'price'])->keyBy(fn (object $row): string => trim((string) $row->currency));
        $before = $current->map(fn (object $row, string $code): string => $code.' '.Decimal::toApi((string) $row->price))->values()->implode(', ');

        foreach ($current as $code => $row) {
            if (! isset($wanted[$code])) {
                DB::table('catalog_rate_prices')->where('id', $row->id)->delete();
            }
        }

        foreach ($wanted as $code => $price) {
            $existing = $current[$code] ?? null;
            if ($existing === null) {
                DB::table('catalog_rate_prices')->insert(['rate_id' => $rate->id, 'currency' => $code, 'price' => (string) $price, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            } elseif (! BigDecimal::of((string) $existing->price)->isEqualTo($price)) {
                DB::table('catalog_rate_prices')->where('id', $existing->id)->update(['price' => (string) $price, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }
        }

        $after = collect($wanted)->map(fn (BigDecimal $price, string $code): string => $code.' '.Decimal::toApi((string) $price))->values()->implode(', ');
        if ($before !== $after) {
            $this->audit->log('Tarifa', (string) $rate->ref, 'precios_por_moneda', $before !== '' ? $before : 'sin precios en otra moneda', $after !== '' ? $after : 'sin precios en otra moneda');
        }
    }

    private function guardRange(object $rate, string $code, BigDecimal $price): void
    {
        $from = trim((string) $rate->currency);
        foreach (['min_price' => 'menor que el precio mínimo', 'max_price' => 'mayor que el precio máximo'] as $field => $text) {
            if ($rate->{$field} === null) {
                continue;
            }
            $limit = $this->convert((string) $rate->{$field}, $from, $code);
            if ($limit === null) {
                throw ApiException::unprocessable('CAT-BR-MULTICURRENCY', "No hay tipo de cambio para {$code}: regístralo en Monedas antes de agregar este precio.");
            }
            $outside = $field === 'min_price' ? $price->isLessThan($limit) : $price->isGreaterThan($limit);
            if ($outside) {
                throw ApiException::unprocessable('CAT-BR-13', "El precio en {$code} no puede ser {$text} ({$code} {$limit} al tipo de cambio del día).");
            }
        }
    }
}
