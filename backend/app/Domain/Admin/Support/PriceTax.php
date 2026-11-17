<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

final class PriceTax
{
    public const DEFAULT_PCT = '18';

    private const DOMESTIC = ['perú', 'peru', 'pe'];

    public function __construct(private readonly TenantSettings $settings) {}

    public static function domestic(?string $country): bool
    {
        return in_array(mb_strtolower(trim((string) $country)), self::DOMESTIC, true);
    }

    public function included(): bool
    {
        return (bool) ($this->settings->section('currency')['price_with_tax'] ?? true);
    }

    public function pct(?string $country = null): string
    {
        if ($country !== null && ! self::domestic($country)) {
            return '0';
        }

        $pct = $this->settings->section('currency')['tax_pct'] ?? self::DEFAULT_PCT;

        return is_numeric($pct) ? (string) BigDecimal::of((string) $pct)->strippedOfTrailingZeros() : self::DEFAULT_PCT;
    }

    public function terms(?string $country = null): array
    {
        return ['pct' => $this->pct($country), 'included' => $this->included()];
    }

    public function apply(BigDecimal|string $amount, ?string $country = null): array
    {
        return self::split($amount, $this->pct($country), $this->included());
    }

    public static function split(BigDecimal|string $amount, BigDecimal|string $pct, bool $included): array
    {
        $amount = Decimal::round2($amount);
        $rate = BigDecimal::of((string) $pct);

        if ($included) {
            $taxable = $amount->multipliedBy(100)->dividedBy($rate->plus(100), 2, RoundingMode::HALF_UP);

            return ['pct' => (string) $rate->strippedOfTrailingZeros(), 'included' => true, 'taxable' => $taxable, 'tax' => $amount->minus($taxable), 'total' => $amount];
        }

        $tax = Decimal::round2($amount->multipliedBy($rate)->dividedBy(100, 6, RoundingMode::HALF_UP));

        return ['pct' => (string) $rate->strippedOfTrailingZeros(), 'included' => false, 'taxable' => $amount, 'tax' => $tax, 'total' => $amount->plus($tax)];
    }

    public static function view(array $split): array
    {
        return ['pct' => $split['pct'], 'included' => $split['included'], 'taxable' => (string) $split['taxable'], 'tax' => (string) $split['tax'], 'total' => (string) $split['total']];
    }

    public static function storedIncluded(object $version): bool
    {
        $tax = BigDecimal::of((string) ($version->tax_total ?? '0'));

        return $tax->isPositive() && BigDecimal::of((string) $version->sale_total)->minus((string) $version->discount_total)->isEqualTo((string) $version->grand_total);
    }
}
