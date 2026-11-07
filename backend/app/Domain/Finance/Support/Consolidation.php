<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class Consolidation
{
    private ?float $usd = null;

    public function __construct(private readonly TenantContext $context) {}

    public function today(): string
    {
        return $this->now()->toDateString();
    }

    public function now(): Carbon
    {
        return Carbon::now($this->context->timezone());
    }

    public function monthStart(): string
    {
        return $this->now()->startOfMonth()->toDateString();
    }

    public function usdRate(): float
    {
        return $this->usd ??= (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? 3.74);
    }

    public function pen(float|string|null $amount, ?string $currency, float|string|null $fx = null): float
    {
        return $this->penExact($amount, $currency, $fx)->toFloat();
    }

    public function penExact(BigDecimal|float|string|null $amount, ?string $currency, float|string|null $fx = null): BigDecimal
    {
        $value = Decimal::of($amount);

        if ($currency === null || $currency === 'PEN') {
            return Decimal::round2($value);
        }

        return Decimal::round2($value->multipliedBy(Decimal::of((float) $fx > 0 ? $fx : $this->usdRate())));
    }

    public function fxFor(string $currency, mixed $given = null): ?float
    {
        if ($currency === 'PEN') {
            return null;
        }

        return is_numeric($given) && (float) $given > 0 ? round((float) $given, 6) : $this->usdRate();
    }
}
