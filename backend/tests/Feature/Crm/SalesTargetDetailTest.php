<?php

use Illuminate\Routing\Middleware\ThrottleRequests;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('el detalle de una meta de equipo trae el avance, el desglose por asesor, el histórico y los ajustes', function () {
    actingAsSeed('U02');

    $data = $this->getJson('/api/v1/crm/sales-targets/MET-0012')->assertOk()->json('data');

    expect($data['target']['code'])->toBe('MET-0012')
        ->and($data['target']['scope_type'])->toBe('equipo')
        ->and(collect($data['breakdown'])->pluck('kind')->unique()->all())->toBe(['asesor'])
        ->and(collect($data['breakdown'])->sum('share_pct'))->toBeLessThanOrEqual(100.5)
        ->and(collect($data['history'])->pluck('code'))->toContain('MET-0016')
        ->and(collect($data['history'])->pluck('code'))->not->toContain('MET-0012')
        ->and(collect($data['adjustments'])->pluck('action'))->toContain('crear')
        ->and($data['can']['manage'])->toBeTrue();
});

it('el ajuste aparece en el historial de ajustes del detalle con su antes y después', function () {
    actingAsSeed('U02');

    $this->patchJson('/api/v1/crm/sales-targets/MET-0014', ['goal_sales' => 65000, 'reason' => 'Se sumó la cartera del colegio'])->assertOk();

    $adjustment = collect($this->getJson('/api/v1/crm/sales-targets/MET-0014')->json('data.adjustments'))->first();
    expect($adjustment['action'])->toBe('ajustar')
        ->and($adjustment['reason'])->toBe('Se sumó la cartera del colegio')
        ->and((float) $adjustment['before']['goal_sales_pen'])->toBe(60000.0)
        ->and((float) $adjustment['after']['goal_sales_pen'])->toBe(65000.0)
        ->and($adjustment['by'])->toBe(seedUser('U02')->name);
});

it('el asesor ve el detalle de su meta con sus metas de otros períodos, sin borradores', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/crm/sales-targets/MET-0008')->assertOk()->json('data');

    expect($data['target']['scope']['id'])->toBe(seedUser('U03')->id)
        ->and(collect($data['history'])->pluck('code')->all())->toContain('MET-0005', 'MET-0002')
        ->and(collect($data['history'])->pluck('status'))->not->toContain('borrador')
        ->and(collect($data['breakdown'])->pluck('kind')->every(fn (string $kind) => in_array($kind, ['equipo', 'sede'], true)))->toBeTrue()
        ->and($data['can']['manage'])->toBeFalse();
});

it('el asesor no abre metas ajenas, de equipo ni en borrador', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/crm/sales-targets/MET-0009'))->toBeApiError(404);
    expect($this->getJson('/api/v1/crm/sales-targets/MET-0012'))->toBeApiError(404);
    expect($this->getJson('/api/v1/crm/sales-targets/MET-9999'))->toBeApiError(404);

    actingAsSeed('U02');
    expect($this->getJson('/api/v1/crm/sales-targets/MET-0013')->assertOk()->json('data.target.status'))->toBe('borrador');
});

it('otra agencia no ve el detalle de una meta', function () {
    actingAsTenantBAdmin();

    expect($this->getJson('/api/v1/crm/sales-targets/MET-0012'))->toBeApiError(404);
});
