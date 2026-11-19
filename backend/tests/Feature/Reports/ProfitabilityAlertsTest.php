<?php

use App\Domain\Reports\Actions\AiInsights;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function alertsOf(string $kind): Collection
{
    foreach ([-1, 0, 1] as $offset) {
        Cache::forget('t:'.tenantA()->getKey().':insights:'.now()->addDays($offset)->toDateString());
    }

    return collect(test()->getJson("/api/v1/reports/insights?filter[kind]={$kind}&page[size]=100")->assertOk()->json('data'));
}

function alertServices(): array
{
    return withinTenant(tenantA(), function (): array {
        $today = BUSINESS_TODAY;
        $rows = DB::table('catalog_services as s')->join('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->whereNull('s.deleted_at')->where('s.status', 'activo')->where('p.status', 'activo')->where('s.valid_to', '>=', $today)
            ->orderBy('s.ref')->get(['s.id', 's.ref', 'p.id as provider_id']);
        $first = $rows->first();
        $second = $rows->first(fn (object $row): bool => $row->provider_id !== $first->provider_id);

        return [$first, $second];
    });
}

it('Proveedor caro: avisa del servicio que cuesta más de 15 % sobre otro proveedor del mismo tipo y ciudad', function () {
    actingAsSeed('U07');
    [$cheap, $expensive] = alertServices();

    withinTenant(tenantA(), function () use ($cheap, $expensive) {
        DB::table('catalog_providers')->whereIn('id', [$cheap->provider_id, $expensive->provider_id])->update(['city' => 'Ciudad de prueba', 'stars' => null]);
        DB::table('catalog_services')->where('id', $cheap->id)->update(['type' => 'Seguro', 'unit' => 'vehículo', 'currency' => 'USD', 'cost' => '100.00']);
        DB::table('catalog_services')->where('id', $expensive->id)->update(['type' => 'Seguro', 'unit' => 'vehículo', 'currency' => 'USD', 'cost' => '130.00']);
    });

    $alerts = alertsOf('proveedor_caro');
    $alert = $alerts->firstWhere('metric.code', $expensive->ref);

    expect($alert)->not->toBeNull()
        ->and($alert['severity'])->toBe('media')
        ->and($alert['metric'])->toMatchArray(['gap_pct' => '30.0', 'alternative' => $cheap->ref, 'threshold_pct' => AiInsights::EXPENSIVE_GAP_PCT])
        ->and($alert['detail'])->toContain('30.0 % más que')
        ->and($alert['source']['type'])->toBe('catalog_service')
        ->and($alerts->firstWhere('metric.code', $cheap->ref))->toBeNull();
});

it('Proveedor caro: una diferencia de 15 % o menos no genera alerta', function () {
    actingAsSeed('U07');
    [$cheap, $expensive] = alertServices();

    withinTenant(tenantA(), function () use ($cheap, $expensive) {
        DB::table('catalog_providers')->whereIn('id', [$cheap->provider_id, $expensive->provider_id])->update(['city' => 'Ciudad de prueba', 'stars' => null]);
        DB::table('catalog_services')->where('id', $cheap->id)->update(['type' => 'Seguro', 'unit' => 'vehículo', 'currency' => 'USD', 'cost' => '100.00']);
        DB::table('catalog_services')->where('id', $expensive->id)->update(['type' => 'Seguro', 'unit' => 'vehículo', 'currency' => 'USD', 'cost' => '115.00']);
    });

    expect(alertsOf('proveedor_caro')->firstWhere('metric.code', $expensive->ref))->toBeNull();
});

it('Meta en riesgo: avisa de la meta vigente que no proyecta llegar y calla la que va en camino', function () {
    actingAsSeed('U07');
    withinTenant(tenantA(), function () {
        DB::table('crm_sales_targets')->where('code', 'MET-0010')->update(['goal_sales_pen' => '99999999.00']);
        DB::table('crm_sales_targets')->where('code', 'MET-0011')->update(['goal_sales_pen' => '1.00']);
    });

    $alerts = alertsOf('meta_en_riesgo');
    $risk = $alerts->firstWhere('metric.code', 'MET-0010');

    expect($risk)->not->toBeNull()
        ->and($risk['severity'])->toBe('alta')
        ->and($risk['metric']['health'])->toBe('critico')
        ->and($risk['source']['type'])->toBe('crm_sales_target')
        ->and($risk['detail'])->toContain('S/ 99 999 999.00')
        ->and($alerts->firstWhere('metric.code', 'MET-0011'))->toBeNull()
        ->and($alerts->pluck('metric.code'))->not->toContain('MET-0013');
});

it('Demanda alta: avisa de salidas casi llenas o agotadas y de productos muy cotizados en la semana', function () {
    actingAsSeed('U07');
    $quotes = withinTenant(tenantA(), function (): int {
        $ids = DB::table('quote_items as i')->join('quote_versions as v', 'v.id', '=', 'i.quote_version_id')->join('catalog_products as p', 'p.id', '=', 'i.product_id')
            ->where('p.code', 'CUS-PKG-5D4N')->distinct()->pluck('v.quote_id');
        DB::table('quote_quotes')->whereIn('id', $ids)->update(['created_at' => now()->subDays(2)]);

        return $ids->count();
    });

    $alerts = alertsOf('demanda_alta');
    $nearly = $alerts->first(fn (array $alert): bool => $alert['source']['type'] === 'catalog_departure' && $alert['metric']['code'] === 'CUS-MAPI-FD' && $alert['metric']['date'] === '2026-09-30');
    $full = $alerts->first(fn (array $alert): bool => $alert['source']['type'] === 'catalog_departure' && $alert['metric']['code'] === 'CUS-MAPI-FD' && $alert['metric']['date'] === '2026-10-01');
    $quoted = $alerts->first(fn (array $alert): bool => $alert['source']['type'] === 'catalog_product' && $alert['metric']['code'] === 'CUS-PKG-5D4N');

    expect($quotes)->toBeGreaterThanOrEqual(AiInsights::DEMAND_QUOTES)
        ->and($nearly['severity'])->toBe('media')
        ->and($nearly['metric']['occupancy_pct'])->toBe(87)
        ->and($full['severity'])->toBe('alta')
        ->and($quoted['metric']['quotes'])->toBe($quotes)
        ->and($alerts->first(fn (array $alert): bool => $alert['source']['type'] === 'catalog_departure' && $alert['metric']['occupancy_pct'] < AiInsights::DEMAND_OCCUPANCY_PCT))->toBeNull();
});

it('Margen bajo: el piso es el margen mínimo de Configuración, no un número fijo', function () {
    actingAsSeed('U07');
    withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'policies')->update(['values' => DB::raw("values || '{\"approval_margin_pct\": 99}'::jsonb")]));
    $open = withinTenant(tenantA(), fn () => DB::table('quote_quotes as q')->join('quote_versions as v', 'v.id', '=', 'q.current_version_id')->whereNull('q.deleted_at')
        ->whereIn('q.status', ['borrador', 'enviada', 'vista', 'negociacion'])->whereNotNull('v.margin_pct')->where('v.margin_pct', '<', 99)->count());

    $alerts = alertsOf('margen_bajo');

    expect($alerts->count())->toBe(min($open, 30))
        ->and($alerts->every(fn (array $alert): bool => $alert['metric']['floor_pct'] === '99.00'))->toBeTrue()
        ->and($alerts->first()['detail'])->toContain('margen mínimo de 99.00 %');
});
