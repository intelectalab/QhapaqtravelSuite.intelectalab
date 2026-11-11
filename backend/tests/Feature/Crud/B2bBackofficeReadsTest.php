<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function b2bAgencyOfU13(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('id', DB::table('iam_users')->where('code', 'U13')->value('agency_id'))->value('code'));
}

it('B2B §6.1: resumen, lista filtrada, detalle con tarifas y reservas, libro de crédito y solicitudes de liquidación', function () {
    actingAsSeed('U01');
    $code = b2bAgencyOfU13();

    $this->getJson('/api/v1/channels/b2b/summary')->assertOk()->assertJsonStructure(['data' => ['today', 'kpis' => ['active', 'total', 'credit_limit', 'credit_used']]]);

    $all = $this->getJson('/api/v1/channels/b2b/agencies')->assertOk()->json('data');
    $active = $this->getJson('/api/v1/channels/b2b/agencies?status=activa')->assertOk()->json('data');
    $search = $this->getJson('/api/v1/channels/b2b/agencies?q='.urlencode($code))->assertOk()->json('data');
    expect(count($active))->toBeLessThanOrEqual(count($all))->and(collect($active)->pluck('effective_status')->unique()->all())->toBeIn([[], ['activa']])
        ->and(collect($search)->pluck('code'))->toContain($code);

    $agency = $this->getJson("/api/v1/channels/b2b/agencies/{$code}")->assertOk()->json('data');
    expect($agency['code'])->toBe($code)->and($agency)->toHaveKeys(['rates', 'reservations', 'credit_available']);
    expect($this->getJson('/api/v1/channels/b2b/agencies/AGE-NO-EXISTE'))->toBeApiError(404);

    $ledger = $this->getJson("/api/v1/channels/b2b/agencies/{$code}/credit-movements")->assertOk()->json('data');
    expect($ledger['agency'])->toBe($code)->and($ledger)->toHaveKeys(['items', 'credit_limit', 'credit_used']);

    $settlements = $this->getJson('/api/v1/channels/b2b/settlement-requests')->assertOk()->json('data');
    expect($settlements)->toBeArray();
});

it('B2B §6.1: «Ver portal como esta agencia» entrega un token de solo lectura que no permite cambios', function () {
    actingAsSeed('U01');
    $code = b2bAgencyOfU13();

    $preview = $this->postJson("/api/v1/channels/b2b/agencies/{$code}/impersonation", [])->assertOk()->json('data');
    expect($preview['read_only'])->toBeTrue()->and($preview['user']['code'])->toBe('U13')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Agencia B2B', 'entity_id' => $code, 'action' => 'previsualizar_portal'])->exists()))->toBeTrue();

    app('auth')->forgetGuards();
    $headers = ['Authorization' => "Bearer {$preview['token']}"];
    $this->getJson('/api/v1/b2b/me', $headers)->assertOk();
    expect($this->postJson('/api/v1/b2b/settlement-requests', [], [...$headers, ...critical()]))->toBeApiError(403, 'PREVIEW_READ_ONLY');
});

it('B2B §6.1: sin permiso del canal no se consultan agencias; Finanzas sí ve las liquidaciones', function () {
    actingAsSeed('U03');
    expect($this->getJson('/api/v1/channels/b2b/agencies')->status())->toBe(403);

    actingAsSeed('U07');
    $this->getJson('/api/v1/channels/b2b/settlement-requests')->assertOk();
});
