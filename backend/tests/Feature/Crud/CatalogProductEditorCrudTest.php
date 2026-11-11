<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function edRef(string $table, string $ref): string
{
    return rowOf($table, $ref, column: 'ref')->id;
}

function edProduct(string $code): ?object
{
    return rowOf('catalog_products', $code);
}

function edLock(string $code): int
{
    return (int) edProduct($code)->lock_version;
}

function edBody(string $code, array $body): array
{
    return ['lock_version' => edLock($code), ...$body];
}

function edHeaders(string $code): array
{
    return critical(edLock($code));
}

function edAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function edCount(string $table, string $code): int
{
    $id = edProduct($code)->id;

    return withinTenant(tenantA(), fn () => DB::table($table)->where('product_id', $id)->count());
}

function edMaster(array $overrides = []): array
{
    $base = edProduct('CUS-HUM-FD');

    return [
        'name' => 'Valle Sur y Tipón',
        'code' => 'CUS-VSU-FD',
        'type_id' => $base->product_type_id,
        'category_id' => $base->category_id,
        'destination_id' => $base->primary_destination_id,
        'duration_value' => 1,
        'duration_unit' => 'días',
        'modality' => 'Compartido',
        'minimum_passengers' => 2,
        'maximum_passengers' => 12,
        'minimum_age' => 6,
        'maximum_age' => 80,
        'booking_advance_min_days' => 1,
        'booking_advance_max_days' => 180,
        'is_bookable' => true,
        'is_quoteable' => true,
        'is_featured' => true,
        ...$overrides,
    ];
}

function edContent(array $overrides = []): array
{
    return [
        'long_description' => 'Recorrido por el valle sur del Cusco con visita a Tipón y Pikillaqta.',
        'seo_title' => 'Valle Sur y Tipón',
        'seo_description' => 'Tour de un día al valle sur del Cusco.',
        'slug' => 'valle-sur-y-tipon',
        'video_url' => null,
        'inclusions' => ['Transporte turístico', 'Guía oficial'],
        'exclusions' => ['Propinas', 'Bebidas'],
        'requirements' => [['category' => 'Equipamiento', 'text' => 'Zapatillas de caminata']],
        'faqs' => [['question' => '¿Incluye almuerzo?', 'answer' => 'No, se puede comprar en ruta.']],
        'media' => [['url' => 'https://images.example.com/tipon.jpg', 'alt_text' => 'Andenes de Tipón', 'is_main' => true]],
        ...$overrides,
    ];
}

function edFullPayload(array $overrides = []): array
{
    return edMaster([
        'secondary_destination_ids' => [edRef('catalog_destinations', 'D14')],
        'components' => [
            ['service_id' => edRef('catalog_services', 'SRV-002'), 'quantity' => 1, 'is_required' => true, 'is_included' => true],
            ['service_id' => edRef('catalog_services', 'SRV-006'), 'quantity' => 1, 'is_required' => true, 'is_included' => true],
        ],
        'itinerary' => [
            ['title' => 'Cusco — Tipón — Pikillaqta', 'items' => [['time' => '08:00', 'activity' => 'Recojo del hotel', 'type' => 'Traslado', 'location' => 'Cusco'], ['time' => '10:00', 'activity' => 'Visita a Tipón', 'type' => 'Actividad', 'location' => 'Tipón']]],
        ],
        'rates' => [
            ['rate_type' => 'Venta', 'segment' => 'Adulto', 'channel' => 'Directo', 'currency' => 'PEN', 'cost' => 90, 'price' => 150, 'valid_from' => '2026-11-15', 'valid_to' => '2026-12-31'],
        ],
        'season_ids' => [edRef('catalog_seasons', 'TMP-02')],
        'availability' => ['model' => 'CAPACIDAD', 'capacity' => 20, 'source' => 'interna'],
        'content' => edContent(),
        'policies' => ['cancellation' => 'Sin costo hasta 48 horas antes.', 'modification' => 'Cambios hasta 24 horas antes.', 'no_show' => 'Se cobra el 100 %.', 'refund' => 'Reembolso en 7 días hábiles.'],
        'channels' => ['crm', 'quotes', 'b2b'],
        ...$overrides,
    ]);
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('crea el producto del asistente en un solo envío con todas sus secciones', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/products', edFullPayload(), critical())->assertCreated()->assertJsonPath('data.code', 'CUS-VSU-FD');

    $product = edProduct('CUS-VSU-FD');
    [$channels, $policy] = withinTenant(tenantA(), fn () => [
        DB::table('catalog_product_channels')->where('product_id', $product->id)->orderBy('channel')->pluck('is_published', 'channel')->all(),
        DB::table('catalog_product_policies')->where('product_id', $product->id)->value('cancellation'),
    ]);

    expect($product->status)->toBe('DRAFT')
        ->and((bool) $product->is_featured)->toBeTrue()
        ->and($product->availability_model)->toBe('CAPACIDAD')
        ->and((int) $product->availability_capacity)->toBe(20)
        ->and($product->slug)->toBe('valle-sur-y-tipon')
        ->and($product->main_provider_id)->toBe(rowOf('catalog_providers', 'PRV-004', column: 'ref')->id)
        ->and(edCount('catalog_product_items', 'CUS-VSU-FD'))->toBe(2)
        ->and(edCount('catalog_product_destinations', 'CUS-VSU-FD'))->toBe(1)
        ->and(edCount('catalog_rates', 'CUS-VSU-FD'))->toBe(1)
        ->and(edCount('catalog_product_seasons', 'CUS-VSU-FD'))->toBe(1)
        ->and(edCount('catalog_product_inclusions', 'CUS-VSU-FD'))->toBe(4)
        ->and(edCount('catalog_product_faqs', 'CUS-VSU-FD'))->toBe(1)
        ->and(edCount('catalog_product_media', 'CUS-VSU-FD'))->toBe(1)
        ->and($policy)->toBe('Sin costo hasta 48 horas antes.')
        ->and($channels)->toBe(['b2b' => true, 'crm' => true, 'erp' => true, 'quotes' => true]);

    $editor = $this->getJson('/api/v1/catalog/products/CUS-VSU-FD/editor')->assertOk();
    expect($editor->json('data.itinerary.0.items'))->toHaveCount(2)
        ->and($editor->json('data.review.summary.components'))->toBe(2)
        ->and($editor->json('data.review.checklist.total'))->toBe(12);
});

