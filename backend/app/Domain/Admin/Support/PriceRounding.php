<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

final class PriceRounding
{
    public function __construct(private readonly TenantSettings $settings) {}

    public function apply(BigDecimal $price): BigDecimal
    {
        $currency = $this->settings->section('currency');
        $step = BigDecimal::of((string) ($currency['rounding'] ?? '0.01'));
        $mode = match ($currency['round_mode'] ?? 'nearest') {
            'up' => RoundingMode::CEILING,
            'down' => RoundingMode::FLOOR,
            default => RoundingMode::HALF_UP,
        };

        if (! $step->isPositive()) {
            return $price->toScale(2, RoundingMode::HALF_UP);
        }

        return $price->dividedBy($step, 0, $mode)->multipliedBy($step)->toScale(2, RoundingMode::UNNECESSARY);
    }
}
