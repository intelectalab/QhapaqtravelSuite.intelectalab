<?php

use Illuminate\Support\Facades\DB;

function linePricingBody(array $item = [], array $overrides = []): array
{
    return [
        'client_code' => 'CLI-0012',
        'title' => 'Machu Picchu en el día',
        'currency' => 'USD',
        'travel_from' => '2026-12-10',
        'travel_to' => '2026-12-12',
        'pax_adt' => 2,
        'items' => [['product_code' => 'CUS-MAPI-FD', 'date' => '2026-12-10', 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto', ...$item]],
        ...$overrides,
    ];
}

function rateIdOf(string $ref): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('ref', $ref)->value('id'));
}

it('PRC-02: sin tarifa elegida usa la del canal del cliente y la devuelve en la vista previa', function () {
    actingAsSeed('U03');

    $direct = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody())->assertOk()->json('data.lines.0');
    expect($direct['rate_ref'])->toBe('TAR-001')->and($direct['price_source'])->toBe('rate');

    $corporate = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody([], ['client_code' => 'CLI-0004']))->assertOk()->json('data.lines.0');
    expect($corporate['rate_ref'])->toBe('TAR-005')
        ->and((float) $corporate['rate_price'])->toBeLessThan((float) $direct['rate_price']);
});

it('K5: la tarifa elegida por línea se guarda con rate_id y rate_snapshot', function () {
    actingAsSeed('U03');

    $code = $this->postJson('/api/v1/quotes', linePricingBody(['rate_id' => rateIdOf('TAR-003')]))->assertCreated()->json('data.code');

    $item = withinTenant(tenantA(), fn () => DB::table('quote_items as i')->join('quote_quotes as q', 'q.current_version_id', '=', 'i.quote_version_id')->where('q.code', $code)->first(['i.rate_id', 'i.rate_snapshot', 'i.price_source']));
    expect($item->rate_id)->toBe(rateIdOf('TAR-003'))
        ->and(json_decode($item->rate_snapshot, true))->toMatchArray(['ref' => 'TAR-003', 'channel' => 'B2B', 'segment' => 'Adulto'])
        ->and($item->price_source)->toBe('rate');

    $detail = $this->getJson("/api/v1/quotes/{$code}")->assertOk()->json('data.versions.0.items.0');
    expect($detail['rate_ref'])->toBe('TAR-003');
});

it('QTE-BR-06: una tarifa no vigente para la fecha de la línea se rechaza', function () {
    actingAsSeed('U03');

    $response = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody(['rate_id' => rateIdOf('TAR-004')]));
    expect($response)->toBeApiError(422, 'QTE-BR-06');
    expect($response->json('details.field'))->toBe('items.0.rate_id');
});

it('K4: quien ve costos edita el costo unitario y el margen real dispara la aprobación de gerencia', function () {
    actingAsSeed('U02');

    $data = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody(['rate_id' => null, 'unit_price' => '300', 'unit_cost' => '280']))->assertOk()->json('data');
    expect($data['lines'][0]['price_source'])->toBe('manual')
        ->and($data['lines'][0]['rate_id'])->toBeNull()
        ->and($data['lines'][0]['unit_cost'])->toBe('280.00')
        ->and($data['needs_internal_approval'])->toBeTrue();

    $later = ['travel_from' => '2027-06-10', 'travel_to' => '2027-06-12'];
    $missing = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody(['date' => '2027-06-10', 'rate_id' => null, 'unit_price' => '300'], $later));
    expect($missing)->toBeApiError(422, 'QTE-BR-07');
    expect($missing->json('details.field'))->toBe('items.0.unit_cost');

    $typed = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody(['date' => '2027-06-10', 'rate_id' => null, 'unit_price' => '300', 'unit_cost' => '200'], $later))->assertOk()->json('data');
    expect($typed['totals']['margin_pct'])->toBe('33.33')->and($typed['needs_internal_approval'])->toBeFalse();
});

it('K4: Ventas no sobrescribe el costo y el precio manual conserva el costo de la tarifa', function () {
    actingAsSeed('U03');

    $code = $this->postJson('/api/v1/quotes', linePricingBody(['rate_id' => null, 'unit_price' => '300', 'unit_cost' => '1']))->assertCreated()->json('data.code');

    $item = withinTenant(tenantA(), fn () => DB::table('quote_items as i')->join('quote_quotes as q', 'q.current_version_id', '=', 'i.quote_version_id')->where('q.code', $code)->first(['i.unit_cost', 'i.rate_id', 'i.price_source']));
    expect((float) $item->unit_cost)->toBeGreaterThan(1.0)
        ->and($item->rate_id)->toBeNull()
        ->and($item->price_source)->toBe('manual');
});

it('PRC-07: el IGV va a 0 para el cliente extranjero, al valor de la agencia para el peruano y admite de 0 a 18', function () {
    actingAsSeed('U03');

    $foreign = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody([], ['client_code' => 'CLI-0003']))->assertOk()->json('data');
    expect($foreign['totals']['tax_pct'])->toBe('0.00')->and($foreign['tax_default'])->toBe('0');

    $local = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody())->assertOk()->json('data');
    expect($local['totals']['tax_pct'])->toBe('18.00');

    $custom = $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody([], ['tax_pct' => 10.5]))->assertOk()->json('data');
    expect($custom['totals']['tax_pct'])->toBe('10.50');

    $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody([], ['tax_pct' => 19]))->assertStatus(422)->assertJsonValidationErrors('tax_pct');
    $this->postJson('/api/v1/quotes/pricing/preview', linePricingBody([], ['discount_pct' => 60]))->assertStatus(422)->assertJsonValidationErrors('discount_pct');
});

it('la validez por defecto y las condiciones comerciales salen de la configuración y del constructor', function () {
    actingAsSeed('U03');
    $days = withinTenant(tenantA(), fn () => (int) (json_decode((string) DB::table('sys_settings')->where('section', 'policies')->value('values'), true)['quote_validity_days'] ?? 10));

    $options = $this->getJson('/api/v1/quotes/form-options')->assertOk()->json('data');
    expect($options['defaults']['validity_days'])->toBe($days)
        ->and(collect($options['products'])->firstWhere('code', 'CUS-MAPI-FD')['rates'])->not->toBeEmpty()
        ->and(collect($options['clients'])->firstWhere('code', 'CLI-0003')['domestic'])->toBeFalse();

    $code = $this->postJson('/api/v1/quotes', linePricingBody([], ['conditions' => 'Anticipo de 40 % para confirmar.']))->assertCreated()->json('data.code');
    expect($this->getJson("/api/v1/quotes/{$code}")->json('data.versions.0.conditions'))->toBe('Anticipo de 40 % para confirmar.');
});
