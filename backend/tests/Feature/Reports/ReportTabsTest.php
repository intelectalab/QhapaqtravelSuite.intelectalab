<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

dataset('reportes', ['comercial', 'cotizaciones', 'reservas', 'operaciones', 'finanzas', 'proveedores', 'clientes']);

it('el administrador ve las 7 pestañas y cada reporte trae KPIs, gráficos y tabla', function (string $report) {
    actingAsSeed('U01');

    $data = $this->getJson("/api/v1/reports/{$report}?period=all")->assertOk()->json('data');

    expect($data['key'])->toBe($report)
        ->and($data['tabs'])->toHaveCount(7)
        ->and($data['kpis'])->toHaveCount(5)
        ->and(count($data['charts']))->toBeGreaterThanOrEqual(2)
        ->and($data['table']['columns'])->not->toBeEmpty()
        ->and($data['can_export'])->toBeTrue()
        ->and($data['filters']['period'])->toBe('all');

    foreach ($data['table']['rows'] as $row) {
        foreach ($data['table']['columns'] as $column) {
            expect($row)->toHaveKey($column['key']);
        }
    }
})->with('reportes');

it('ventas solo ve comercial y cotizaciones, con su cartera, y finanzas le responde 403 (REP-BR-01/02)', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/reports/cotizaciones?period=all')->assertOk()->json('data');
    expect(array_column($data['tabs'], 'key'))->toBe(['comercial', 'cotizaciones'])
        ->and($data['scope'])->toBe('own')
        ->and($data['can_export'])->toBeFalse();

    $mine = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->where('owner_id', seedUser('U03')->id)->count());
    expect(count($data['table']['rows']))->toBe($mine);
    expect($this->getJson('/api/v1/reports/comercial')->json('data.kpis.0.label'))->toBe('Mis leads');

    expect($this->getJson('/api/v1/reports/finanzas'))->toBeApiError(403, 'REP-BR-01');
});

it('contabilidad ve finanzas sin costos, utilidad ni margen (REP-BR-03)', function () {
    actingAsSeed('U08');

    $data = $this->getJson('/api/v1/reports/finanzas?period=all')->assertOk()->json('data');
    $keys = array_column($data['table']['columns'], 'key');

    expect($data['variant'])->toBe('contable')
        ->and(array_column($data['tabs'], 'key'))->toBe(['finanzas'])
        ->and($keys)->not->toContain('cost')->not->toContain('profit')->not->toContain('margin')
        ->and(array_column($data['kpis'], 'key'))->not->toContain('margin');

    actingAsSeed('U07');
    expect($this->getJson('/api/v1/reports/finanzas?period=all')->json('data.variant'))->toBe('rentabilidad');
});

it('operaciones ve reservas, operaciones y proveedores; los filtros validan periodo y sede', function () {
    actingAsSeed('U05');
    $data = $this->getJson('/api/v1/reports/operaciones?period=quarter')->assertOk()->json('data');
    expect(array_column($data['tabs'], 'key'))->toBe(['reservas', 'operaciones', 'proveedores']);

    actingAsSeed('U01');
    $sede = withinTenant(tenantA(), fn () => DB::table('iam_sedes')->whereNull('deleted_at')->orderBy('code')->first(['id', 'code', 'name']));
    $filtered = $this->getJson("/api/v1/reports/reservas?period=all&sede={$sede->code}")->assertOk()->json('data');
    $expected = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereNull('deleted_at')->where('sede_id', $sede->id)->count());
    expect($filtered['filters']['sede']['name'])->toBe($sede->name)->and($filtered['kpis'][0]['value'])->toBe($expected);

    expect($this->getJson('/api/v1/reports/reservas?period=semana'))->toBeApiError(422, 'REPORT_PERIOD');
    expect($this->getJson('/api/v1/reports/reservas?sede=NO-EXISTE'))->toBeApiError(422, 'REPORT_SEDE');
    $this->getJson('/api/v1/reports/inventado')->assertNotFound();
});
