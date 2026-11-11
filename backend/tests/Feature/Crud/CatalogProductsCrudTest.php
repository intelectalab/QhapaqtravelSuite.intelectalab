<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catProductRow(string $code): object
{
    return rowOf('catalog_products', $code);
}

function catProductPayload(string $code, array $overrides = []): array
{
    $row = catProductRow($code);

    return [
        'name' => $row->name,
        'internal_name' => $row->internal_name,
        'code' => $row->code,
        'sku' => $row->sku,
        'type_id' => $row->product_type_id,
        'category_id' => $row->category_id,
        'subcategory_id' => $row->subcategory_id,
        'destination_id' => $row->primary_destination_id,
        'provider_id' => $row->main_provider_id,
        'short_description' => $row->short_description,
        'duration_value' => (float) $row->duration_value,
        'duration_unit' => $row->duration_unit,
        'modality' => $row->modality,
        'minimum_passengers' => (int) $row->minimum_passengers,
        'maximum_passengers' => (int) $row->maximum_passengers,
        'minimum_age' => (int) $row->minimum_age,
        'maximum_age' => (int) $row->maximum_age,
        'booking_advance_min_days' => (int) $row->booking_advance_min_days,
        'booking_advance_max_days' => (int) $row->booking_advance_max_days,
        'is_b2b' => (bool) $row->is_b2b,
        'is_ecommerce' => (bool) $row->is_ecommerce,
        'is_featured' => (bool) $row->is_featured,
        'markup_pct' => (float) $row->markup_pct,
        'availability_model' => $row->availability_model,
        'lock_version' => (int) $row->lock_version,
        ...$overrides,
    ];
}

function catNewProductPayload(array $overrides = []): array
{
    $base = catProductPayload('CUS-HUM-FD');
    unset($base['lock_version'], $base['sku'], $base['internal_name']);

    return [...$base, 'name' => 'Valle Sur y Tipón', 'code' => 'CUS-VSU-FD', 'availability_model' => 'SIN_CONTROL', ...$overrides];
}

function catCreateProduct(array $overrides = []): string
{
    actingAsSeed('U01');

    return (string) test()->postJson('/api/v1/catalog/products', catNewProductPayload($overrides), critical())->assertCreated()->json('data.code');
}

function catTransition(string $code, string $action, ?string $reason = null)
{
    $lock = (int) catProductRow($code)->lock_version;

    return test()->postJson("/api/v1/catalog/products/{$code}/{$action}", array_filter(['reason' => $reason, 'lock_version' => $lock], fn ($v) => $v !== null), critical($lock));
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('crea un producto en borrador con versión 0.1, canal ERP, SKU por defecto y auditoría', function () {
    $code = catCreateProduct(['code' => 'cus-vsu-fd']);
    $row = catProductRow('CUS-VSU-FD');
    [$version, $erp] = withinTenant(tenantA(), fn () => [
        DB::table('catalog_product_versions')->where('product_id', $row->id)->first(['version', 'status']),
        DB::table('catalog_product_channels')->where('product_id', $row->id)->where('channel', 'erp')->value('is_published'),
    ]);

    expect($code)->toBe('CUS-VSU-FD')
        ->and($row->status)->toBe('DRAFT')
        ->and($row->sku)->toEndWith('-CUS-VSU-FD')
        ->and($row->internal_name)->toBe('Valle Sur y Tipón')
        ->and($version->version)->toBe('0.1')
        ->and($version->status)->toBe('borrador')
        ->and($erp)->toBeTrue()
        ->and(catAudit(['entity' => 'Producto', 'entity_id' => 'CUS-VSU-FD', 'action' => 'crear']))->toBeTrue();
    $this->getJson('/api/v1/catalog/products/CUS-VSU-FD')->assertOk()->assertJsonPath('data.status', 'DRAFT');
});

it('valida los datos del producto nuevo y el código único', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/products', catNewProductPayload(['name' => 'Va', 'code' => 'COD IGO']), critical())
        ->assertStatus(422)->assertJsonValidationErrors(['name', 'code']);
    expect($this->postJson('/api/v1/catalog/products', catNewProductPayload(['code' => 'cus-hum-fd']), critical()))->toBeApiError(422, 'CAT-BR-01');
    expect($this->postJson('/api/v1/catalog/products', catNewProductPayload(['minimum_passengers' => 10, 'maximum_passengers' => 2]), critical()))->toBeApiError(422, 'CAT-BR-02');
});

