<?php

declare(strict_types=1);

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\AssignCorrelationId;
use App\Http\Middleware\EnsureChannelEnabled;
use App\Http\Middleware\EnsureExperience;
use App\Http\Middleware\EnsureFeature;
use App\Http\Middleware\EnsureLockVersion;
use App\Http\Middleware\EnsureMfaVerified;
use App\Http\Middleware\EnsurePlatformUser;
use App\Http\Middleware\EnsureTenantActive;
use App\Http\Middleware\IdempotencyMiddleware;
use App\Http\Middleware\ResolvePublicSite;
use App\Http\Middleware\ResolveTenant;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetPermissionsTeam;
use App\Http\Middleware\SetPostgresTenant;
use App\Http\Middleware\TrustConfiguredProxies;
use App\Http\Middleware\VerifyCaptcha;
use App\Http\Routing\ContractMiddleware;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Routing\Router;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: 'api/v1',
        health: '/up',
        then: fn () => ContractMiddleware::apply(app(Router::class)),
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prependToGroup('api', AssignCorrelationId::class);
        $middleware->appendToGroup('api', EnsureChannelEnabled::class);
        $middleware->append(SecurityHeaders::class);
        $middleware->replace(TrustProxies::class, TrustConfiguredProxies::class);
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'tenant.db' => SetPostgresTenant::class,
            'public.site' => ResolvePublicSite::class,
            'tenant.active' => EnsureTenantActive::class,
            'feature' => EnsureFeature::class,
            'mfa' => EnsureMfaVerified::class,
            'platform.user' => EnsurePlatformUser::class,
            'permissions.team' => SetPermissionsTeam::class,
            'ability' => CheckForAnyAbility::class,
            'idempotent' => IdempotencyMiddleware::class,
            'captcha' => VerifyCaptcha::class,
            'if-match' => EnsureLockVersion::class,
            'experience' => EnsureExperience::class,
            'permission' => PermissionMiddleware::class,
            'role' => RoleMiddleware::class,
        ]);

        $middleware->priority([
            AssignCorrelationId::class,
            ResolveTenant::class,
            ResolvePublicSite::class,
            SetPostgresTenant::class,
            Authenticate::class,
            EnsureTenantActive::class,
            EnsureChannelEnabled::class,
            SetPermissionsTeam::class,
            EnsureMfaVerified::class,
            EnsureExperience::class,
            EnsureFeature::class,
            EnsurePlatformUser::class,
            SubstituteBindings::class,
            IdempotencyMiddleware::class,
            VerifyCaptcha::class,
            EnsureLockVersion::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(new ApiExceptionRenderer);
        $exceptions->dontFlash(['password', 'password_confirmation', 'mfa_code', 'doc_number', 'card_number', 'token']);
    })
    ->create();
