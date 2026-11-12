<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Booking\Listeners\NotifyReservationConfirmed;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\Policies\ReservationPolicy;
use App\Domain\Catalog\Listeners\ConsumeAllotmentOnServiceChange;
use App\Domain\Crm\Events\SalesTargetClosed;
use App\Domain\Finance\Listeners\CreateTargetBonus;
use App\Domain\Finance\Listeners\TreasurySyncListener;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Operations\Listeners\CreateTravelDocChecklist;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Quotes\Policies\QuotePolicy;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(TenantContext::class);
    }

    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());
        $this->freezeBusinessDay();
        Gate::policy(Quote::class, QuotePolicy::class);
        Gate::policy(Reservation::class, ReservationPolicy::class);
        Event::listen(ReservationConfirmed::class, NotifyReservationConfirmed::class);
        Event::listen(ReservationConfirmed::class, CreateTravelDocChecklist::class);
        Event::listen(ConsumeAllotmentOnServiceChange::EVENTS, ConsumeAllotmentOnServiceChange::class);
        Event::listen(TreasurySyncListener::EVENTS, TreasurySyncListener::class);
        Event::listen(SalesTargetClosed::class, CreateTargetBonus::class);
        Sanctum::usePersonalAccessTokenModel(AccessToken::class);
        Sanctum::authenticateAccessTokensUsing(fn ($token, bool $isValid): bool => $isValid && (! method_exists($token->tokenable, 'isActive') || $token->tokenable->isActive()));

        $tenantKey = fn (Request $request): string => 't:'.app(TenantContext::class)->id().':u:'
            .($request->user()?->getAuthIdentifier() ?? $request->ip());

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($tenantKey($request)));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by(mb_strtolower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('exports', fn (Request $request) => Limit::perHour(10)->by($tenantKey($request)));

        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(600)
            ->by((string) $request->header('X-KipuControl-Key').'|'.$request->ip()));
    }

    private function freezeBusinessDay(): void
    {
        $day = config('demo.frozen_today');

        if ($this->app->isProduction() || ! is_string($day) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $day) !== 1) {
            return;
        }

        $now = CarbonImmutable::parse($day.' '.CarbonImmutable::now('America/Lima')->format('H:i:s'), 'America/Lima');
        Carbon::setTestNow($now);
        CarbonImmutable::setTestNow($now);
    }
}
