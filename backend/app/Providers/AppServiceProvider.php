<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Shared\Tenancy\TenantContext;
use Laravel\Sanctum\Sanctum;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(TenantContext::class);
    }

    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());
        Sanctum::usePersonalAccessTokenModel(AccessToken::class);

        $tenantKey = fn (Request $request): string => 't:'.app(TenantContext::class)->id().':u:'
            .($request->user()?->getAuthIdentifier() ?? $request->ip());

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($tenantKey($request)));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by(mb_strtolower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('exports', fn (Request $request) => Limit::perHour(10)->by($tenantKey($request)));

        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(60)
            ->by((string) $request->header('X-Qhapaq-Key').'|'.$request->ip()));
    }
}
