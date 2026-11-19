<?php

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    withinTenant(tenantB(), fn () => DB::table('sys_booking_rules')->updateOrInsert(['tenant_id' => tenantB()->getKey(), 'code' => 'R-MARKETPLACE'], ['rule_group' => 'Funciones del plan', 'name' => 'Marketplace entre agencias', 'description' => 'Red B2B entre agencias para la prueba.', 'enabled' => true, 'params' => '{}', 'params_schema' => '{}', 'scope' => '{}', 'product_override' => false, 'is_custom' => false, 'min_plan' => 'Professional', 'sort_order' => 999]));
    RuleResolver::invalidate(tenantB()->getKey());
});

function mkpAlliance(object $test, string $productCode): array
{
    actingAsSeed('U01');
    $listing = $test->postJson('/api/v1/marketplace/listings', ['product' => $productCode, 'reseller_commission_pct' => 15])->assertCreated()->json('data');

    actingAsTenantBAdmin();
    $partnership = $test->postJson('/api/v1/marketplace/partnerships', ['listing' => $listing['id']])->assertCreated()->json('data');

    actingAsSeed('U01');
    $test->postJson("/api/v1/marketplace/partnerships/{$partnership['id']}/decide", ['decision' => 'aceptar'])->assertOk();

    return $listing;
}

function mkpClientOfB(): string
{
    return withinTenant(tenantB(), fn () => (string) DB::table('crm_clients')->insertGetId([
        'code' => 'CLI-9'.random_int(100, 999),
        'kind' => 'persona',
        'name' => 'Lucía Paredes Rojas',
        'doc_type' => 'DNI',
        'doc_number' => (string) random_int(40000000, 49999999),
        'email' => 'lucia.paredes@correo.pe',
        'country' => 'Perú',
        'segment_code' => 'Directo',
        'owner_id' => seedUser('U01', tenantB())->getKey(),
        'tags' => '{}',
    ]));
}

function mkpOrder(string $id): object
{
    return DB::connection('pgsql_platform')->table('platform_marketplace_orders')->where('id', $id)->first();
}

it('SC-11: la venta con cupo crea la reserva en el vendedor y la espejo en el revendedor, una sola vez por clave', function () {
    $product = (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('availability_model', '<>', 'POR_SALIDA')->orderBy('code')->value('code'));
    $listing = mkpAlliance($this, $product);
    $clientId = mkpClientOfB();

    actingAsTenantBAdmin();
    $this->getJson('/api/v1/marketplace/listings')->assertOk()->assertJsonFragment(['value' => withinTenant(tenantB(), fn () => DB::table('crm_clients')->where('id', $clientId)->value('code'))]);
    $this->postJson('/api/v1/marketplace/orders', ['listing' => $listing['id'], 'pax' => 2, 'travel_date' => now()->addDays(20)->toDateString(), 'gross_amount' => 500], critical())->assertStatus(422);

    $key = idem('mkp-res');
    $body = ['listing' => $listing['id'], 'client_id' => $clientId, 'pax' => 2, 'travel_date' => now()->addDays(20)->toDateString(), 'gross_amount' => 500];
    $order = $this->postJson('/api/v1/marketplace/orders', $body, critical(null, $key))
        ->assertCreated()
        ->assertJsonPath('data.status', 'confirmada')
        ->assertJsonPath('data.commission_amount', '75.00')
        ->json('data');

    $row = mkpOrder($order['id']);
    expect($row->seller_reservation_ref)->not->toBeNull()->and($row->reseller_reservation_ref)->not->toBeNull();

    $mirror = withinTenant(tenantB(), fn () => DB::table('booking_reservations')->where('id', $row->reseller_reservation_ref)->first());
    expect($order['reservation'])->toBe($mirror->code)
        ->and($mirror->status)->toBe('confirmada')
        ->and($mirror->client_id)->toBe($clientId)
        ->and((string) $mirror->total_amount)->toBe('500.00');
    $mirrorService = withinTenant(tenantB(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $mirror->id)->first());
    expect((string) $mirrorService->cost_amount)->toBe('425.00')->and((string) $mirrorService->price_amount)->toBe('500.00');
    expect(withinTenant(tenantB(), fn () => (string) DB::table('fin_receivables')->where('reservation_id', $mirror->id)->sum('amount')))->toBe('500.00');

    $seller = withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->where('r.id', $row->seller_reservation_ref)->first(['r.*', 'c.doc_number', 'c.doc_type']));
    expect($seller->status)->toBe('confirmada')
        ->and($seller->channel)->toBe('B2B')
        ->and((string) $seller->total_amount)->toBe('425.00')
        ->and($seller->doc_type)->toBe('RUC')
        ->and($seller->doc_number)->toBe((string) tenantB()->ruc);
    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $seller->id)->count()))->toBeGreaterThan(0)
        ->and(withinTenant(tenantA(), fn () => (string) DB::table('fin_receivables')->where('reservation_id', $seller->id)->sum('amount')))->toBe('425.00')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $seller->id)->count()))->toBe(2)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Reserva')->where('entity_id', $seller->code)->where('action', 'crear_marketplace')->exists()))->toBeTrue()
        ->and(withinTenant(tenantB(), fn () => DB::table('booking_reservations')->where('id', $row->seller_reservation_ref)->exists()))->toBeFalse();

    $this->postJson('/api/v1/marketplace/orders', $body, critical(null, $key))->assertJsonPath('data.id', $order['id']);
    expect(withinTenant(tenantB(), fn () => DB::table('booking_reservations')->where('notes', 'like', "%{$order['code']}%")->count()))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('notes', 'like', "%{$order['code']}%")->count()))->toBe(1);

    actingAsSeed('U01');
    $sold = collect($this->getJson('/api/v1/marketplace/orders')->assertOk()->json('data.orders'))->firstWhere('id', $order['id']);
    expect($sold['role'])->toBe('venta')->and($sold['reservation'])->toBe($seller->code);
});

