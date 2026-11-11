<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Booking\Data\BookingQuote;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\QuoteLine;
use App\Domain\Booking\Data\QuoteSelection;
use App\Domain\Booking\Support\TenantBookingEngine;
use Brick\Money\Money;
use Carbon\CarbonImmutable;
use DomainException;

final class ProductQuotePreview
{
    public function __construct(
        private readonly TenantBookingEngine $engine,
        private readonly ProductBookingConfig $config,
    ) {}

    public function quote(string $productId, array $selection): array
    {
        $date = (string) ($selection['date'] ?? CarbonImmutable::parse(CatalogAccess::today())->addDays(30)->toDateString());
        $product = $this->config->engineProduct($productId, $date);
        $currency = (string) ($selection['currency'] ?? $this->rateCurrency($product));

        return self::serialize($this->run($product, [...$selection, 'date' => $date, 'currency' => $currency]));
    }

    public function simulate(string $productId, array $pax, array $ages): array
    {
        $product = $this->config->engineProduct($productId);
        $engine = $this->engine->engine();
        $validation = $engine->validatePax($product, $pax);
        $quote = $this->run($product, ['date' => CatalogAccess::today(), 'pax' => $pax, 'currency' => $this->rateCurrency($product)]);

        return [
            'ok' => $validation->ok,
            'errors' => $validation->errors,
            'seats' => $validation->seats,
            'ages' => array_map(fn (int $age): array => ['age' => $age, 'type' => $engine->ageType($product, $age)], $ages),
            'lines' => array_values(array_map(fn (QuoteLine $line): array => self::line($line), array_filter($quote->lines, fn (QuoteLine $line): bool => $line->kind === 'base'))),
            'subtotal' => self::money($quote->subtotal),
            'currency' => $quote->currency,
            'warnings' => array_values(array_diff($quote->warnings, $validation->errors)),
        ];
    }

    public function lodgingExample(string $productId, array $legs): ?array
    {
        $lodging = [];
        foreach ($legs as $leg) {
            $best = null;
            foreach ($leg['hotels'] as $hotel) {
                foreach ($hotel['room_types'] as $room) {
                    if ($room['capacity'] >= 2 && ($best === null || (float) $room['price_per_night'] < (float) $best['price'])) {
                        $best = ['leg_id' => $leg['code'], 'hotel_id' => $hotel['code'], 'type' => $room['room_type'], 'price' => $room['price_per_night']];
                    }
                }
            }
            if ($best !== null) {
                $lodging[] = ['leg_id' => $best['leg_id'], 'hotel_id' => $best['hotel_id'], 'rooms' => [['type' => $best['type'], 'qty' => 1]]];
            }
        }

        if ($lodging === []) {
            return null;
        }

        $product = $this->config->engineProduct($productId);
        $currency = (string) ($product->accommodation['currency'] ?? 'PEN');
        $quote = $this->run($product, ['date' => CarbonImmutable::parse(CatalogAccess::today())->addDays(30)->toDateString(), 'pax' => ['adt' => 2], 'lodging' => $lodging, 'currency' => $currency]);
        $lines = array_values(array_filter($quote->lines, fn (QuoteLine $line): bool => $line->kind === 'lodging'));
        $total = array_reduce($lines, fn (?Money $sum, QuoteLine $line): Money => $sum === null ? $line->amount : $sum->plus($line->amount));

        return [
            'pax' => 2,
            'rooms' => $quote->rooms,
            'nights' => $quote->nights,
            'currency' => $quote->currency,
            'total' => $total === null ? '0.00' : self::money($total),
            'lines' => array_map(fn (QuoteLine $line): array => self::line($line), $lines),
            'warnings' => $quote->warnings,
        ];
    }

    public function paymentExamples(string $productId, array $modes): array
    {
        $date = CarbonImmutable::parse(CatalogAccess::today())->addDays(60)->toDateString();
        $product = $this->config->engineProduct($productId, $date);
        $currency = $this->rateCurrency($product);

        return array_map(function (string $mode) use ($product, $date, $currency): array {
            $quote = $this->run($product, ['date' => $date, 'pax' => ['adt' => 2], 'currency' => $currency, 'payment_mode' => $mode]);

            return [
                'mode' => $quote->paymentMode,
                'date' => $date,
                'total' => self::money($quote->total),
                'deposit_pct' => $quote->depositPct,
                'deposit' => self::money($quote->deposit),
                'balance' => self::money($quote->balance),
                'balance_due' => $quote->balanceDue?->toDateString(),
                'hold_hours' => $quote->holdHours,
                'currency' => $quote->currency,
            ];
        }, $modes);
    }

    public static function serialize(BookingQuote $quote): array
    {
        return [
            'currency' => $quote->currency,
            'lines' => array_map(fn (QuoteLine $line): array => self::line($line), $quote->lines),
            'adjustments' => array_map(fn (array $adjustment): array => ['key' => $adjustment['key'], 'label' => $adjustment['label'], 'amount' => self::money($adjustment['amount'])], $quote->adjustments),
            'subtotal' => self::money($quote->subtotal),
            'total' => self::money($quote->total),
            'payment_mode' => $quote->paymentMode,
            'modes' => $quote->modes,
            'deposit_pct' => $quote->depositPct,
            'deposit' => self::money($quote->deposit),
            'balance' => self::money($quote->balance),
            'balance_due' => $quote->balanceDue?->toDateString(),
            'hold_hours' => $quote->holdHours,
            'rooms' => $quote->rooms,
            'nights' => $quote->nights,
            'warnings' => $quote->warnings,
            'ok' => $quote->ok,
        ];
    }

    private function run(ProductData $product, array $selection): BookingQuote
    {
        $engine = $this->engine->engine();

        try {
            return $engine->quote($product, QuoteSelection::fromArray($selection));
        } catch (DomainException) {
            return $engine->quote($product, QuoteSelection::fromArray([...$selection, 'currency' => 'PEN']));
        }
    }

    private function rateCurrency(ProductData $product): string
    {
        foreach ($product->rates as $rate) {
            if (in_array($rate['segment'] ?? null, ['Adulto', 'Pasajero'], true)) {
                return (string) $rate['currency'];
            }
        }

        return 'PEN';
    }

    private static function line(QuoteLine $line): array
    {
        return [
            'key' => $line->key,
            'kind' => $line->kind,
            'label' => $line->label,
            'qty' => $line->qty,
            'unit' => self::money($line->unit),
            'amount' => self::money($line->amount),
            'removable' => $line->removable,
            'removed' => $line->removed,
            'meta' => $line->meta,
        ];
    }

    private static function money(Money $money): string
    {
        return (string) $money->getAmount();
    }
}
