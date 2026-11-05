<?php

declare(strict_types=1);

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\AssignCorrelationId;
use App\Http\Middleware\EnsureMfaVerified;
use App\Http\Middleware\EnsurePlatformUser;
use App\Http\Middleware\EnsureTenantActive;
use App\Http\Middleware\IdempotencyMiddleware;
use App\Http\Middleware\ResolveTenant;
use App\Http\Middleware\SetPermissionsTeam;
use App\Http\Middleware\SetPostgresTenant;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: 'api/v1',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prependToGroup('api', AssignCorrelationId::class);
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'tenant.db' => SetPostgresTenant::class,
            'tenant.active' => EnsureTenantActive::class,
            'mfa' => EnsureMfaVerified::class,
            'platform.user' => EnsurePlatformUser::class,
            'permissions.team' => SetPermissionsTeam::class,
            'ability' => CheckForAnyAbility::class,
            'idempotent' => IdempotencyMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role' => RoleMiddleware::class,
        ]);

        $middleware->priority([
            AssignCorrelationId::class,
            Authenticate::class,
            ResolveTenant::class,
            SetPostgresTenant::class,
            EnsureTenantActive::class,
            SetPermissionsTeam::class,
            EnsureMfaVerified::class,
            EnsurePlatformUser::class,
            SubstituteBindings::class,
            IdempotencyMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(new ApiExceptionRenderer());
        $exceptions->dontFlash(['password', 'password_confirmation', 'mfa_code', 'doc_number', 'card_number', 'token']);
    })
    ->create();