it('SC-11: con salida programada toma el cupo; sin cupo la venta queda rechazada y no crea reservas', function () {
    $product = withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('availability_model', 'POR_SALIDA')->orderBy('code')->first(['id', 'code']));
    $departure = withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', '>', now()->toDateString())->whereNotIn('status', ['cerrada', 'cancelada', 'completa'])->whereRaw('capacity - sold >= 3')->orderBy('departure_date')->first());
    $listing = mkpAlliance($this, $product->code);
    $clientId = mkpClientOfB();

    actingAsTenantBAdmin();
    $this->postJson('/api/v1/marketplace/orders', ['listing' => $listing['id'], 'client_id' => $clientId, 'pax' => 2, 'travel_date' => $departure->departure_date, 'gross_amount' => 400], critical())
        ->assertCreated()->assertJsonPath('data.status', 'confirmada');
    expect(withinTenant(tenantA(), fn () => (int) DB::table('catalog_product_departures')->where('id', $departure->id)->value('sold')))->toBe((int) $departure->sold + 2)
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_inventory_holds')->where('departure_id', $departure->id)->where('pax', 2)->exists()))->toBeTrue();

    withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $departure->id)->update(['sold' => DB::raw('capacity')]));
    $before = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->count());

    $key = idem('mkp-full');
    expect($this->postJson('/api/v1/marketplace/orders', ['listing' => $listing['id'], 'client_id' => $clientId, 'pax' => 1, 'travel_date' => $departure->departure_date, 'gross_amount' => 200], critical(null, $key)))->toBeApiError(409);

    $rejected = DB::connection('pgsql_platform')->table('platform_marketplace_orders')->where('idempotency_key', $key)->first();
    expect($rejected->status)->toBe('rechazada')
        ->and($rejected->seller_reservation_ref)->toBeNull()
        ->and($rejected->reseller_reservation_ref)->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->count()))->toBe($before);
});

it('el revendedor solo vende a clientes de su propia agencia', function () {
    $product = (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('availability_model', '<>', 'POR_SALIDA')->orderBy('code')->value('code'));
    $listing = mkpAlliance($this, $product);
    $foreign = (string) withinTenant(tenantA(), fn () => DB::table('crm_clients')->whereNull('deleted_at')->value('id'));

    actingAsTenantBAdmin();
    expect($this->postJson('/api/v1/marketplace/orders', ['listing' => $listing['id'], 'client_id' => $foreign, 'pax' => 1, 'travel_date' => now()->addDays(10)->toDateString(), 'gross_amount' => 100], critical()))->toBeApiError(422);
});
