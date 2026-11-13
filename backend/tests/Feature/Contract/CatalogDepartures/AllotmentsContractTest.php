<?php

use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockSeededBookings();
    lockCatalogProducts();
});

it('GET /catalog/allotments/{id}/charges lista los cargos por no uso con su total', function () {
    actingAsSeed('U05');

    $response = $this->getJson('/api/v1/catalog/allotments/CUP-2026-001/charges')->assertOk();

    expect($response->json('data'))->not->toBeEmpty()
        ->and($response->json('data.0'))->toHaveKeys(['date', 'qty', 'amount', 'currency', 'reason'])
        ->and($response->json('meta.total'))->toEqual(collect($response->json('data'))->sum('amount'));
});

it('GET /catalog/allotments/{id}/requests lista las ampliaciones y filtra por estado', function () {
    actingAsSeed('U05');

    expect(collect($this->getJson('/api/v1/catalog/allotments/CUP-2026-001/requests')->assertOk()->json('data'))->pluck('code')->sort()->values()->all())->toBe(['AMP-0001', 'AMP-0002'])
        ->and(collect($this->getJson('/api/v1/catalog/allotments/CUP-2026-001/requests?filter[status]=solicitada')->json('data'))->pluck('code')->all())->toBe(['AMP-0002']);
    expect($this->getJson('/api/v1/catalog/allotments/CUP-9999-001/requests'))->toBeApiError(404);
});

it('GET /catalog/allotments/{id}/days/{date} trae la celda con sus consumos', function () {
    actingAsSeed('U05');
    $date = (string) withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days as d')->join('catalog_allotments as a', 'a.id', '=', 'd.allotment_id')->where('a.code', 'CUP-2026-001')->orderByDesc('d.used_qty')->value('d.service_date'));

    $data = $this->getJson("/api/v1/catalog/allotments/CUP-2026-001/days/{$date}")->assertOk()->json('data');

    expect($data['date'])->toBe($date)
        ->and($data['allotment']['code'])->toBe('CUP-2026-001')
        ->and($data)->toHaveKeys(['consumptions', 'charges', 'lock_version']);
    expect($this->getJson('/api/v1/catalog/allotments/CUP-2026-001/days/2030-01-01'))->toBeApiError(404);
});

it('las lecturas de cupos exigen gestionar cupos o ver rentabilidad', function () {
    actingAsSeed('U03');

    $denied = $this->getJson('/api/v1/catalog/allotments/CUP-2026-001/charges');

    expect($denied)->toBeApiError(403)
        ->and($denied->json('required_permissions'))->toContain('catalog.allotments.manage');
});
