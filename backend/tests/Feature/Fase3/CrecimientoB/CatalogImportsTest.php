<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

if (! function_exists('crecbAudited')) {
    function crecbAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

it('SC-08: importa una planilla, deja los productos en revisión y crea en borrador solo los elegidos', function () {
    actingAsSeed('U01');
    $csv = "nombre,destino,dias,precio,moneda\nCity tour Cusco colonial,Cusco,1,120,PEN\nValle Sagrado completo,Cusco,1,250,PEN\n";

    $import = $this->postJson('/api/v1/catalog/imports', ['source_type' => 'csv', 'content' => $csv], critical())
        ->assertCreated()
        ->assertJsonPath('data.status', 'revision')
        ->assertJsonPath('data.products_detected', 2)
        ->json('data');

    expect($import['code'])->toStartWith('IMP-')
        ->and($import['products'][0]['name'])->toBe('City tour Cusco colonial');

    $this->postJson("/api/v1/catalog/imports/{$import['code']}/confirm", ['products' => ['P1']], critical())
        ->assertOk()
        ->assertJsonPath('data.status', 'importado')
        ->assertJsonPath('data.products_created', 1);

    $created = $this->getJson("/api/v1/catalog/imports/{$import['code']}")->assertOk()->json('data.products.0.created_code');
    $product = rowOf('catalog_products', $created);

    expect($product->status)->toBe('DRAFT')
        ->and($product->short_description)->toContain('Detectado por IA')
        ->and(crecbAudited(['entity' => 'Importación de productos', 'entity_id' => $import['code'], 'action' => 'confirmar']))->toBeTrue();

    $this->postJson("/api/v1/catalog/imports/{$import['code']}/confirm", ['products' => ['P2']], critical())->assertStatus(409);
});

it('importa desde una página web con el extractor simulado y se puede cancelar', function () {
    actingAsSeed('U02');

    $code = $this->postJson('/api/v1/catalog/imports', ['source_type' => 'url', 'source_url' => 'https://operador-ejemplo.pe/tours'], critical())
        ->assertCreated()
        ->assertJsonPath('data.products_detected', 3)
        ->json('data.code');

    $this->postJson("/api/v1/catalog/imports/{$code}/confirm", ['products' => ['P9']], critical())->assertStatus(422);
    $this->postJson("/api/v1/catalog/imports/{$code}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelado');
    $this->postJson("/api/v1/catalog/imports/{$code}/cancel")->assertStatus(409);

    $this->getJson('/api/v1/catalog/imports')->assertOk()->assertJsonPath('data.imports.0.code', $code);
});

it('acepta un archivo adjunto y rechaza un tipo que no coincide', function () {
    actingAsSeed('U01');

    $this->post('/api/v1/catalog/imports', ['source_type' => 'csv', 'file' => UploadedFile::fake()->createWithContent('tours.csv', "nombre;destino;dias\nTrekking Salkantay;Cusco;5\n")], critical())
        ->assertCreated()
        ->assertJsonPath('data.products_detected', 1)
        ->assertJsonPath('data.products.0.duration_days', 5);

    $this->post('/api/v1/catalog/imports', ['source_type' => 'pdf', 'file' => UploadedFile::fake()->createWithContent('tours.csv', 'nombre')], critical())->assertStatus(422);
    $this->postJson('/api/v1/catalog/imports', ['source_type' => 'url', 'source_url' => 'no es una url'], critical())->assertStatus(422);
});

it('Ventas no importa productos: 403', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/catalog/imports'))->toBeApiError(403);
});