it('la vista previa valida cada paso sin guardar nada y devuelve resumen y checklist', function () {
    actingAsSeed('U01');

    $step1 = $this->postJson('/api/v1/catalog/products/preview', [...edMaster(['code' => 'cus-hum-fd']), 'step' => 1]);
    expect($step1)->toBeApiError(422, 'CAT-BR-01')->and($step1->json('details.step'))->toBe(1);
    $this->postJson('/api/v1/catalog/products/preview', [...edMaster(['destination_id' => null, 'category_id' => null]), 'step' => 1])->assertOk()->assertJsonPath('data.review', null);
    $this->postJson('/api/v1/catalog/products/preview', [...edMaster(['category_id' => null]), 'step' => 2])->assertStatus(422)->assertJsonValidationErrors('category_id');

    $blocked = $this->postJson('/api/v1/catalog/products/preview', [...edFullPayload(['components' => [['service_id' => edRef('catalog_services', 'SRV-017'), 'quantity' => 1]]]), 'step' => 4]);
    expect($blocked)->toBeApiError(422, 'PRD-BR-007')->and($blocked->json('details.step'))->toBe(4);

    $preview = $this->postJson('/api/v1/catalog/products/preview', [...edFullPayload(), 'step' => 10])->assertOk();
    expect($preview->json('data.review.summary.rates'))->toBe(1)
        ->and($preview->json('data.review.summary.itinerary_days'))->toBe(1)
        ->and(collect($preview->json('data.review.checklist.items'))->firstWhere('key', 'status')['ok'])->toBeTrue()
        ->and(edProduct('CUS-VSU-FD'))->toBeNull()
        ->and(edAudit(['entity' => 'Producto', 'entity_id' => 'CUS-VSU-FD']))->toBeFalse();
});

it('valida tarifas y componentes del alta y ventas no puede usar el asistente', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/products', edFullPayload(['rates' => [['rate_type' => 'Venta', 'segment' => 'Adulto', 'channel' => 'Directo', 'cost' => 1, 'price' => 2, 'valid_from' => '2026-11-15', 'valid_to' => '2026-12-01']]]), critical())
        ->assertStatus(422)->assertJsonValidationErrors('rates.0.currency');
    $expired = $this->postJson('/api/v1/catalog/products', edFullPayload(['rates' => [['rate_type' => 'Venta', 'segment' => 'Adulto', 'channel' => 'Directo', 'currency' => 'USD', 'cost' => 1, 'price' => 2, 'valid_from' => '2026-01-01', 'valid_to' => '2026-02-01']]]), critical());
    expect($expired)->toBeApiError(422, 'PRD-BR-005')->and($expired->json('details.step'))->toBe(6);
    $twice = ['service_id' => edRef('catalog_services', 'SRV-002'), 'quantity' => 1];
    expect($this->postJson('/api/v1/catalog/products', edFullPayload(['components' => [$twice, $twice]]), critical()))->toBeApiError(422, 'CAT-BR-10');
    expect(edProduct('CUS-VSU-FD'))->toBeNull();

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/catalog/products/preview', [...edMaster(), 'step' => 1]))->toBeApiError(403);
});

