<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Tenancy\TenantContext;
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
        $value = (float) $amount;

        if ($currency === null || $currency === 'PEN') {
            return round($value, 2);
        }

        return round($value * ((float) $fx ?: $this->usdRate()), 2);
    }

    public function fxFor(string $currency, mixed $given = null): ?float
    {
        if ($currency === 'PEN') {
            return null;
        }

        return is_numeric($given) && (float) $given > 0 ? round((float) $given, 6) : $this->usdRate();
    }
}
