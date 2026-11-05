<?php

/*
| E2E-08 a nivel API (esp. 00 SEC-BR-02, 09 T-01/T-02, 02-ARQUITECTURA §4).
| Doble aislamiento: global scope BelongsToTenant + RLS de PostgreSQL con falla cerrada.
| Plantilla: copiar el dataset de recursos al agregar cada módulo nuevo.
*/

use App\Domain\Bookings\Models\Reservation;
use App\Domain\Catalog\Models\Product;
use App\Domain\Crm\Models\Client;
use App\Domain\Crm\Models\Lead;
use App\Domain\Finance\Models\Receivable;
use App\Domain\Operations\Models\OperationOrder;
use App\Domain\Quotes\Models\Quote;
use Illuminate\Support\Facades\DB;

/** [modelo, ruta API con {id}, código semilla del tenant A] */
dataset('recursos_de_negocio', [
    'reserva' => [Reservation::class, '/api/v1/reservations/{id}', 'RES-2026-000348'],
    'cotización' => [Quote::class, '/api/v1/quotes/{id}', 'COT-2026-00191'],
    'cliente' => [Client::class, '/api/v1/crm/clients/{code}', 'CLI-0002'],
    'lead' => [Lead::class, '/api/v1/crm/leads/{code}', 'LEAD-0231'],
    'producto' => [Product::class, '/api/v1/catalog/products/{id}', 'PRD-011'],
    'cuenta por cobrar' => [Receivable::class, '/api/v1/finance/receivables/{code}', null],
    'orden operativa' => [OperationOrder::class, '/api/v1/ops/orders/{id}', 'OP-2026-0413'],
]);

it('un usuario de B recibe 404 al pedir un recurso de A', function (string $model, string $route, ?string $code) {
    $record = withinTenant(tenantA(), fn () => $code ? $model::query()->where('code', $code)->firstOrFail() : $model::query()->firstOrFail());
    actingAsTenantBAdmin();

    $url = str_replace(['{id}', '{code}'], [$record->id, $record->code], $route);
    $this->getJson($url)
        ->assertNotFound()
        ->assertJsonPath('error', 'RESOURCE_NOT_FOUND');

    // Se audita el intento (acceso_denegado) en el tenant del actor
    expect(withinTenant(tenantB(), fn () => DB::table('audit_events')->where('action', 'acceso_denegado')->exists()))->toBeTrue();
})->with('recursos_de_negocio');

it('los listados de B no contienen filas de A', function (string $model, string $route) {
    $idsA = withinTenant(tenantA(), fn () => $model::query()->pluck('id')->all());
    actingAsTenantBAdmin();

    $list = str($route)->before('/{')->toString();
    $ids = collect($this->getJson($list.'?page[size]=100')->assertOk()->json('data'))->pluck('id');

    expect($ids->intersect($idsA))->toBeEmpty();
})->with('recursos_de_negocio');

it('ignora X-Tenant-Id y tenant_id enviados por el cliente (el tenant sale del token)', function () {
    $userB = actingAsTenantBAdmin();

    $res = $this->withHeader('X-Tenant-Id', tenantA()->id)->postJson('/api/v1/crm/leads', [
        'tenant_id' => tenantA()->id,
        'name' => 'Lead de prueba aislamiento',
        'email' => 'aislamiento@example.com',
        'source' => 'Web',
    ]);

    $res->assertCreated();
    $lead = withinTenant(tenantB(), fn () => Lead::query()->where('email', 'aislamiento@example.com')->first());
    expect($lead?->tenant_id)->toBe($userB->tenant_id);
    expect(withinTenant(tenantA(), fn () => Lead::query()->where('email', 'aislamiento@example.com')->exists()))->toBeFalse();
});

it('una ruta que intenta fijar otro tenant responde 403 TENANT_SCOPE_VIOLATION', function () {
    actingAsTenantBAdmin();

    expect($this->withHeader('X-Tenant-Id', tenantA()->id)->getJson('/api/v1/me/tenant?tenant='.tenantA()->id))
        ->toBeApiError(403, 'TENANT_SCOPE_VIOLATION');
});

it('RLS falla cerrado: sin app.tenant_id la consulta directa devuelve 0 filas', function () {
    // Conexión de la app (rol sin BYPASSRLS). Sin SET LOCAL no hay tenant → ninguna fila visible.
    DB::transaction(function () {
        DB::statement("SELECT set_config('app.tenant_id', '', true)");
        expect(DB::table('booking_reservations')->count())->toBe(0);
    });
});

it('RLS por sí sola aísla aunque se omita el global scope de Eloquent', function () {
    withinTenant(tenantB(), function () {
        expect(Reservation::query()->withoutGlobalScopes()->where('code', 'RES-2026-000348')->exists())->toBeFalse();
    });
});

it('los jobs restauran el tenant serializado antes de ejecutarse', function () {
    // Plantilla: cualquier job de dominio debe usar el middleware de job de tenancy.
    $job = new \App\Domain\Quotes\Jobs\ExpireQuotes();
    expect(collect($job->middleware())->map(fn ($m) => $m::class))
        ->toContain(\App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext::class);
});
