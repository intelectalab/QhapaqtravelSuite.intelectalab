<?php

use Illuminate\Support\Facades\DB;

function channelsFirst(string $table, array $where, string $column = 'code'): ?string
{
    return withinTenant(tenantA(), fn () => DB::table($table)->where($where)->orderBy($column)->value($column));
}

it('el CMS responde en /cms/contents', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/cms/contents')->assertOk();
});

it('el CMS envía a revisión y devuelve a borrador con una ruta por acción', function () {
    actingAsSeed('U01');
    $code = channelsFirst('cms_contents', ['status' => 'borrador', 'deleted_at' => null]);
    expect($code)->not->toBeNull();

    $version = fn (): int => (int) rowOf('cms_contents', $code)->lock_version;

    $this->postJson("/api/v1/cms/contents/{$code}/submit", [], critical($version()))->assertOk();
    expect(rowOf('cms_contents', $code)->status)->toBe('en_revision');

    $this->postJson("/api/v1/cms/contents/{$code}/return", ['reason' => 'Prueba de ruta'], critical($version()))->assertOk();
    expect(rowOf('cms_contents', $code)->status)->toBe('borrador');

    $this->postJson("/api/v1/cms/contents/{$code}/publish", [], critical($version()))->assertStatus(409);
});

it('el e-commerce publica y despublica con /publish y /unpublish', function () {
    actingAsSeed('U01');
    $code = channelsFirst('catalog_products', ['status' => 'ACTIVE', 'deleted_at' => null]);
    $published = fn () => withinTenant(tenantA(), fn () => (bool) DB::table('catalog_product_channels')->where('product_id', idOf('catalog_products', $code))->where('channel', 'ecommerce')->value('is_published'));

    $this->postJson("/api/v1/channels/ecommerce/products/{$code}/publish")->assertOk();
    expect($published())->toBeTrue();

    $this->postJson("/api/v1/channels/ecommerce/products/{$code}/unpublish")->assertOk();
    expect($published())->toBeFalse();
});

it('las agencias B2B se bloquean y desbloquean con /block y /unblock', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('status', 'activa')->whereColumn('credit_used', '<=', 'credit_limit')->orderBy('code')->value('code'));
    expect($code)->not->toBeNull();

    $version = fn (): int => (int) rowOf('channel_b2b_agencies', $code)->lock_version;

    $this->postJson("/api/v1/channels/b2b/agencies/{$code}/block", [], critical($version()))->assertStatus(422);

    $this->postJson("/api/v1/channels/b2b/agencies/{$code}/block", ['reason' => 'Prueba de ruta'], critical($version()))->assertOk();
    expect(rowOf('channel_b2b_agencies', $code)->status)->toBe('bloqueada');

    $this->postJson("/api/v1/channels/b2b/agencies/{$code}/unblock", [], critical($version()))->assertOk();
    expect(rowOf('channel_b2b_agencies', $code)->status)->toBe('activa');
});

it('las rutas antiguas de CMS, e-commerce y B2B ya no existen', function (string $method, string $path) {
    actingAsSeed('U01');

    expect($this->json($method, "/api/v1/{$path}")->status())->toBe(404);
})->with([
    ['GET', 'channels/cms'],
    ['POST', 'channels/cms'],
    ['PATCH', 'channels/cms/CMS-001'],
    ['DELETE', 'channels/cms/CMS-001'],
    ['POST', 'channels/cms/CMS-001/transition'],
    ['POST', 'channels/ecommerce/products/P-001/publication'],
    ['POST', 'channels/b2b/agencies/AG-001/status'],
]);
