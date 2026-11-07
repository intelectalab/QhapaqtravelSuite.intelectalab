<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use stdClass;

final class SiteQuote
{
    private const PERCENT_KINDS = ['Descuento %', 'Descuento por cantidad', 'Código promocional', 'Promoción por temporada', 'Promoción por canal', 'Promoción por fecha'];

    public function __construct(private readonly SiteCatalog $catalog) {}

    public function catalog(): SiteCatalog
    {
        return $this->catalog;
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

    public function quote(stdClass $product, string $date, int $adults, int $children, int $infants, ?string $promoCode = null): array
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
        $adultUnit = self::money($price['adult']);
        $childUnit = self::money($price['child']);
        $perService = in_array($price['basis'], ['Precio fijo', 'Por grupo', 'Por unidad'], true) || $product->kind === 'traslados';
        $units = $perService ? (int) ceil(($adults + $children + $infants) / max(1, (int) $product->maximum_passengers)) : 0;
        $en = $this->catalog->locale()->translated();
        $lines = $perService
            ? [['key' => 'service', 'label' => $en ? ($units > 1 ? "Private service × {$units} vehicles" : 'Private service') : ($units > 1 ? "Servicio privado × {$units} vehículos" : 'Servicio privado'), 'qty' => $units, 'unit' => (string) $adultUnit, 'amount' => (string) $adultUnit->multipliedBy($units)]]
            : array_values(array_filter([
                ['key' => 'adults', 'label' => $en ? ($adults === 1 ? '1 adult' : "{$adults} adults") : ($adults === 1 ? '1 adulto' : "{$adults} adultos"), 'qty' => $adults, 'unit' => (string) $adultUnit, 'amount' => (string) $adultUnit->multipliedBy($adults)],
                $children > 0 ? ['key' => 'children', 'label' => $en ? ($children === 1 ? '1 child' : "{$children} children") : ($children === 1 ? '1 niño' : "{$children} niños"), 'qty' => $children, 'unit' => (string) $childUnit, 'amount' => (string) $childUnit->multipliedBy($children)] : null,
                $infants > 0 ? ['key' => 'infants', 'label' => $en ? ($infants === 1 ? '1 infant' : "{$infants} infants") : ($infants === 1 ? '1 infante' : "{$infants} infantes"), 'qty' => $infants, 'unit' => '0.00', 'amount' => '0.00'] : null,
            ]));
        $subtotal = array_reduce($lines, fn (BigDecimal $sum, array $line): BigDecimal => $sum->plus($line['amount']), BigDecimal::zero())->toScale(2);
        $promotion = $this->bestPromotion($product, $adults + $children, $promoCode);
        $discount = $promotion === null ? BigDecimal::zero()->toScale(2) : Decimal::round2($promotion['percent']
            ? $subtotal->multipliedBy(self::money($promotion['value']))->dividedBy(100, 6, RoundingMode::HALF_UP)
            : BigDecimal::min($subtotal, self::money($promotion['value'])));

        return [
            'date' => $date,
            'currency' => $price['currency'],
            'season' => $price['season'],
            'lines' => $lines,
            'subtotal' => (string) $subtotal,
            'discount' => $discount->isPositive() ? ['label' => $promotion['name'], 'amount' => (string) $discount, 'code' => $promotion['code']] : null,
            'total' => (string) $subtotal->minus($discount),
            'list_total' => $price['list'] !== null && ! $perService && $children === 0 ? (string) self::money($price['list'])->multipliedBy($adults) : null,
            'spots' => $day['spots'],
            'departure' => $day['departure'],
            'pax' => ['adults' => $adults, 'children' => $children, 'infants' => $infants],
            'rate_id' => $price['rate_id'],
        ];
    }

    public static function money(float|int|string|null $value): BigDecimal
    {
        return BigDecimal::of(is_string($value) ? $value : number_format((float) $value, 2, '.', ''))->toScale(2, RoundingMode::HALF_UP);
    }

    private function bestPromotion(stdClass $product, int $seats, ?string $code): ?array
    {
        $code = $code ? strtoupper(trim($code)) : null;

        return collect($product->promotions)
            ->filter(fn (array $p): bool => in_array($p['kind'], self::PERCENT_KINDS, true) || $p['kind'] === 'Descuento fijo')
            ->filter(fn (array $p): bool => $p['code'] === null ? ($p['min_pax'] === null || $seats >= $p['min_pax']) : $p['code'] === $code)
            ->sortByDesc('value')
            ->first();
    }
}
