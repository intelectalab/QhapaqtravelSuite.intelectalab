<?php

use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    withinTenant(tenantA(), function () {
        $audit = app(AuditLogger::class);
        $audit->log('Rol', 'custom_guias', 'crear_rol', null, 'Guías senior');
        $audit->log('Permiso', 'sales:reports.view', 'otorgar_permiso', null, 'reports.view');
        $audit->log('Cotización', 'COT-2026-00188', 'enviar', 'borrador', 'enviada');
        $audit->log('Reserva', 'RES-2026-000350', 'actualizar', 'pendiente', 'confirmada');
    });
});

it('audit-events lista con cursor, filtros y agregados', function () {
    actingAsSeed('U01');

    $page = $this->getJson('/api/v1/audit-events?filter[days]=0&page[size]=3')->assertOk();

    expect($page->json('data'))->toHaveCount(3)
        ->and($page->json('data.0'))->toHaveKeys(['id', 'code', 'actor_type', 'entity', 'entity_id', 'action', 'is_critical', 'correlation_id', 'occurred_at'])
        ->and($page->json('meta'))->toHaveKeys(['kpis', 'top_entities', 'by_action', 'by_actor', 'daily'])
        ->and($page->json('links.next'))->not->toBeNull();

    $critical = $this->getJson('/api/v1/audit-events?filter[days]=0&filter[critical]=1&page[size]=100')->assertOk()->json('data');
    expect(collect($critical)->pluck('is_critical')->unique()->all())->toBe([true]);
});

it('audit-events/{id} acepta el id o el código y trae relacionados', function () {
    actingAsSeed('U01');
    $event = withinTenant(tenantA(), fn () => DB::table('audit_events')->orderByDesc('occurred_at')->first(['id', 'code']));

    $this->getJson("/api/v1/audit-events/{$event->id}")->assertOk()->assertJsonPath('data.code', (int) $event->code)->assertJsonStructure(['data' => ['related']]);
    $this->getJson("/api/v1/audit-events/{$event->code}")->assertOk()->assertJsonPath('data.id', $event->id);
    expect($this->getJson('/api/v1/audit-events/no-existe'))->toBeApiError(404);
});

it('quien solo administra roles ve únicamente cambios de permisos y roles', function () {
    $user = seedUser('U02');
    withinTenant(tenantA(), function () {
        DB::table('role_has_permissions')->insert(['role_id' => DB::table('roles')->where('name', 'manager')->value('id'), 'permission_id' => DB::table('permissions')->where('name', 'admin.roles.manage')->value('id')]);
        DB::table('role_has_permissions')->where('role_id', DB::table('roles')->where('name', 'manager')->value('id'))->where('permission_id', DB::table('permissions')->where('name', 'admin.audit.view')->value('id'))->delete();
    });
    actingAsUser($user, tenantA());

    $entities = collect($this->getJson('/api/v1/audit-events?filter[days]=0&page[size]=100')->assertOk()->json('data'))->pluck('entity')->unique()->values()->all();

    expect(array_diff($entities, ['Permiso', 'Rol']))->toBe([]);
    expect($this->getJson('/api/v1/audit-events/1'))->toBeApiError(403);
});

it('audit-events/exports genera el CSV, lo registra y es idempotente', function () {
    Storage::fake('local');
    actingAsSeed('U01');
    $key = idem();

    expect($this->postJson('/api/v1/audit-events/exports', ['filters' => ['days' => 7]]))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');

    $first = $this->postJson('/api/v1/audit-events/exports', ['filters' => ['days' => 7]], critical(null, $key))->assertStatus(202)->json('data');
    $again = $this->postJson('/api/v1/audit-events/exports', ['filters' => ['days' => 7]], critical(null, $key))->assertStatus(202)->json('data');
    $export = withinTenant(tenantA(), fn () => DB::table('report_exports')->where('id', $first['export_id'])->first());

    expect($again)->toBe($first)
        ->and($export->status)->toBe('disponible')
        ->and($export->report_key)->toBe('auditoria')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Exportación')->where('entity_id', $first['code'])->where('action', 'exportar')->exists()))->toBeTrue();
    Storage::disk('local')->assertExists($export->file_path);
});

it('Ventas no consulta ni exporta la bitácora', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/audit-events'))->toBeApiError(403);
    expect($this->postJson('/api/v1/audit-events/exports', [], critical()))->toBeApiError(403);
});
