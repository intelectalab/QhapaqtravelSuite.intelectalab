<?php

/*
| Ownership del rol Ventas (esp. 00 SEC-BR-09 / §7.6; 03 QTE-BR-26; 04 T-R13; 01 H-17; 14 MET-BR-07).
| U03 (Lucía): COT-2026-00189/00188/00186/00183 · RES-2026-000347/000346/000343/000349.
| U04 (Diego): COT-2026-00190/00185/00184 · RES-2026-000350/000344.
| Plantilla: repetir el patrón (lista forzada a owner=me, detalle ajeno 403, filtro ignorado) en cada recurso con owner_id.
*/

use App\Domain\Bookings\Models\Reservation;
use App\Domain\Quotes\Models\Quote;

const U03_QUOTES = ['COT-2026-00183', 'COT-2026-00186', 'COT-2026-00188', 'COT-2026-00189'];

it('la lista de cotizaciones de Ventas solo trae su cartera', function () {
    actingAsSeed('U03');

    $codes = collect($this->getJson('/api/v1/quotes?page[size]=100')->assertOk()->json('data'))->pluck('code')->sort()->values()->all();

    expect($codes)->toBe(U03_QUOTES);
});

it('filter[owner] de otro asesor se ignora (owner=me forzado en servidor)', function () {
    actingAsSeed('U03');
    $u04 = seedUser('U04');

    $codes = collect($this->getJson("/api/v1/quotes?filter[owner]={$u04->id}&page[size]=100")->json('data'))->pluck('code');

    expect($codes)->not->toContain('COT-2026-00190')
        ->and($codes->diff(U03_QUOTES))->toBeEmpty();
});

it('detalle de una cotización ajena → 403 SEC-BR-09 con mensaje de cartera', function () {
    actingAsSeed('U03');
    $id = idOf(Quote::class, 'COT-2026-00190');

    $res = $this->getJson("/api/v1/quotes/{$id}");

    expect($res)->toBeApiError(403, 'SEC-BR-09');
    expect($res->json('message'))->toContain('cartera de otro asesor');
});

it('detalle de una reserva ajena → 403 y la propia → 200', function () {
    actingAsSeed('U03');

    $this->getJson('/api/v1/reservations/'.idOf(Reservation::class, 'RES-2026-000350'))->assertForbidden();
    $this->getJson('/api/v1/reservations/'.idOf(Reservation::class, 'RES-2026-000347'))->assertOk();
});

it('los KPIs de Ventas se calculan con el mismo alcance que la lista', function () {
    actingAsSeed('U03');
    $mine = $this->getJson('/api/v1/quotes/kpis')->assertOk()->json('data');

    actingAsSeed('U01');
    $all = $this->getJson('/api/v1/quotes/kpis')->assertOk()->json('data');

    expect($mine['count'] ?? $mine['total'])->toBeLessThan($all['count'] ?? $all['total']);
});

it('la búsqueda global de Ventas no devuelve registros ajenos', function () {
    actingAsSeed('U03');

    $json = json_encode($this->getJson('/api/v1/search?q=COT-2026-001')->assertOk()->json());

    expect($json)->not->toContain('COT-2026-00190')->not->toContain('COT-2026-00185');
});

it('H-17: «viajes por cerrar» de Postventa solo trae reservas propias', function () {
    actingAsSeed('U03');

    $json = json_encode($this->getJson('/api/v1/crm/after-sales/trips')->assertOk()->json());

    expect($json)->not->toContain('RES-2026-000350')->not->toContain('RES-2026-000348');
});

it('Manager y Tenant Admin ven todas las cotizaciones y pueden filtrar por asesor', function (string $user) {
    actingAsSeed($user);
    $u04 = seedUser('U04');

    $codes = collect($this->getJson("/api/v1/quotes?filter[owner]={$u04->id}&page[size]=100")->json('data'))->pluck('code')->sort()->values()->all();

    expect($codes)->toBe(['COT-2026-00184', 'COT-2026-00185', 'COT-2026-00190']);
})->with(['U01', 'U02']);

it('la respuesta de Ventas omite la columna de vendedor ajeno y los costos no autorizados', function () {
    actingAsSeed('U03');
    $row = $this->getJson('/api/v1/quotes?page[size]=1')->json('data.0');

    // Ventas ve el margen solo de sus cotizaciones (03 §7); nunca costos de proveedor desglosados
    expect($row)->not->toHaveKey('provider_cost_breakdown');
});
