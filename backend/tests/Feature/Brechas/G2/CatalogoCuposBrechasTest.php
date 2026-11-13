<?php

use App\Jobs\ReleaseAllotments;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function g2Audit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function g2Rate(string $productId, string $ref, string $channel, string $segment, string $price, string $type = 'Venta'): void
{
    withinTenant(tenantA(), fn () => DB::table('catalog_rates')->insert([
        'ref' => $ref, 'product_id' => $productId, 'rate_type' => $type, 'segment' => $segment, 'channel' => $channel, 'currency' => 'PEN',
        'price_basis' => 'Por persona', 'cost' => '10.00', 'price' => $price, 'valid_from' => '2020-01-01', 'valid_to' => '2099-12-31', 'status' => 'vigente',
    ]));
}

function g2Lock(string $code): int
{
    return (int) rowOf('catalog_products', $code)->lock_version;
}

it('G2-02: elimina una temporada sin uso y bloquea la que usan tarifas o productos', function () {
    actingAsSeed('U01');

    $ref = $this->postJson('/api/v1/catalog/seasons', ['name' => 'Temporada G2 sin uso', 'type' => 'Fecha especial', 'date_from' => '2031-03-01', 'date_to' => '2031-03-10', 'priority' => 41, 'factor' => 1.1])->assertCreated()->json('data.ref');

    $this->deleteJson("/api/v1/catalog/seasons/{$ref}", [], critical())->assertNoContent();
    expect(g2Audit(['entity' => 'Temporada', 'entity_id' => $ref, 'action' => 'eliminar']))->toBeTrue();

    $used = withinTenant(tenantA(), fn () => DB::table('catalog_product_seasons as ps')->join('catalog_seasons as s', 's.id', '=', 'ps.season_id')->whereNull('s.deleted_at')->value('s.ref'));
    expect($this->deleteJson("/api/v1/catalog/seasons/{$used}", [], critical()))->toBeApiError(409, 'CAT-SEASON-IN-USE');
});

it('G2-03: resuelve la temporada que aplica en una fecha', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/catalog/seasons/resolve?date=2026-12-24')->assertOk()->json('data');

    expect($data)->toHaveKeys(['date', 'season', 'factor', 'others', 'rule'])->and($data['date'])->toBe('2026-12-24');
});

it('G2-18: el precio desde prefiere la tarifa Directo de adulto aunque haya otra más barata en otro canal', function () {
    actingAsSeed('U01');
    $product = rowOf('catalog_products', 'CUS-HUM-FD');
    withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', $product->id)->update(['status' => 'inactiva']));
    g2Rate($product->id, 'TAR-G2-01', 'E-commerce', 'Adulto', '50.00');
    g2Rate($product->id, 'TAR-G2-02', 'Directo', 'Adulto', '90.00');
    g2Rate($product->id, 'TAR-G2-03', 'B2B', 'Adulto', '20.00', 'B2B');

    $row = collect($this->getJson('/api/v1/catalog/products')->assertOk()->json('data'))->firstWhere('code', 'CUS-HUM-FD');
    expect($row['price_from']['amount'])->toBe('90.00')->and($row['price_from']['channel'])->toBe('Directo');
    expect($this->getJson('/api/v1/catalog/products/CUS-HUM-FD')->assertOk()->json('data.price_from.amount'))->toBe('90.00');

    withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('ref', 'TAR-G2-02')->update(['status' => 'inactiva']));
    $row = collect($this->getJson('/api/v1/catalog/products')->json('data'))->firstWhere('code', 'CUS-HUM-FD');
    expect($row['price_from']['amount'])->toBe('20.00');

    actingAsSeed('U03');
    $row = collect($this->getJson('/api/v1/catalog/products')->assertOk()->json('data'))->firstWhere('code', 'CUS-HUM-FD');
    expect($row['price_from']['amount'])->toBe('50.00');
});

it('G2-26 y G2-29: las tarifas traen el estado del producto y el proveedor lista también los productos donde es componente', function () {
    actingAsSeed('U01');

    $rate = $this->getJson('/api/v1/catalog/rates')->assertOk()->json('data.rates.0');
    expect($rate['product'])->toHaveKey('status');

    $providers = collect($this->getJson('/api/v1/catalog/providers')->assertOk()->json('data.providers'));
    $roles = $providers->flatMap(fn (array $provider) => collect($provider['products'])->pluck('role'))->unique()->values()->all();
    expect($roles)->toContain('componente');
});

it('G2-04: los productos del destino traen su relación y su precio desde', function () {
    actingAsSeed('U01');

    $nodes = collect($this->getJson('/api/v1/catalog/destinations')->assertOk()->json('data.destinations'));
    $product = $nodes->flatMap(fn (array $node) => $node['products'])->first();

    expect($product)->toHaveKeys(['relation', 'price_from'])->and(['principal', 'secundario', 'subdestino'])->toContain($product['relation']);
});

