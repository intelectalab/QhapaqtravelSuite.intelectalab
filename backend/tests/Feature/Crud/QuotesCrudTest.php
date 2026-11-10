<?php

use Illuminate\Support\Facades\DB;

function ventasAudit(string $entityId, string $action): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', $entityId)->where('action', $action)->orderByDesc('occurred_at')->first());
}

function previewBody(array $overrides = []): array
{
    return [
        'currency' => 'USD',
        'discount_pct' => 0,
        'tax_pct' => 18,
        'items' => [
            ['product_code' => 'CUS-PKG-5D4N', 'date' => '2026-09-30', 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto', 'unit_price' => '500.00'],
            ['product_code' => 'CUS-PKG-5D4N', 'date' => '2026-10-01', 'qty' => 2, 'pax' => 1, 'segment' => 'Adulto', 'unit_price' => '120.50'],
        ],
        ...$overrides,
    ];
}

it('la vista previa de precios calcula subtotal, descuento, IGV y total sin guardar nada', function () {
    actingAsSeed('U03');
    $before = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->count());

    $data = $this->postJson('/api/v1/quotes/pricing/preview', previewBody(['discount_pct' => 5]))->assertOk()->json('data');

    expect(collect($data['lines'])->pluck('total')->all())->toBe(['1000.00', '241.00'])
        ->and($data['totals']['sale_total'])->toBe('1241.00')
        ->and($data['totals']['discount_total'])->toBe('62.05')
        ->and($data['totals']['net_total'])->toBe('1178.95')
        ->and($data['totals']['tax_total'])->toBe('212.21')
        ->and($data['totals']['grand_total'])->toBe('1391.16')
        ->and(collect($data['lines'])->pluck('price_source')->unique()->all())->toBe(['manual'])
        ->and(withinTenant(tenantA(), fn () => DB::table('quote_quotes')->count()))->toBe($before);
});

it('la vista previa marca que necesita aprobación interna cuando el descuento supera el 5 %', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/quotes/pricing/preview', previewBody(['discount_pct' => 6]))->assertOk()->json('data.needs_internal_approval'))->toBeTrue();
});

it('la vista previa rechaza un descuento por encima del tope de Ventas', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/quotes/pricing/preview', previewBody(['discount_pct' => 12])))->toBeApiError(422, 'QTE-BR-08');
});

it('la vista previa valida la moneda y el servicio del catálogo', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/quotes/pricing/preview', previewBody(['currency' => 'EUR']))->assertStatus(422)->assertJsonValidationErrors('currency');
    $items = [['product_code' => 'NO-EXISTE', 'date' => '2026-09-30', 'qty' => 1, 'pax' => 1]];
    expect($this->postJson('/api/v1/quotes/pricing/preview', previewBody(['items' => $items])))->toBeApiError(422, 'QTE-BR-05');
});

it('Operaciones no puede pedir la vista previa de precios', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/quotes/pricing/preview', previewBody()))->toBeApiError(403);
});

it('registrar una negociación pasa la cotización y su oportunidad a Negociación y deja auditoría', function () {
    actingAsSeed('U03');
    $quote = rowOf('quote_quotes', 'COT-2026-00188');

    $this->postJson('/api/v1/quotes/COT-2026-00188/negotiations', ['channel' => 'Llamada', 'note' => 'Pide cambiar el hotel en Cusco'])->assertOk();

    $opportunity = withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->where('id', $quote->opportunity_id)->first());
    $negotiation = withinTenant(tenantA(), fn () => DB::table('quote_negotiations')->where('quote_id', $quote->id)->orderByDesc('created_at')->first());

    expect(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('negociacion')
        ->and($opportunity->stage)->toBe('negociacion')
        ->and((int) $opportunity->probability)->toBe(70)
        ->and($negotiation->channel)->toBe('Llamada')
        ->and($negotiation->note)->toBe('Pide cambiar el hotel en Cusco')
        ->and($negotiation->recorded_by)->toBe(seedUser('U03')->id)
        ->and(ventasAudit('COT-2026-00188', 'negociacion')?->before_value)->toBe('enviada')
        ->and(ventasAudit('OPP-0118', 'cambio_etapa')?->after_value)->toBe('negociacion');
    $this->getJson('/api/v1/quotes/COT-2026-00188')->assertOk()->assertJsonPath('data.status', 'negociacion');
});

