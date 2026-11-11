<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Quotes\Models\Quote;
use App\Domain\Quotes\Policies\QuotePolicy;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * Registro transversal (extracto de referencia).
 */
final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Un contexto por request/job; se reinicia también con Octane y en workers de Horizon.
        $this->app->scoped(TenantContext::class);
    }

    public function boot(): void
    {
        // Detecta N+1, atributos inexistentes y asignación masiva silenciosa en desarrollo y pruebas.
        Model::shouldBeStrict(! $this->app->isProduction());

        Gate::policy(Quote::class, QuotePolicy::class);

        // SEC-BR-25 (valores propuestos, spec 00 §12-12): API 120/min por usuario; login 5/min por IP+email;
        // exportaciones 10/h por usuario. Claves con prefijo de tenant para no mezclar contadores.
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(120)
            ->by('t:'.app(TenantContext::class)->id().':u:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));

        RateLimiter::for('login', fn (Request $r) => Limit::perMinute(5)
            ->by(mb_strtolower((string) $r->input('email')).'|'.$r->ip()));

        RateLimiter::for('exports', fn (Request $r) => Limit::perHour(10)
            ->by('t:'.app(TenantContext::class)->id().':u:'.$r->user()?->getAuthIdentifier()));

        // API pública / widget: por clave pública + IP (spec 16 §6.1). Valor propuesto.
        RateLimiter::for('public', fn (Request $r) => Limit::perMinute(60)
            ->by((string) $r->header('X-KipuControl-Key').'|'.$r->ip()));
    }
}
