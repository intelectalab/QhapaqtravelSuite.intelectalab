<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class RegisterFxRate
{
    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function __invoke(array $data, User $actor): void
    {
        $code = $data['currency'];
        $rate = Decimal::of($data['rate'])->toScale(6, RoundingMode::HALF_UP);
        $date = $data['rate_date'] ?? Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
        $previous = DB::table('fin_fx_rates')->where('currency_code', $code)->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date']);

        if ($previous && Decimal::of($previous->rate_pen)->isEqualTo($rate) && $previous->rate_date === $date) {
            throw ApiException::conflict('CFG-BR-06', 'Ese tipo de cambio ya está registrado para la fecha.');
        }

        if (isset($data['buy'], $data['sell']) && Decimal::of($data['buy'])->isGreaterThan(Decimal::of($data['sell']))) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El precio de compra no puede ser mayor que el de venta.');
        }

        $alert = (float) app(ManageCurrencies::class)->settings()['alert_pct'];
        $variation = $previous && Decimal::of($previous->rate_pen)->isPositive() ? abs(((float) (string) $rate - (float) $previous->rate_pen) / (float) $previous->rate_pen * 100) : 0.0;

        if ($variation > $alert && empty($data['confirm_variation'])) {
            throw ApiException::conflict('FX_VARIATION', 'El tipo de cambio varía '.number_format($variation, 2).' % respecto al anterior ('.$previous->rate_pen.'), más que la alerta de '.$alert.' %. Revisa el valor y confírmalo si es correcto.', ['variation_pct' => round($variation, 2), 'alert_pct' => $alert, 'previous' => (string) $previous->rate_pen]);
        }

        DB::table('fin_fx_rates')->insert([
            'currency_code' => $code,
            'base_currency' => 'PEN',
            'rate_pen' => (string) $rate,
            'buy' => $data['buy'] ?? null,
            'sell' => $data['sell'] ?? null,
            'previous_rate' => $previous?->rate_pen,
            'rate_date' => $date,
            'source' => $data['source'],
            'effective_at' => now()->format('Y-m-d H:i:s.uP'),
            'created_by' => $actor->getKey(),
        ]);

        $this->audit->log('Tipo de cambio', $code, 'registrar', $previous ? (string) $previous->rate_pen : null, "{$rate->strippedOfTrailingZeros()} · {$date} · {$data['source']}".($variation > $alert ? ' · variación '.number_format($variation, 2).' % confirmada' : ''));

        if ($variation > $alert) {
            app(StaffNotices::class)->toRoles(['finance', 'manager'], 'tipo_cambio.variacion', "Tipo de cambio {$code} con variación de ".number_format($variation, 2).' %', "Nuevo {$rate->strippedOfTrailingZeros()} · anterior {$previous->rate_pen} · {$date}", 'fin_fx_rate', null, null, [], (string) $actor->getKey());
        }
    }
}