it('guarda componentes y proveedor principal del producto con bloqueo optimista', function () {
    actingAsSeed('U01');
    $lock = edLock('LOR-AMZ-4D');
    $components = [['service_id' => edRef('catalog_services', 'SRV-016'), 'quantity' => 2, 'is_required' => true, 'is_included' => false, 'notes' => 'Salida 06:00']];
    $body = ['lock_version' => $lock, 'main_provider_id' => edRef('catalog_providers', 'PRV-012'), 'components' => $components];

    $response = $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/components', $body, critical($lock))->assertOk()->assertJsonPath('data.components.0.quantity', 2);
    expect($response->json('data.lock_version'))->toBeGreaterThan($lock)->toBe(edLock('LOR-AMZ-4D'))
        ->and(edCount('catalog_product_items', 'LOR-AMZ-4D'))->toBe(1)
        ->and(edProduct('LOR-AMZ-4D')->main_provider_id)->toBe(edRef('catalog_providers', 'PRV-012'))
        ->and(edAudit(['entity' => 'Producto', 'entity_id' => 'LOR-AMZ-4D', 'action' => 'modificar', 'after_value' => 'Agregó componente SRV-016 Tour Colca 2D/1N compartido (2 × '.rowOf('catalog_services', 'SRV-016', column: 'ref')->currency.' '.number_format((float) rowOf('catalog_services', 'SRV-016', column: 'ref')->cost, 2, '.', '').')']))->toBeTrue();

    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/components', $body, critical($lock)))->toBeApiError(409, 'STALE_VERSION');
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/components', edBody('LOR-AMZ-4D', ['components' => [['service_id' => edRef('catalog_services', 'SRV-017'), 'quantity' => 1]]]), edHeaders('LOR-AMZ-4D')))->toBeApiError(422, 'PRD-BR-007');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/components', edBody('LOR-AMZ-4D', ['components' => [['quantity' => 0]]]), edHeaders('LOR-AMZ-4D'))->assertStatus(422)->assertJsonValidationErrors(['components.0.service_id', 'components.0.quantity']);
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/components', edBody('LOR-AMZ-4D', ['components' => [['component_product_id' => edProduct('LOR-AMZ-4D')->id, 'quantity' => 1]]]), edHeaders('LOR-AMZ-4D')))->toBeApiError(422, 'CAT-BR-10');
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/components', edBody('LOR-AMZ-4D', ['components' => [['component_product_id' => edProduct('SUR-CIR-8D')->id, 'quantity' => 1]]]), edHeaders('LOR-AMZ-4D')))->toBeApiError(422, 'CAT-BR-10');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/components', edBody('LOR-AMZ-4D', ['components' => [...$components, ['component_product_id' => edProduct('CUS-HUM-FD')->id, 'quantity' => 1]]]), edHeaders('LOR-AMZ-4D'))->assertOk();
    expect(edCount('catalog_product_items', 'LOR-AMZ-4D'))->toBe(2);

    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/main-provider', edBody('LOR-AMZ-4D', ['main_provider_id' => edRef('catalog_providers', 'PRV-013')]), edHeaders('LOR-AMZ-4D')))->toBeApiError(422, 'PRD-BR-007');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/main-provider', edBody('LOR-AMZ-4D', ['main_provider_id' => null]), edHeaders('LOR-AMZ-4D'))->assertOk();
    expect(edProduct('LOR-AMZ-4D')->main_provider_id)->toBeNull();

    actingAsSeed('U03');
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/main-provider', edBody('LOR-AMZ-4D', ['main_provider_id' => null]), edHeaders('LOR-AMZ-4D')))->toBeApiError(403);
});