it('ventas y operaciones no crean productos', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/catalog/products', catNewProductPayload(), critical()))->toBeApiError(403);
    expect(rowOf('catalog_products', 'CUS-VSU-FD'))->toBeNull();
})->with(['U03', 'U05']);

it('edita el producto, sube la versión de bloqueo y registra los campos cambiados', function () {
    actingAsSeed('U01');
    $lock = (int) catProductRow('CUS-HUM-FD')->lock_version;

    $this->patchJson('/api/v1/catalog/products/CUS-HUM-FD', catProductPayload('CUS-HUM-FD', ['name' => 'Laguna Humantay Full Day Premium', 'maximum_passengers' => 14]), critical($lock))
        ->assertOk()->assertJsonPath('data.code', 'CUS-HUM-FD');

    $row = catProductRow('CUS-HUM-FD');
    expect($row->name)->toBe('Laguna Humantay Full Day Premium')
        ->and((int) $row->maximum_passengers)->toBe(14)
        ->and((int) $row->lock_version)->toBe($lock + 1)
        ->and(catAudit(['entity' => 'Producto', 'entity_id' => 'CUS-HUM-FD', 'action' => 'modificar']))->toBeTrue();
    $this->getJson('/api/v1/catalog/products/CUS-HUM-FD')->assertOk()->assertJsonPath('data.name', 'Laguna Humantay Full Day Premium');
});