it('una segunda negociación no retrocede la etapa de la oportunidad', function () {
    actingAsSeed('U02');
    $quote = rowOf('quote_quotes', 'COT-2026-00191');

    $this->postJson('/api/v1/quotes/COT-2026-00191/negotiations', ['channel' => 'Email', 'note' => 'Acepta si se incluye el traslado'])->assertOk();

    expect(rowOf('quote_quotes', 'COT-2026-00191')->status)->toBe('negociacion')
        ->and(withinTenant(tenantA(), fn () => DB::table('quote_negotiations')->where('quote_id', $quote->id)->count()))->toBeGreaterThan(0);
});

it('no se registra negociación en un borrador ni en una cotización vencida', function () {
    actingAsSeed('U03');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/negotiations', ['channel' => 'Llamada', 'note' => 'Pide rebaja']))->toBeApiError(409, 'QTE-BR-16');

    actingAsSeed('U02');
    expect($this->postJson('/api/v1/quotes/COT-2026-00182/negotiations', ['channel' => 'Llamada', 'note' => 'Pide rebaja']))->toBeApiError(409, 'QTE-BR-16');
    expect(rowOf('quote_quotes', 'COT-2026-00189')->status)->toBe('borrador');
});

it('la negociación valida canal y nota', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/quotes/COT-2026-00188/negotiations', ['channel' => 'Fax', 'note' => 'ok'])->assertStatus(422)->assertJsonValidationErrors(['channel', 'note']);
    expect(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('enviada');
});

it('Ventas no registra negociaciones en la cartera de otro asesor', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/quotes/COT-2026-00190/negotiations', ['channel' => 'Llamada', 'note' => 'Pide rebaja']))->toBeApiError(403, 'SEC-BR-09');
    expect(rowOf('quote_quotes', 'COT-2026-00190')->status)->toBe('vista');
});

it('Operaciones no registra negociaciones', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/quotes/COT-2026-00188/negotiations', ['channel' => 'Llamada', 'note' => 'Pide rebaja']))->toBeApiError(403);
});

it('eliminar una cotización en borrador es lógico, la saca de la lista y queda en auditoría', function () {
    actingAsSeed('U03');

    $this->deleteJson('/api/v1/quotes/COT-2026-00189', ['reason' => 'El cliente desistió del viaje'])->assertOk();

    $row = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00189')->first());
    $codes = collect($this->getJson('/api/v1/quotes?page[size]=100')->assertOk()->json('data'))->pluck('code');

    expect($row)->not->toBeNull()
        ->and($row->deleted_at)->not->toBeNull()
        ->and($codes)->not->toContain('COT-2026-00189')
        ->and(ventasAudit('COT-2026-00189', 'eliminar')?->after_value)->toBe('El cliente desistió del viaje');
    $this->getJson('/api/v1/quotes/COT-2026-00189')->assertNotFound();
});

it('no se elimina una cotización aprobada ni una convertida en reserva', function () {
    actingAsSeed('U03');
    approvedQuote('COT-2026-00188');

    expect($this->deleteJson('/api/v1/quotes/COT-2026-00188', ['reason' => 'Prueba de borrado']))->toBeApiError(409, 'QTE-BR-25');
    expect($this->deleteJson('/api/v1/quotes/COT-2026-00183', ['reason' => 'Prueba de borrado']))->toBeApiError(409, 'QTE-BR-25');
    expect(rowOf('quote_quotes', 'COT-2026-00188')->deleted_at)->toBeNull()
        ->and(rowOf('quote_quotes', 'COT-2026-00183')->deleted_at)->toBeNull();
});

it('eliminar exige el motivo', function () {
    actingAsSeed('U03');

    $this->deleteJson('/api/v1/quotes/COT-2026-00189')->assertStatus(422)->assertJsonValidationErrors('reason');
    expect(rowOf('quote_quotes', 'COT-2026-00189')->deleted_at)->toBeNull();
});

it('Ventas no elimina cotizaciones de otro asesor y Operaciones no elimina ninguna', function () {
    actingAsSeed('U04');
    expect($this->deleteJson('/api/v1/quotes/COT-2026-00189', ['reason' => 'No es mía']))->toBeApiError(403, 'SEC-BR-09');

    actingAsSeed('U05');
    expect($this->deleteJson('/api/v1/quotes/COT-2026-00189', ['reason' => 'No me toca']))->toBeApiError(403);
    expect(rowOf('quote_quotes', 'COT-2026-00189')->deleted_at)->toBeNull();
});