it('reemplaza el itinerario por días y actividades', function () {
    actingAsSeed('U01');
    $days = [
        ['title' => 'Llegada a Arequipa', 'items' => [['time' => '15:00', 'activity' => 'City tour', 'type' => 'Actividad', 'location' => 'Plaza de Armas'], ['time' => '09:00', 'activity' => 'Recojo en aeropuerto', 'type' => 'Traslado']]],
        ['title' => 'Cañón del Colca', 'items' => []],
    ];

    $response = $this->putJson('/api/v1/catalog/products/SUR-CIR-8D/itinerary', edBody('SUR-CIR-8D', ['itinerary' => $days]), edHeaders('SUR-CIR-8D'))->assertOk();
    expect($response->json('data.itinerary'))->toHaveCount(2)
        ->and($response->json('data.itinerary.0.items.0.activity'))->toBe('Recojo en aeropuerto')
        ->and(collect($response->json('data.review.checklist.items'))->firstWhere('key', 'itinerary')['ok'])->toBeFalse()
        ->and(edAudit(['entity' => 'Producto', 'entity_id' => 'SUR-CIR-8D', 'action' => 'modificar', 'after_value' => 'Agregó la actividad 09:00 Recojo en aeropuerto del día 1']))->toBeTrue();

    $this->putJson('/api/v1/catalog/products/SUR-CIR-8D/itinerary', edBody('SUR-CIR-8D', ['itinerary' => [['title' => 'X', 'items' => [['time' => '25:00', 'activity' => '']]]]]), edHeaders('SUR-CIR-8D'))
        ->assertStatus(422)->assertJsonValidationErrors(['itinerary.0.title', 'itinerary.0.items.0.time', 'itinerary.0.items.0.activity']);

    actingAsSeed('U03');
    expect($this->putJson('/api/v1/catalog/products/SUR-CIR-8D/itinerary', edBody('SUR-CIR-8D', ['itinerary' => []]), edHeaders('SUR-CIR-8D')))->toBeApiError(403);
});

it('asocia temporadas activas y conserva las que usan sus tarifas', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons', edBody('LOR-AMZ-4D', ['season_ids' => [edRef('catalog_seasons', 'TMP-02'), edRef('catalog_seasons', 'TMP-03')]]), edHeaders('LOR-AMZ-4D'))->assertOk();
    expect(edCount('catalog_product_seasons', 'LOR-AMZ-4D'))->toBe(2);

    withinTenant(tenantA(), fn () => DB::table('catalog_seasons')->where('ref', 'TMP-05')->update(['status' => 'inactiva']));
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons', edBody('LOR-AMZ-4D', ['season_ids' => [edRef('catalog_seasons', 'TMP-05')]]), edHeaders('LOR-AMZ-4D')))->toBeApiError(422, 'CAT-BR-13');

    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons', edBody('LOR-AMZ-4D', ['season_ids' => []]), edHeaders('LOR-AMZ-4D'))->assertOk();
    expect(edCount('catalog_product_seasons', 'LOR-AMZ-4D'))->toBe(0);

    $rated = withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', edProduct('CUS-HUM-FD')->id)->whereNotNull('season_id')->count());
    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/seasons', edBody('CUS-HUM-FD', ['season_ids' => []]), edHeaders('CUS-HUM-FD'))->assertOk();
    expect(edCount('catalog_product_seasons', 'CUS-HUM-FD'))->toBe($rated > 0 ? withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', edProduct('CUS-HUM-FD')->id)->whereNotNull('season_id')->distinct()->count('season_id')) : 0);
});

