<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Catalog\Support\ProductQuotePreview;
use App\Domain\Shared\Errors\ApiException;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use stdClass;

final class SiteQuote
{
    private const BASE_KEYS = ['base-adt' => 'adults', 'base-chd' => 'children', 'base-inf' => 'infants'];

    public function __construct(
        private readonly SiteCatalog $catalog,
        private readonly SiteBooking $booking,
    ) {}

    public function catalog(): SiteCatalog
    {
        return $this->catalog;
    }

    public function booking(): SiteBooking
    {
        return $this->booking;
    }

    public function product(string $slug): stdClass
    {
        return $this->catalog->product($slug);
    }

    public function rules(stdClass $product, int $adults, int $children, int $infants): array
    {
        $errors = [];
        $seats = $adults + $children;

        if ($adults < 1) {
            $errors[] = 'Incluye al menos 1 adulto.';
        }

        if ($seats < (int) $product->minimum_passengers) {
            $errors[] = "Este servicio sale desde {$product->minimum_passengers} viajeros.";
        }

        if ($product->kind !== 'traslados' && $seats > (int) $product->maximum_passengers) {
            $errors[] = "El máximo por reserva es {$product->maximum_passengers} viajeros.";
        }

        if ($infants > $adults) {
            $errors[] = 'Cada infante debe viajar con un adulto.';
        }

        if ($children > 0 && (int) $product->minimum_age >= 12) {
            $errors[] = "La edad mínima es {$product->minimum_age} años; no se admiten niños.";
        }

        if ($infants > 0 && (int) $product->minimum_age > 0) {
            $errors[] = "La edad mínima es {$product->minimum_age} años; no se admiten infantes.";
        }

        return $errors;
    }

    public function quote(stdClass $product, string $date, int $adults, int $children, int $infants, ?string $promoCode = null, array $extras = [], bool $strict = false, ?string $mode = null, ?string $method = null): array
    {
        $errors = $this->rules($product, $adults, $children, $infants);
        $availability = $this->catalog->availability();
        $day = $availability->day($product, $date, $adults + $children, $this->catalog->today());

        if (! $availability->sellable($day)) {
            $errors[] = $day['note'] ?? 'La fecha elegida no está disponible: '.mb_strtolower(SiteAvailability::LABELS[$day['status']]).'.';
        }

        if ($errors !== [] || $day['price'] === null) {
            throw ApiException::unprocessable('SIT-BR-05', $errors[0] ?? 'La fecha elegida no tiene tarifa publicada.', ['errors' => ['pax' => $errors]]);
        }

        $price = $day['price'];
        $pax = ['adt' => $adults, 'chd' => $children, 'inf' => $infants];
        $units = SiteBooking::serviceUnits($product, $price['basis'], $pax);
        $perService = $units !== null;
        $promotion = SitePromotions::best($product, $adults + $children, $promoCode, (string) $price['currency']);
        $extra = $this->booking->price($product, $date, $pax, (string) $price['currency'], $extras, $strict, $mode, $method, $promotion, $units);

        $paxErrors = $perService ? array_values(array_filter($extra['pax_errors'], fn (string $error): bool => ! str_contains($error, 'pasajeros por reserva'))) : $extra['pax_errors'];

        if ($paxErrors !== []) {
            throw ApiException::unprocessable('SIT-BR-05', $paxErrors[0], ['errors' => ['pax' => $paxErrors]]);
        }

        $quote = ProductQuotePreview::serialize($extra['quote']);
        $en = $this->catalog->locale()->translated();
        $lines = [
            ...array_map(fn (array $line): array => ['key' => $perService ? 'service' : (self::BASE_KEYS[$line['key']] ?? $line['key']), 'label' => $this->baseLabel($line['key'], (int) $line['qty'], $perService, $en), 'qty' => $line['qty'], 'unit' => $line['unit'], 'amount' => $line['amount'], 'kind' => 'base', 'removable' => false, 'removed' => false], array_values(array_filter(ProductQuotePreview::serialize($extra['plain'])['lines'], fn (array $line): bool => $line['kind'] === 'base' && (int) $line['qty'] > 0))),
            ...$extra['lines'],
        ];
        $extrasTotal = array_reduce($extra['lines'], fn (BigDecimal $sum, array $line): BigDecimal => $line['removed'] ? $sum : $sum->plus($line['amount']), BigDecimal::zero())->toScale(2);
        $promo = collect($quote['adjustments'])->firstWhere('key', 'promo');
        $total = BigDecimal::of($quote['total']);

        return [
            'date' => $date,
            'currency' => $price['currency'],
            'season' => $price['season'],
            'lines' => $lines,
            'subtotal' => $quote['subtotal'],
            'discount' => $promo === null ? null : ['label' => $promo['label'], 'amount' => (string) BigDecimal::of($promo['amount'])->abs(), 'code' => $promotion['code'] ?? null],
            'total' => (string) $total,
            'list_total' => $price['list'] !== null && ! $perService && $children === 0 ? (string) self::money($price['list'])->multipliedBy($adults)->plus($extrasTotal) : null,
            'extras_total' => (string) $extrasTotal,
            'extras' => $extra['selection'],
            'adjustments' => $quote['adjustments'],
            'modes' => $quote['modes'],
            'payment_mode' => $quote['payment_mode'],
            'deposit_pct' => $quote['deposit_pct'],
            'deposit' => $quote['deposit'],
            'balance' => $quote['balance'],
            'balance_due' => $quote['balance_due'],
            'hold_hours' => $quote['hold_hours'],
            'rooms' => $extra['rooms'],
            'nights' => $extra['nights'],
            'warnings' => $extra['warnings'],
            'can_remove' => $extra['can_remove'],
            'ok' => true,
            'spots' => $day['spots'],
            'departure' => $day['departure'],
            'pax' => ['adults' => $adults, 'children' => $children, 'infants' => $infants],
            'rate_id' => $price['rate_id'],
            'legs' => $extra['trip']['legs'] ?? [],
            'trip_end' => $extra['trip']['trip_end'] ?? null,
            'by_category' => $extra['trip']['by_category'] ?? null,
        ];
    }

    public static function money(float|int|string|null $value): BigDecimal
    {
        return BigDecimal::of(is_string($value) ? $value : number_format((float) $value, 2, '.', ''))->toScale(2, RoundingMode::HALF_UP);
    }

    private function baseLabel(string $key, int $qty, bool $perService, bool $en): string
    {
        if ($perService) {
            return $en ? ($qty > 1 ? "Private service × {$qty} vehicles" : 'Private service') : ($qty > 1 ? "Servicio privado × {$qty} vehículos" : 'Servicio privado');
        }

        return match ($key) {
            'base-chd' => $en ? ($qty === 1 ? '1 child' : "{$qty} children") : ($qty === 1 ? '1 niño' : "{$qty} niños"),
            'base-inf' => $en ? ($qty === 1 ? '1 infant' : "{$qty} infants") : ($qty === 1 ? '1 infante' : "{$qty} infantes"),
            default => $en ? ($qty === 1 ? '1 adult' : "{$qty} adults") : ($qty === 1 ? '1 adulto' : "{$qty} adultos"),
        };
    }
}
