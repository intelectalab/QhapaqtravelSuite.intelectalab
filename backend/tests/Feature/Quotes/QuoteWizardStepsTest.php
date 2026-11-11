<?php

use Illuminate\Support\Facades\DB;

function quoteStepBody(int $step, array $overrides = []): array
{
    return [
        'step' => $step,
        'client_code' => 'CLI-0003',
        'title' => 'Cusco clásico para dos',
        'currency' => 'USD',
        'travel_from' => '2026-09-30',
        'travel_to' => '2026-10-04',
        'pax_adt' => 2,
        'pax_chd' => 0,
        'pax_inf' => 0,
        'discount_pct' => 0,
        'tax_pct' => 18,
        'items' => [['product_code' => 'CUS-PKG-5D4N', 'date' => '2026-09-30', 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto', 'unit_price' => '500.00']],
        ...$overrides,
    ];
}

it('paso 1 del asistente exige cliente y título y no mira los ítems', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(1, ['client_code' => null, 'title' => '']))
        ->assertStatus(422)->assertJsonValidationErrors(['client_code', 'title']);

    $data = $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(1, ['travel_from' => null, 'travel_to' => null, 'items' => [['product_code' => 'NO-EXISTE', 'date' => '2026-09-30', 'qty' => 1, 'pax' => 1]]]))
        ->assertOk()->json('data');
    expect($data['lines'])->toBe([]);
});

it('paso 1 rechaza un cliente fuera de la cartera y una oportunidad de otro cliente', function () {
    actingAsSeed('U03');

    $response = $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(1, ['client_code' => 'CLI-0001']));
    expect($response)->toBeApiError(422, 'QTE-BR-09');
    expect($response->json('details'))->toMatchArray(['step' => 1, 'field' => 'client_code']);

    actingAsSeed('U01');
    $foreign = withinTenant(tenantA(), fn () => DB::table('crm_opportunities as o')->join('crm_clients as c', 'c.id', '=', 'o.client_id')
        ->whereNull('o.deleted_at')->whereNotIn('o.stage', ['ganada', 'perdida'])->where('c.code', '!=', 'CLI-0003')->value('o.code'));
    $mismatch = $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(1, ['opportunity_code' => $foreign]));
    expect($mismatch)->toBeApiError(422, 'QTE-BR-09');
    expect($mismatch->json('details'))->toMatchArray(['step' => 1, 'field' => 'opportunity_code']);
});

it('paso 2 exige fechas coherentes y al menos un pasajero', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(2, ['travel_from' => null]))
        ->assertStatus(422)->assertJsonValidationErrors('travel_from');
    $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(2, ['travel_to' => '2026-09-01']))
        ->assertStatus(422)->assertJsonValidationErrors('travel_to');
    $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(2, ['pax_adt' => 0]))
        ->assertStatus(422)->assertJsonValidationErrors('pax_adt');
    $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(2, ['items' => []]))->assertOk();
});

it('paso 3 exige ítems del catálogo y señala la línea con el problema', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(3, ['items' => []]))
        ->assertStatus(422)->assertJsonValidationErrors('items');

    $items = [quoteStepBody(3)['items'][0], ['product_code' => 'NO-EXISTE', 'date' => '2026-09-30', 'qty' => 1, 'pax' => 1]];
    $response = $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(3, ['items' => $items]));
    expect($response)->toBeApiError(422, 'QTE-BR-05');
    expect($response->json('details'))->toMatchArray(['step' => 3, 'field' => 'items.1.product_code']);

    $priced = $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(3, ['discount_pct' => 40]))->assertOk()->json('data');
    expect($priced['lines'][0]['total'])->toBe('1000.00')
        ->and($priced['totals']['discount_total'])->toBe('0.00');
});

it('paso 4 valida el descuento contra el tope del rol sin guardar nada', function () {
    actingAsSeed('U03');
    $before = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->count());

    $response = $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(4, ['discount_pct' => 12]));
    expect($response)->toBeApiError(422, 'QTE-BR-08');
    expect($response->json('details'))->toMatchArray(['step' => 4, 'field' => 'discount_pct']);

    $data = $this->postJson('/api/v1/quotes/pricing/preview', quoteStepBody(4, ['discount_pct' => 5]))->assertOk()->json('data');
    expect($data['totals']['discount_total'])->toBe('50.00')
        ->and(withinTenant(tenantA(), fn () => DB::table('quote_quotes')->count()))->toBe($before);
});