it('guarda disponibilidad, contenido y políticas con sus validaciones', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/availability', edBody('LOR-AMZ-4D', ['model' => 'POR_SALIDA', 'capacity' => 16, 'source' => 'externa']), edHeaders('LOR-AMZ-4D'))->assertOk()->assertJsonPath('data.availability.source', 'externa');
    expect(edProduct('LOR-AMZ-4D')->availability_model)->toBe('POR_SALIDA');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/availability', edBody('LOR-AMZ-4D', ['model' => 'OTRO', 'source' => 'nube']), edHeaders('LOR-AMZ-4D'))->assertStatus(422)->assertJsonValidationErrors(['model', 'source']);

    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/content', edBody('LOR-AMZ-4D', edContent(['slug' => 'amazonas-lodge'])), edHeaders('LOR-AMZ-4D'))->assertOk()
        ->assertJsonPath('data.content.slug', 'amazonas-lodge')->assertJsonPath('data.content.faqs.0.question', '¿Incluye almuerzo?');
    expect(edCount('catalog_product_requirements', 'LOR-AMZ-4D'))->toBe(1)->and(edCount('catalog_product_media', 'LOR-AMZ-4D'))->toBe(1);
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/content', edBody('LOR-AMZ-4D', edContent(['slug' => 'Mal Slug', 'inclusions' => ['Guía', 'guía']])), edHeaders('LOR-AMZ-4D'))
        ->assertStatus(422)->assertJsonValidationErrors(['slug', 'inclusions.1']);
    withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->update(['slug' => 'laguna-humantay-full-day']));
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/content', edBody('LOR-AMZ-4D', edContent(['slug' => 'laguna-humantay-full-day'])), edHeaders('LOR-AMZ-4D')))->toBeApiError(422, 'CAT-BR-01');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/content', edBody('LOR-AMZ-4D', edContent(['slug' => 'amazonas-lodge', 'media' => [], 'faqs' => []])), edHeaders('LOR-AMZ-4D'))->assertOk();
    expect(edCount('catalog_product_media', 'LOR-AMZ-4D'))->toBe(0)->and(edCount('catalog_product_faqs', 'LOR-AMZ-4D'))->toBe(0);

    $policies = ['cancellation' => 'Sin costo hasta 30 días antes.', 'modification' => 'Cambios sujetos a disponibilidad.', 'no_show' => 'Se cobra el 100 %.', 'refund' => 'Reembolso en 15 días hábiles.'];
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/policies', edBody('LOR-AMZ-4D', $policies), edHeaders('LOR-AMZ-4D'))->assertOk()->assertJsonPath('data.policies.cancellation', 'Sin costo hasta 30 días antes.');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/policies', edBody('LOR-AMZ-4D', [...$policies, 'refund' => '']), edHeaders('LOR-AMZ-4D'))->assertStatus(422)->assertJsonValidationErrors('refund');
});

it('solicita canales en borrador y los publica de inmediato si el producto ya está activo', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/channels', edBody('LOR-AMZ-4D', ['channels' => ['cms', 'mobile']]), edHeaders('LOR-AMZ-4D'))->assertOk();
    $draft = withinTenant(tenantA(), fn () => DB::table('catalog_product_channels')->where('product_id', edProduct('LOR-AMZ-4D')->id)->pluck('is_published', 'channel')->all());
    expect($draft)->toMatchArray(['erp' => true, 'cms' => true, 'mobile' => true, 'b2b' => false]);
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/channels', edBody('LOR-AMZ-4D', ['channels' => ['fax']]), edHeaders('LOR-AMZ-4D'))->assertStatus(422)->assertJsonValidationErrors('channels.0');

    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/channels', edBody('CUS-HUM-FD', ['channels' => ['portal_pax']]), edHeaders('CUS-HUM-FD'))->assertOk();
    $published = withinTenant(tenantA(), fn () => DB::table('catalog_product_channels')->where('product_id', edProduct('CUS-HUM-FD')->id)->where('channel', 'portal_pax')->value('is_published'));
    expect($published)->toBeTrue();
});

it('edita la ficha con destinos secundarios e indicadores comerciales y no toca productos archivados', function () {
    actingAsSeed('U01');
    $lock = edLock('LOR-AMZ-4D');
    $product = edProduct('LOR-AMZ-4D');
    $body = [
        ...edMaster(['name' => $product->name, 'code' => 'LOR-AMZ-4D', 'type_id' => $product->product_type_id, 'category_id' => $product->category_id, 'destination_id' => $product->primary_destination_id, 'is_quoteable' => false]),
        'secondary_destination_ids' => [edRef('catalog_destinations', 'D20')],
        'lock_version' => $lock,
    ];

    $this->patchJson('/api/v1/catalog/products/LOR-AMZ-4D', $body, critical($lock))->assertOk();
    expect(edCount('catalog_product_destinations', 'LOR-AMZ-4D'))->toBe(1)
        ->and((bool) edProduct('LOR-AMZ-4D')->is_quoteable)->toBeFalse()
        ->and(edLock('LOR-AMZ-4D'))->toBe($lock + 1);

    $this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/archive', ['reason' => 'Retirado', 'lock_version' => edLock('LOR-AMZ-4D')], edHeaders('LOR-AMZ-4D'))->assertOk();
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/availability', edBody('LOR-AMZ-4D', ['model' => 'SIN_CONTROL', 'source' => 'interna']), edHeaders('LOR-AMZ-4D')))->toBeApiError(409, 'PRD-ARCHIVED');
    $this->getJson('/api/v1/catalog/products/NO-EXISTE/editor')->assertNotFound();
});
