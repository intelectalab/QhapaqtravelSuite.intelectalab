<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

dataset('paneles por rol', [
    'administrador' => ['U01', 'executive'],
    'gerencia' => ['U02', 'manager'],
    'ventas' => ['U03', 'sales'],
    'operaciones' => ['U05', 'operations'],
    'finanzas' => ['U07', 'finance'],
    'contabilidad' => ['U08', 'accounting'],
]);

it('el inicio devuelve el panel del rol del usuario', function (string $user, string $panel) {
    actingAsSeed($user);

    $home = $this->getJson('/api/v1/dashboard/home')->assertOk()->json('data');

    expect($home['panel'])->toBe($panel)
        ->and($home['data'])->toBeArray()
        ->and($home['data'])->toHaveKey('today');
})->with('paneles por rol');

it('el panel ejecutivo trae KPIs, embudo y servicios de los próximos 7 días con datos reales', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/dashboard/executive')->assertOk()->json('data');

    expect(array_keys($data['kpis']))->toBe(['sales', 'margin', 'pipeline', 'active', 'receivable'])
        ->and(array_column($data['funnel']['steps'], 'key'))->toBe(['leads', 'qualified', 'quoted', 'approved', 'booked'])
        ->and($data['months'])->toHaveCount(6)
        ->and($data)->not->toHaveKey('manager');

    $open = withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->whereNull('deleted_at')->whereNotIn('stage', ['ganada', 'perdida'])->count());
    expect($data['kpis']['pipeline']['count'])->toBe($open);

    $today = $data['today'];
    $limit = date('Y-m-d', strtotime("{$today} +6 days"));
    foreach ($data['services'] as $service) {
        expect($service['date'] >= $today && $service['date'] <= $limit)->toBeTrue();
    }

    $leads = withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->where('status', '<>', 'duplicado')->where('created_at', '>=', now('America/Lima')->startOfMonth()->utc())->count());
    expect($data['funnel']['steps'][0]['count'])->toBe($leads);
});

it('gerencia suma el bloque de aprobaciones, metas y desempeño por asesor', function () {
    actingAsSeed('U02');

    $home = $this->getJson('/api/v1/dashboard/home')->assertOk()->json('data.data');
    $pending = withinTenant(tenantA(), fn () => DB::table('collab_approval_requests')->where('status', 'pendiente')->count());

    expect($home['manager'])->toHaveKeys(['approvals', 'targets', 'team', 'advisors'])
        ->and(array_sum(array_column($home['manager']['approvals']['by_type'], 'count')))->toBe($pending)
        ->and($home['manager']['advisors'])->not->toBeEmpty();

    $this->getJson('/api/v1/dashboard/manager')->assertOk()->assertJsonStructure(['data' => ['approvals', 'targets', 'team', 'advisors']]);
});

it('el panel de ventas solo cuenta la cartera del asesor', function () {
    $user = actingAsSeed('U03');

    $data = $this->getJson('/api/v1/dashboard/sales')->assertOk()->json('data');
    $mine = withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->whereNull('deleted_at')->where('owner_id', $user->id)->whereNotIn('stage', ['ganada', 'perdida'])->count());
    $pending = withinTenant(tenantA(), fn () => DB::table('crm_activities')->where('owner_id', $user->id)->where('status', '<>', 'completada')->count());

    expect($data['kpis']['pipeline']['count'])->toBe($mine)
        ->and($data['kpis']['activities']['pending'])->toBe($pending)
        ->and(array_sum(array_column($data['stages'], 'count')))->toBe($mine);

    foreach ($data['pool'] as $lead) {
        expect(rowOf('crm_leads', $lead['code'])->owner_id)->toBeNull();
    }
});

it('el panel de operaciones no expone montos de venta ni márgenes', function () {
    actingAsSeed('U05');

    $home = $this->getJson('/api/v1/dashboard/home')->assertOk()->json('data');
    $json = json_encode($home);

    expect($home['panel'])->toBe('operations')
        ->and(array_keys($home['data']['kpis']))->toBe(['soon', 'unconfirmed', 'assignments', 'vouchers', 'incidents'])
        ->and($json)->not->toContain('"sales"')->not->toContain('"margin"')->not->toContain('price_amount');
});

it('los paneles de finanzas y contabilidad leen cobros, pagos y comprobantes reales', function () {
    actingAsSeed('U07');
    $finance = $this->getJson('/api/v1/finance/dashboards/finance')->assertOk()->json('data');
    $pending = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('status', 'pendiente')->count());

    expect($finance['kpis']['to_validate']['count'])->toBe($pending)
        ->and($finance['aging'])->toHaveCount(5);

    actingAsSeed('U08');
    $accounting = $this->getJson('/api/v1/finance/dashboards/accounting')->assertOk()->json('data');
    $observed = withinTenant(tenantA(), fn () => DB::table('fin_invoices')->whereIn('status', ['observado', 'rechazado'])->count());

    expect($accounting['kpis']['observed']['count'])->toBe($observed)
        ->and($accounting['close']['total'])->toBe(count($accounting['close']['checks']));
});

it('cada panel exige su permiso y el ejecutivo queda fuera de los roles sin márgenes', function () {
    actingAsSeed('U05');
    expect($this->getJson('/api/v1/dashboard/executive'))->toBeApiError(403);
    expect($this->getJson('/api/v1/finance/dashboards/finance'))->toBeApiError(403);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/dashboard/executive'))->toBeApiError(403);
    expect($this->getJson('/api/v1/finance/dashboards/accounting'))->toBeApiError(403);
    expect($this->getJson('/api/v1/dashboard/manager')->assertOk()->json('data.advisors'))->toBe([]);

    actingAsSeed('U08');
    expect($this->getJson('/api/v1/dashboard/manager'))->toBeApiError(403);

    actingAsSeed('U07');
    expect($this->getJson('/api/v1/dashboard/sales'))->toBeApiError(403);
});
