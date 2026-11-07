<?php

const U03_QUOTES = ['COT-2026-00183', 'COT-2026-00186', 'COT-2026-00188', 'COT-2026-00189'];

const U04_QUOTES = ['COT-2026-00184', 'COT-2026-00185', 'COT-2026-00190'];

function quoteCodes($response): array
{
    $data = $response->assertOk()->json('data');
    $rows = array_is_list($data) ? $data : ($data['items'] ?? []);

    return collect($rows)->pluck('code')->sort()->values()->all();
}

it('GET /quotes responde la lista del contrato: data[] con meta de cursor', function () {
    actingAsSeed('U01');

    $json = $this->getJson('/api/v1/quotes')->assertOk()->json();

    expect(array_is_list($json['data']))->toBeTrue()
        ->and($json)->toHaveKey('meta');
});

it('X-08: la lista de cotizaciones de Ventas solo trae su cartera', function () {
    actingAsSeed('U03');

    expect(quoteCodes($this->getJson('/api/v1/quotes?page[size]=100')))->toBe(U03_QUOTES);
});

it('X-08: filter[owner] de otro asesor se ignora (owner=me forzado en servidor)', function () {
    actingAsSeed('U03');
    $u04 = seedUser('U04');

    $codes = quoteCodes($this->getJson("/api/v1/quotes?filter[owner]={$u04->id}&page[size]=100"));

    expect($codes)->not->toContain('COT-2026-00190')
        ->and(array_diff($codes, U03_QUOTES))->toBe([]);
});

it('X-08 / SEC-BR-09: detalle de una cotización ajena responde 403 con mensaje de cartera', function () {
    actingAsSeed('U03');

    $response = $this->getJson('/api/v1/quotes/COT-2026-00190');

    expect($response)->toBeApiError(403, 'SEC-BR-09');
    expect($response->json('message'))->toContain('cartera de otro asesor');
});

it('detalle de una cotización propia responde 200', function () {
    actingAsSeed('U03');

    $this->getJson('/api/v1/quotes/COT-2026-00189')->assertOk()->assertJsonPath('data.code', 'COT-2026-00189');
});

it('SEC-BR-09: detalle de una reserva ajena responde 403 y la propia 200', function () {
    actingAsSeed('U03');

    $this->getJson('/api/v1/reservations/RES-2026-000350')->assertForbidden();
    $this->getJson('/api/v1/reservations/RES-2026-000347')->assertOk();
});

it('los KPIs de Ventas se calculan con el mismo alcance que la lista', function () {
    actingAsSeed('U03');
    $mine = $this->getJson('/api/v1/quotes/kpis')->assertOk()->json('data');

    actingAsSeed('U01');
    $all = $this->getJson('/api/v1/quotes/kpis')->assertOk()->json('data');

    expect($mine['count'] ?? $mine['total'])->toBeLessThan($all['count'] ?? $all['total']);
});

it('QTE-BR-26: la búsqueda global de Ventas no devuelve registros ajenos', function () {
    requireRoute('GET', '/api/v1/search');
    actingAsSeed('U03');

    $json = json_encode($this->getJson('/api/v1/search?q=COT-2026-001')->assertOk()->json());

    expect($json)->not->toContain('COT-2026-00190');
    expect($json)->not->toContain('COT-2026-00185');
});

it('H-17: viajes por cerrar de Postventa solo trae reservas propias', function () {
    requireRoute('GET', '/api/v1/crm/after-sales/trips');
    actingAsSeed('U03');

    $json = json_encode($this->getJson('/api/v1/crm/after-sales/trips')->assertOk()->json());

    expect($json)->not->toContain('RES-2026-000350');
    expect($json)->not->toContain('RES-2026-000348');
});

it('Manager y Tenant Admin ven todas las cotizaciones y pueden filtrar por asesor', function (string $user) {
    actingAsSeed($user);
    $u04 = seedUser('U04');

    expect(quoteCodes($this->getJson("/api/v1/quotes?filter[owner]={$u04->id}&page[size]=100")))->toBe(U04_QUOTES);
})->with(['U01', 'U02']);

it('la respuesta de Ventas no expone costos de proveedor desglosados', function () {
    actingAsSeed('U03');

    $json = json_encode($this->getJson('/api/v1/quotes?page[size]=1')->assertOk()->json());

    expect($json)->not->toContain('provider_cost_breakdown');
});

it('X-09: Operaciones no recibe margen ni utilidad de una cotización', function () {
    actingAsSeed('U05');

    $response = $this->getJson('/api/v1/quotes/COT-2026-00191');

    expect($response->status())->toBeIn([200, 403]);

    if ($response->status() === 200) {
        expect(json_encode($response->json('data')))->not->toMatch('/"(margin_pct|profit|cost)":\s*[0-9]/');
    }
});

it('X-09 / SEC-BR-13: Ventas ve el margen de su propia cotización', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/quotes/COT-2026-00189')->assertOk()->json('data.margin_pct'))->not->toBeNull();
});

it('X-09 / SEC-BR-13: Contabilidad no recibe costos de la cotización', function () {
    actingAsSeed('U08');

    $response = $this->getJson('/api/v1/quotes/COT-2026-00191');

    expect($response->status())->toBeIn([200, 403]);

    if ($response->status() === 200) {
        expect(json_encode($response->json('data')))->not->toMatch('/"(unit_cost|cost)":\s*[0-9]/');
    }
});
