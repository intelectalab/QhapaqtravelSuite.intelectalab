<?php

use App\Domain\Admin\Support\Branding;
use Illuminate\Support\Facades\DB;

function adminBrandingAudit(string $entityId, string $action): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Personalización', 'entity_id' => $entityId, 'action' => $action])->orderByDesc('code')->first());
}

it('guarda los colores de la agencia en minúsculas y todo el equipo los recibe en /me', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/admin/branding', ['brand' => '#0F766E', 'accent' => '#1E40AF', 'menu' => '#141a33', 'tile_variant' => 'stacked'])
        ->assertOk()->assertJsonPath('data.changed', ['brand', 'accent', 'tile_variant']);

    $expected = ['brand' => '#0f766e', 'accent' => '#1e40af', 'menu' => '#141a33', 'tile_variant' => 'stacked'];

    expect($this->getJson('/api/v1/admin/branding')->assertOk()->json('data.branding'))->toBe($expected)
        ->and(adminBrandingAudit('brand', 'actualizar')->after_value)->toBe('#0f766e')
        ->and(adminBrandingAudit('tile_variant', 'actualizar')->after_value)->toBe('Apilada')
        ->and(adminBrandingAudit('menu', 'actualizar'))->toBeNull();

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/me')->assertOk()->json('data.tenant.branding'))->toBe($expected);
});

it('CFG-BR-01: guardar los mismos colores no registra cambios', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/admin/branding', Branding::DEFAULTS))->toBeApiError(422, 'CFG-BR-01');
});

it('valida el formato de los colores y el diseño de tarjeta', function (array $body, string $field) {
    actingAsSeed('U01');

    $this->putJson('/api/v1/admin/branding', [...Branding::DEFAULTS, ...$body])->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'color sin #' => [['brand' => '0f766e'], 'brand'],
    'color corto' => [['accent' => '#fff'], 'accent'],
    'menú vacío' => [['menu' => ''], 'menu'],
    'variante inexistente' => [['tile_variant' => 'mosaico'], 'tile_variant'],
]);

it('restablece la apariencia de fábrica con motivo y lo audita', function () {
    actingAsSeed('U01');
    $this->putJson('/api/v1/admin/branding', ['brand' => '#0f766e', 'accent' => '#1e40af', 'menu' => '#0f172a', 'tile_variant' => 'side'])->assertOk();

    $this->postJson('/api/v1/admin/branding/reset', ['reason' => 'Volver al estilo de la marca'])->assertOk()->assertJsonPath('data.reset', true);

    expect($this->getJson('/api/v1/admin/branding')->json('data.branding'))->toBe(Branding::DEFAULTS)
        ->and(adminBrandingAudit('apariencia', 'restablecer')->after_value)->toBe('Volver al estilo de la marca');
    expect($this->postJson('/api/v1/admin/branding/reset', ['reason' => 'Otra vez']))->toBeApiError(422, 'CFG-BR-01');
    $this->postJson('/api/v1/admin/branding/reset', [])->assertStatus(422)->assertJsonValidationErrors('reason');
});

it('solo quien gestiona la configuración cambia la apariencia', function (string $method, string $uri, array $body) {
    actingAsSeed('U02');

    expect($this->json($method, $uri, $body))->toBeApiError(403);
})->with([
    ['PUT', '/api/v1/admin/branding', ['brand' => '#0f766e', 'accent' => '#1e40af', 'menu' => '#0f172a', 'tile_variant' => 'side']],
    ['POST', '/api/v1/admin/branding/reset', ['reason' => 'Prueba']],
]);
