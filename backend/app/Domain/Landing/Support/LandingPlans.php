<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Platform\Support\PublicPlans;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

final class LandingPlans
{
    public function __construct(private readonly PublicPlans $plans, private readonly FxRateProvider $fx, private readonly PlatformSettings $settings) {}

    public function catalog(): array
    {
        $catalog = $this->plans->catalog();
        $today = Carbon::today('America/Lima')->toDateString();
        $rate = Cache::remember('landing:fx:'.$today, 3600, function () use ($today): ?array {
            $usd = collect($this->fx->latest(['USD'], $today))->first();

            return $usd === null ? null : ['currency' => 'USD', 'rate_pen' => $usd->ratePen, 'date' => $usd->rateDate, 'source' => $usd->source];
        });

        return [
            ...$catalog,
            'plans' => collect($catalog['plans'])->map(fn (array $plan) => [
                ...$plan,
                'self_service' => (int) $plan['rank'] < 3,
                'annual_months_paid' => SignupQuote::ANNUAL_MONTHS_PAID,
                'price_month_usd' => $rate ? round($plan['price_month'] / (float) $rate['rate_pen'], 2) : null,
                'price_year_usd' => $rate ? round($plan['price_year'] / (float) $rate['rate_pen'], 2) : null,
            ])->values()->all(),
            'fx' => $rate,
            'igv_pct' => $this->settings->igv(),
            'trial' => ['days' => (int) (collect($catalog['plans'])->max('trial_days') ?: 14), 'card_required' => false],
            'cycles' => ['mensual' => 'Mensual', 'anual' => 'Anual (pagas 10 meses)', 'prueba' => 'Prueba de 14 días'],
            'charged_currency' => 'PEN',
        ];
    }
}
