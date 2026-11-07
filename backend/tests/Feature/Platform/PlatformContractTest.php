<?php

use App\Domain\Platform\Actions\PlatformSession;
use Illuminate\Support\Facades\DB;

it('platform/tenants/health resume la salud de cada tenant', function () {
    actingAsPlatform();

    $response = $this->getJson('/api/v1/platform/tenants/health')->assertOk();
    $andes = collect($response->json('data'))->firstWhere('code', 'TNT-0001');

    expect($andes)->toHaveKeys(['plan', 'status', 'health', 'integrations', 'jobs', 'open_errors', 'last_heartbeat_at'])
        ->and($andes['open_errors'])->toBe(3)
        ->and($andes['health'])->toBe('critico')
        ->and($response->json('meta.kpis.tenants'))->toBe(count($response->json('data')));
});

it('AUD-BR-02 / T-26: platform/audit-events solo trae eventos de plataforma y filtra por tenant', function () {
    $session = app(PlatformSession::class);
    DB::connection('pgsql_platform')->transaction(fn () => $session->log('Tenant', 'TNT-0002', 'suspender', 'activo', 'suspendido', platformUser()));
    withinTenant(tenantA(), fn () => DB::table('audit_events')->insert(['tenant_id' => tenantA()->getKey(), 'code' => 999001, 'actor_type' => 'system', 'entity' => 'Cotización', 'entity_id' => 'COT-2026-00188', 'action' => 'enviar', 'is_critical' => false, 'correlation_id' => 'pest', 'occurred_at' => now()]));
    actingAsPlatform();

    $all = $this->getJson('/api/v1/platform/audit-events?page[size]=100')->assertOk()->json('data');
    $filtered = $this->getJson('/api/v1/platform/audit-events?filter[tenant]=TNT-0002')->assertOk()->json('data');

    expect(collect($all)->pluck('entity'))->not->toContain('Cotización')
        ->and(collect($filtered)->pluck('entity_id')->unique()->all())->toBe(['TNT-0002']);
});

it('el Tenant Admin no entra a las rutas de plataforma nuevas', function (string $uri) {
    actingAsSeed('U01');

    expect($this->getJson($uri))->toBeApiError(403);
})->with(['/api/v1/platform/tenants/health', '/api/v1/platform/audit-events']);
