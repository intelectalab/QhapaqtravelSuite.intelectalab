<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| bootstrap/app.php — EXTRACTO de referencia (Laravel 12)
|--------------------------------------------------------------------------
| Registra el prefijo /api/v1, los alias de middleware del kit y el renderer de errores estándar.
| Los alias `tenant.active`, `mfa`, `permissions.team` y `experience` corresponden a middleware de la
| historia F0 (spec 00 §11 fila 1) que no se incluyen en estos ejemplos.
*/

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\AssignCorrelationId;
use App\Http\Middleware\IdempotencyMiddleware;
use App\Http\Middleware\ResolveTenant;
use App\Http\Middleware\SetPostgresTenant;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        apiPrefix: 'api/v1',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // correlation_id primero: también los 401/403/429 lo llevan.
        $middleware->prependToGroup('api', AssignCorrelationId::class);

        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'tenant.db' => SetPostgresTenant::class,
            'idempotent' => IdempotencyMiddleware::class,
            'tenant.active' => \App\Http\Middleware\EnsureTenantActive::class,     // 403 TENANT_SUSPENDED (SEC-BR-24)
            'mfa' => \App\Http\Middleware\EnsureMfaVerified::class,                // SEC-BR-08
            'permissions.team' => \App\Http\Middleware\SetPermissionsTeam::class,  // setPermissionsTeamId($tenant)
            'experience' => \App\Http\Middleware\EnsureExperience::class,          // SEC-BR-05 (ability del token)
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
        ]);

        // Prioridad: el tenant y la transacción deben existir antes de autenticar, de la idempotencia y de los permisos.
        $middleware->priority([
            AssignCorrelationId::class,
            ResolveTenant::class,          // antes de auth: token y usuario tienen RLS (C-08 v2.5)
            SetPostgresTenant::class,
            \Illuminate\Auth\Middleware\Authenticate::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
            IdempotencyMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(new ApiExceptionRenderer());
        // Datos que nunca deben llegar a los logs (Ley 29733): se agregan a los ya ocultos por Laravel.
        $exceptions->dontFlash(['password', 'password_confirmation', 'mfa_code', 'doc_number', 'card_number', 'token']);
    })
    ->create();
