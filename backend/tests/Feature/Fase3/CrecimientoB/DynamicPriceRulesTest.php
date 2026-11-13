<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

if (! function_exists('crecbAudited')) {
    function crecbAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function crecbWithoutActiveRules(): void
{
    withinTenant(tenantA(), fn () => DB::table('catalog_dynamic_price_rules')->update(['active' => false]));
}

function crecbTravelDay(int $days): string
{
    return Carbon::today('America/Lima')->addDays($days)->toDateString();
}

it('crea reglas, las activa con If-Match y deja el antes y después en la auditoría', function () {
    actingAsSeed('U01');

    $rule = $this->postJson('/api/v1/catalog/dynamic-price-rules', ['name' => 'Última hora', 'basis' => 'anticipacion', 'conditions' => ['days_before_lte' => 3], 'adjust_pct' => 20])
        ->assertCreated()
        ->assertJsonPath('data.active', false)
        ->json('data');

    expect($rule['code'])->toStartWith('PDN-');

    $this->patchJson("/api/v1/catalog/dynamic-price-rules/{$rule['code']}", ['active' => true])->assertStatus(428);
    $this->patchJson("/api/v1/catalog/dynamic-price-rules/{$rule['code']}", ['active' => true], critical(99))->assertStatus(409);
    $this->patchJson("/api/v1/catalog/dynamic-price-rules/{$rule['code']}", ['active' => true, 'adjust_pct' => 25], critical($rule['lock_version']))
        ->assertOk()
        ->assertJsonPath('data.active', true)
        ->assertJsonPath('data.adjust_pct', '25.00');

    $this->getJson('/api/v1/catalog/dynamic-price-rules?filter[active]=1')->assertOk()->assertJsonPath('data', fn (array $rows) => collect($rows)->contains('code', $rule['code']));

    expect(crecbAudited(['entity' => 'Precio dinámico', 'entity_id' => $rule['code'], 'action' => 'editar']))->toBeTrue();
});

it('SC-12: el simulador suma los ajustes por prioridad y respeta el techo y el piso', function () {
    actingAsSeed('U02');
    crecbWithoutActiveRules();
    $last = $this->postJson('/api/v1/catalog/dynamic-price-rules', ['name' => 'Última hora', 'basis' => 'anticipacion', 'conditions' => ['days_before_lte' => 3], 'adjust_pct' => 30, 'active' => true, 'priority' => 10])->assertCreated()->json('data.code');
    $this->postJson('/api/v1/catalog/dynamic-price-rules', ['name' => 'Ocupación alta', 'basis' => 'ocupacion', 'conditions' => ['occupancy_gte' => 0.8], 'adjust_pct' => 40, 'ceiling_pct' => 50, 'active' => true, 'priority' => 20])->assertCreated();

    $result = $this->postJson('/api/v1/catalog/dynamic-price-rules/simulate', ['date' => crecbTravelDay(2), 'channel' => 'web', 'occupancy' => 0.9, 'base_price' => 100])
        ->assertOk()
        ->json('data');

    expect($result['applied'])->toHaveCount(2)
        ->and($result['applied'][0]['code'])->toBe($last)
        ->and($result['cumulative_pct'])->toBe('70.00')
        ->and($result['final_pct'])->toBe('50.00')
        ->and($result['clamped'])->toBeTrue()
        ->and($result['final_price'])->toBe('150.00');

    $this->postJson('/api/v1/catalog/dynamic-price-rules', ['name' => 'Martes flojo', 'basis' => 'dia_semana', 'conditions' => ['weekdays' => [1, 2, 3, 4, 5, 6, 7]], 'adjust_pct' => -45, 'floor_pct' => -20, 'channels' => ['b2b'], 'active' => true])->assertCreated();

    $this->postJson('/api/v1/catalog/dynamic-price-rules/simulate', ['date' => crecbTravelDay(40), 'channel' => 'b2b', 'base_price' => 200])
        ->assertOk()
        ->assertJsonPath('data.final_pct', '-20.00')
        ->assertJsonPath('data.final_price', '160.00');
});

it('rechaza condiciones que no corresponden a la base de la regla', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/dynamic-price-rules', ['name' => 'Mal armada', 'basis' => 'temporada', 'conditions' => ['from' => '12-15'], 'adjust_pct' => 10])->assertStatus(422);
    $this->postJson('/api/v1/catalog/dynamic-price-rules', ['name' => 'Mal armada', 'basis' => 'ocupacion', 'conditions' => ['weekdays' => [1]], 'adjust_pct' => 10])->assertStatus(422);
    $this->postJson('/api/v1/catalog/dynamic-price-rules/simulate', ['date' => crecbTravelDay(5), 'channel' => 'web'])->assertStatus(422);
});

it('Operaciones no gestiona precios dinámicos: 403', function () {
    actingAsSeed('U05');

    $response = $this->getJson('/api/v1/catalog/dynamic-price-rules');

    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('catalog.products.dynamic_pricing');
});