it('rechaza la edición con versión vieja, datos inválidos, rol sin permiso o producto archivado', function () {
    actingAsSeed('U01');
    $lock = (int) catProductRow('CUS-HUM-FD')->lock_version;

    expect($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD', catProductPayload('CUS-HUM-FD', ['name' => 'Otro nombre', 'lock_version' => $lock + 5]), critical($lock + 5)))->toBeApiError(409, 'STALE_VERSION');
    $this->patchJson('/api/v1/catalog/products/CUS-HUM-FD', catProductPayload('CUS-HUM-FD', ['duration_unit' => 'semanas']), critical($lock))->assertStatus(422)->assertJsonValidationErrors('duration_unit');
    expect($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD', catProductPayload('CUS-HUM-FD', ['code' => 'CUS-MAPI-FD']), critical($lock)))->toBeApiError(422, 'CAT-BR-01');

    catTransition('LOR-AMZ-4D', 'archive', 'Producto discontinuado')->assertOk();
    $archived = catProductRow('LOR-AMZ-4D');
    expect($this->patchJson('/api/v1/catalog/products/LOR-AMZ-4D', catProductPayload('LOR-AMZ-4D', ['name' => 'Nuevo nombre']), critical((int) $archived->lock_version)))->toBeApiError(409, 'PRD-ARCHIVED');

    actingAsSeed('U03');
    expect($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD', catProductPayload('CUS-HUM-FD', ['name' => 'Otro nombre']), critical($lock)))->toBeApiError(403);
    expect(catProductRow('CUS-HUM-FD')->name)->toBe('Laguna Humantay Full Day');
});

it('recorre borrador, revisión, devolución y aprobación con sus versiones y motivos', function () {
    $code = catCreateProduct();
    $id = catProductRow($code)->id;
    $versionStatus = fn () => withinTenant(tenantA(), fn () => DB::table('catalog_product_versions')->where('product_id', $id)->value('status'));

    $lock = fn () => (int) catProductRow($code)->lock_version;

    $this->postJson("/api/v1/catalog/products/{$code}/submit-review", ['lock_version' => $lock()], critical($lock()))->assertOk();
    expect(catProductRow($code)->status)->toBe('REVIEW')->and($versionStatus())->toBe('en_revision');

    expect($this->postJson("/api/v1/catalog/products/{$code}/return-to-draft", ['lock_version' => $lock()], critical($lock())))->toBeApiError(422, 'CAT-BR-07');
    $this->postJson("/api/v1/catalog/products/{$code}/return-to-draft", ['reason' => 'Falta itinerario', 'lock_version' => $lock()], critical($lock()))->assertOk();
    expect(catProductRow($code)->status)->toBe('DRAFT')->and($versionStatus())->toBe('borrador');

    catTransition($code, 'submit-review')->assertOk();
    $this->postJson("/api/v1/catalog/products/{$code}/approve", ['lock_version' => $lock()], critical($lock()))->assertOk();
    expect(catProductRow($code)->status)->toBe('APPROVED')
        ->and(catAudit(['entity' => 'Producto', 'entity_id' => $code, 'action' => 'cambio_estado', 'before_value' => 'REVIEW', 'after_value' => 'APPROVED']))->toBeTrue();
});

it('bloquea transiciones fuera de la máquina de estados', function () {
    actingAsSeed('U01');

    expect(catTransition('LOR-AMZ-4D', 'suspend', 'Motivo'))->toBeApiError(409, 'PRD-BR-TRANSITION');
    expect(catTransition('LOR-AMZ-4D', 'approve'))->toBeApiError(409, 'PRD-BR-TRANSITION');
    expect(catTransition('CUS-HUM-FD', 'submit-review'))->toBeApiError(409, 'PRD-BR-TRANSITION');
    expect(catProductRow('LOR-AMZ-4D')->status)->toBe('DRAFT');

    $lock = (int) catProductRow('CUS-HUM-FD')->lock_version;
    expect($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/suspend', ['reason' => 'Clima', 'lock_version' => $lock + 1], critical($lock + 1)))->toBeApiError(409, 'STALE_VERSION');
});

it('ventas y operaciones no cambian el estado del producto', function (string $user, string $action) {
    actingAsSeed($user);

    expect(catTransition('SUR-CIR-8D', $action, 'Motivo de prueba'))->toBeApiError(403);
    expect(catProductRow('SUR-CIR-8D')->status)->toBe('REVIEW');
})->with([['U03', 'approve'], ['U05', 'return-to-draft'], ['U07', 'archive']]);

it('la activación sin checklist completo se rechaza y queda auditada', function () {
    $code = catCreateProduct(['provider_id' => null]);
    catTransition($code, 'submit-review')->assertOk();
    catTransition($code, 'approve')->assertOk();

    $response = catTransition($code, 'activate');
    expect($response)->toBeApiError(422, 'PRD-ACT-CHECKLIST');
    expect(collect($response->json('details.failed') ?? $response->json('failed'))->pluck('key')->all())->toContain('rate_today', 'provider');
    expect(catProductRow($code)->status)->toBe('APPROVED')
        ->and(auditExists(['entity' => 'Producto', 'entity_id' => $code, 'action' => 'activacion_rechazada']))->toBeTrue();
});

it('suspender saca el producto del sitio, del cotizador y de los bloqueos; reactivarlo lo devuelve', function () {
    actingAsSeed('U01');
    $this->getJson('/api/v1/public/products/laguna-humantay-full-day', siteOf())->assertOk();

    expect(catTransition('CUS-HUM-FD', 'suspend'))->toBeApiError(422, 'CAT-BR-07');
    catTransition('CUS-HUM-FD', 'suspend', 'Cierre temporal del acceso')->assertOk();

    expect(catProductRow('CUS-HUM-FD')->status)->toBe('SUSPENDED');
    $this->getJson('/api/v1/public/products/laguna-humantay-full-day', siteOf())->assertNotFound();
    expect($this->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-HUM-FD', 'adt' => 2]))->toBeApiError(422, 'PRD-BR-002');
    expect($this->postJson('/api/v1/catalog/holds', ['departure_id' => departureRow('SAL-0403')->id, 'quantity' => 2, 'reference' => 'COT-PRUEBA'], critical()))->toBeApiError(422, 'PRD-BR-002');
    expect(collect($this->getJson('/api/v1/quotes/form-options')->assertOk()->json('data.products'))->pluck('code'))->not->toContain('CUS-HUM-FD');

    catTransition('CUS-HUM-FD', 'activate')->assertOk();
    expect(catProductRow('CUS-HUM-FD')->status)->toBe('ACTIVE');
    $this->getJson('/api/v1/public/products/laguna-humantay-full-day', siteOf())->assertOk();
    $this->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-HUM-FD', 'adt' => 2])->assertOk();
});

it('inactivar impide nuevas salidas y archivar deja el producto terminal', function () {
    actingAsSeed('U01');
    $productId = catProductRow('CUS-MAPI-FD')->id;

    catTransition('CUS-MAPI-FD', 'deactivate', 'Fin de temporada')->assertOk();
    expect(catProductRow('CUS-MAPI-FD')->status)->toBe('INACTIVE');
    expect($this->postJson('/api/v1/catalog/departures', ['product_id' => $productId, 'departure_date' => '2026-11-20', 'departure_time' => '05:00', 'capacity' => 10, 'meeting_point' => 'Plaza de Armas'], critical()))->toBeApiError(422, 'CAT-BR-20');
    $this->getJson('/api/v1/public/products/machu-picchu-full-day', siteOf())->assertNotFound();

    $lock = (int) catProductRow('CUS-MAPI-FD')->lock_version;
    $this->postJson('/api/v1/catalog/products/CUS-MAPI-FD/archive', ['lock_version' => $lock], critical($lock))->assertStatus(422);
    $this->postJson('/api/v1/catalog/products/CUS-MAPI-FD/archive', ['reason' => 'Producto retirado', 'lock_version' => $lock], critical($lock))->assertOk();
    expect(catProductRow('CUS-MAPI-FD')->status)->toBe('ARCHIVED');
    expect(catTransition('CUS-MAPI-FD', 'activate'))->toBeApiError(409, 'PRD-BR-TRANSITION');
    expect(catTransition('CUS-MAPI-FD', 'archive', 'Otra vez'))->toBeApiError(409, 'PRD-BR-TRANSITION');
});

it('elimina de forma lógica un borrador sin historia y lo audita', function () {
    actingAsSeed('U01');
    $lock = (int) catProductRow('LOR-AMZ-4D')->lock_version;

    $this->deleteJson('/api/v1/catalog/products/LOR-AMZ-4D', [], critical($lock))->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->deleteJson('/api/v1/catalog/products/LOR-AMZ-4D', ['reason' => 'Duplicado'], critical($lock))->assertOk();

    expect(catProductRow('LOR-AMZ-4D')->deleted_at)->not->toBeNull()
        ->and(catAudit(['entity' => 'Producto', 'entity_id' => 'LOR-AMZ-4D', 'action' => 'eliminar']))->toBeTrue();
    $this->getJson('/api/v1/catalog/products/LOR-AMZ-4D')->assertNotFound();
    expect(collect($this->getJson('/api/v1/catalog/products')->json('data'))->pluck('code'))->not->toContain('LOR-AMZ-4D');
    expect($this->postJson('/api/v1/catalog/products', catNewProductPayload(['code' => 'LOR-AMZ-4D']), critical()))->toBeApiError(422, 'CAT-BR-01');
});

it('no elimina productos en venta ni con cotizaciones; ventas no elimina', function () {
    actingAsSeed('U01');

    expect($this->deleteJson('/api/v1/catalog/products/CUS-HUM-FD', ['reason' => 'Prueba'], critical((int) catProductRow('CUS-HUM-FD')->lock_version)))->toBeApiError(409, 'PRD-BR-018');
    expect($this->deleteJson('/api/v1/catalog/products/SUR-CIR-8D', ['reason' => 'Prueba'], critical((int) catProductRow('SUR-CIR-8D')->lock_version)))->toBeApiError(409, 'PRD-BR-018');
    expect(catProductRow('SUR-CIR-8D')->deleted_at)->toBeNull();

    actingAsSeed('U03');
    expect($this->deleteJson('/api/v1/catalog/products/LOR-AMZ-4D', ['reason' => 'Prueba'], critical((int) catProductRow('LOR-AMZ-4D')->lock_version)))->toBeApiError(403);
    expect(catProductRow('LOR-AMZ-4D')->deleted_at)->toBeNull();
});
