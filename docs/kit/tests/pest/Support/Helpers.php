<?php

/*
|--------------------------------------------------------------------------
| Helpers de referencia para las pruebas Pest del kit.
|--------------------------------------------------------------------------
| SUPUESTOS de nombres (02-ARQUITECTURA §3): modelos en App\Domain\<Dominio>\Models,
| casos de uso en App\Domain\<Dominio>\Actions, máquinas de estado en ...\StateMachines.
| Si el repo usa otros nombres, ajustar SOLO este archivo y los `use` de cada prueba.
*/

use App\Domain\Iam\Models\User;
use App\Domain\Platform\Models\Tenant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

const BUSINESS_TODAY = '2026-09-29';

function freezeBusinessToday(string $time = '10:00:00'): void
{
    $now = CarbonImmutable::parse(BUSINESS_TODAY.' '.$time, 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

/** Carga la semilla demo (TNT-0001 desde kit-ia/seeds/*.json) y un segundo tenant mínimo (TNT-0002). */
function seedDemoTenants(): void
{
    static $seeded = false; // LazilyRefreshDatabase + transacción por test: basta sembrar una vez por proceso
    if ($seeded && Tenant::query()->withoutGlobalScopes()->where('code', 'TNT-0001')->exists()) {
        return;
    }
    Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\DemoTenantSeeder', '--force' => true]);
    Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\SecondTenantSeeder', '--force' => true]);
    $seeded = true;
}

function tenantA(): Tenant
{
    return Tenant::query()->withoutGlobalScopes()->where('code', 'TNT-0001')->firstOrFail();
}

function tenantB(): Tenant
{
    return Tenant::query()->withoutGlobalScopes()->where('code', 'TNT-0002')->firstOrFail();
}

/**
 * Usuario semilla por código del prototipo (U01…U17), siempre del tenant A.
 * users.code conserva el id del prototipo (supuesto del seeder; si no existe la columna, mapear por email).
 */
function seedUser(string $code): User
{
    return withinTenant(tenantA(), fn () => User::query()->where('code', $code)->firstOrFail());
}

/** Autentica como usuario semilla (Sanctum, abilities completas) y fija el tenant del contexto. */
function actingAsSeed(string $code): User
{
    $user = seedUser($code);
    Sanctum::actingAs($user, ['*']);
    app(\App\Domain\Shared\Tenancy\TenantContext::class)->set($user->tenant);

    return $user;
}

/** Admin del tenant B (lo crea SecondTenantSeeder). */
function actingAsTenantBAdmin(): User
{
    $user = withinTenant(tenantB(), fn () => User::query()->whereHas('roles', fn ($q) => $q->where('name', 'tenant_admin'))->firstOrFail());
    Sanctum::actingAs($user, ['*']);
    app(\App\Domain\Shared\Tenancy\TenantContext::class)->set($user->tenant);

    return $user;
}

/**
 * Ejecuta un callback con el tenant fijado en Laravel y en PostgreSQL (SET LOCAL app.tenant_id),
 * igual que el middleware SetPostgresTenant. Útil para Arrange/Assert fuera de una request.
 */
function withinTenant(Tenant $tenant, Closure $fn): mixed
{
    return DB::transaction(function () use ($tenant, $fn) {
        DB::statement("SELECT set_config('app.tenant_id', ?, true)", [$tenant->id]);
        app(\App\Domain\Shared\Tenancy\TenantContext::class)->set($tenant);

        return $fn();
    });
}

/** Id (uuid) de un registro por su código legible, dentro del tenant A. */
function idOf(string $modelClass, string $code, ?Tenant $tenant = null): string
{
    return withinTenant($tenant ?? tenantA(), fn () => $modelClass::query()->where('code', $code)->value('id'))
        ?? throw new RuntimeException("{$code} no existe en ".class_basename($modelClass));
}

function idem(string $prefix = 'pest'): string
{
    return $prefix.'-'.Str::uuid()->toString();
}

/** Cabeceras estándar para operaciones críticas (CONVENCIONES §3). */
function critical(?int $lockVersion = null, ?string $key = null): array
{
    $h = ['Idempotency-Key' => $key ?? idem(), 'Accept' => 'application/json'];
    if ($lockVersion !== null) {
        $h['If-Match'] = (string) $lockVersion;
    }

    return $h;
}