it('G2-07: cambiar el proveedor principal con motivo queda auditado como cambio de proveedor', function () {
    actingAsSeed('U01');
    $provider = withinTenant(tenantA(), fn () => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->where('contract_end', '>=', '2027-01-01')
        ->where('id', '<>', rowOf('catalog_products', 'CUS-HUM-FD')->main_provider_id)->value('id'));

    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/main-provider', ['main_provider_id' => $provider, 'reason' => 'Mejor tarifa negociada', 'lock_version' => g2Lock('CUS-HUM-FD')], critical(g2Lock('CUS-HUM-FD')))->assertOk();

    expect(g2Audit(['entity' => 'Producto', 'entity_id' => 'CUS-HUM-FD', 'action' => 'cambio_proveedor']))->toBeTrue();
    $providers = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/overview')->assertOk()->json('data.providers');
    expect($providers[0])->toHaveKeys(['ruc', 'contract_days', 'payment_terms', 'rating']);
});

it('G2-06: eliminar un producto en uso devuelve dónde se usa y deja la auditoría del intento', function () {
    actingAsSeed('U01');

    $response = $this->deleteJson('/api/v1/catalog/products/SUR-CIR-8D', ['reason' => 'Prueba G2'], critical(g2Lock('SUR-CIR-8D')));

    expect($response)->toBeApiError(409, 'PRD-BR-018');
    expect($response->json('details'))->toHaveKeys(['quotes', 'reservations', 'operations', 'packages', 'can_archive']);
    expect(auditExists(['entity' => 'Producto', 'entity_id' => 'SUR-CIR-8D', 'action' => 'eliminacion_bloqueada']))->toBeTrue();
    expect(rowOf('catalog_products', 'SUR-CIR-8D')->deleted_at)->toBeNull();
});

it('G2-08 a G2-15: la ficha trae referencias, salidas con holds y recursos, historial con tarifas y precio resultante de promociones', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('catalog_products as p')->whereNull('p.deleted_at')->whereExists(fn ($query) => $query->from('catalog_product_departures as d')->whereColumn('d.product_id', 'p.id'))->value('p.code'));

    $data = $this->getJson("/api/v1/catalog/products/{$code}/overview")->assertOk()->json('data');

    expect($data)->toHaveKeys(['referenced_by', 'public_price', 'related', 'departures', 'history', 'promotions']);
    expect($data['departures'][0])->toHaveKeys(['held', 'available', 'guide', 'vehicle']);
    if ($data['history'] !== []) {
        expect($data['history'][0])->toHaveKeys(['scope', 'entity_id']);
    }
    foreach ($data['promotions'] as $promotion) {
        expect($promotion)->toHaveKey('result_price');
    }
});

it('G2-12: el contenido guarda las características destacadas', function () {
    actingAsSeed('U01');
    $content = $this->getJson('/api/v1/catalog/products/LOR-AMZ-4D/editor')->assertOk()->json('data.content');

    $body = [...$content, 'features' => ['Grupo reducido', 'Guía bilingüe'], 'lock_version' => g2Lock('LOR-AMZ-4D')];
    $state = $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/content', $body, critical(g2Lock('LOR-AMZ-4D')))->assertOk()->json('data.content');

    expect($state['features'])->toBe(['Grupo reducido', 'Guía bilingüe']);
});

it('G2-37: el release automático audita cada fecha liberada', function () {
    lockSeededBookings();
    lockScheduledJobs();
    freezeBusinessToday();
    $id = withinTenant(tenantA(), function (): string {
        $service = DB::table('catalog_services')->where('name', 'Noche en lodge flotante Uros')->first(['id', 'provider_id']);
        $id = (string) DB::table('catalog_allotments')->insertGetId([
            'code' => 'CUP-G2-REL', 'provider_id' => $service->provider_id, 'service_id' => $service->id, 'kind' => 'hotel', 'name' => 'Bloqueo G2',
            'valid_from' => '2026-09-01', 'valid_to' => '2026-12-31', 'base_qty' => 5, 'release_days' => 7, 'net_rate' => '100.00', 'penalty_pct' => '50.00',
            'currency' => 'PEN', 'status' => 'activo', 'owner_id' => seedUser('U01')->getKey(),
        ], 'id');
        DB::table('catalog_allotment_days')->insert(['allotment_id' => $id, 'service_date' => '2026-10-03', 'blocked_qty' => 5, 'used_qty' => 0, 'release_deadline' => '2026-09-26', 'retained_at' => null, 'retained_reason' => null]);

        return $id;
    });

    dispatch_sync((new ReleaseAllotments)->forTenant((string) tenantA()->getKey()));

    expect($id)->not->toBe('')->and(g2Audit(['entity' => 'Cupo', 'entity_id' => 'CUP-G2-REL', 'action' => 'release_automatico']))->toBeTrue();
});
