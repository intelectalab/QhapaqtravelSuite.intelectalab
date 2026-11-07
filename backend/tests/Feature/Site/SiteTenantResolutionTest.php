<?php

use Illuminate\Support\Facades\DB;

function widgetKeyOfA(): string
{
    return (string) DB::connection('pgsql_platform')->table('channel_widget_config')->where('tenant_id', tenantA()->getKey())->value('public_key');
}

it('el sitio se identifica por el subdominio de la agencia', function () {
    $this->getJson('/api/v1/public/site', siteOf())->assertOk()->assertJsonPath('data.agency.subdomain', 'andes');
});

it('el sitio se identifica por la clave pública del widget desde un dominio verificado', function () {
    $domain = (string) DB::connection('pgsql_platform')->table('channel_widget_domains')->where('tenant_id', tenantA()->getKey())->where('status', 'verificado')->value('domain');

    $this->getJson('/api/v1/public/products', ['X-Qhapaq-Key' => widgetKeyOfA(), 'Origin' => "https://{$domain}"])->assertOk();
});

it('la clave del widget usada desde un dominio no verificado responde 403', function () {
    $response = $this->getJson('/api/v1/public/products', ['X-Qhapaq-Key' => widgetKeyOfA(), 'Origin' => 'https://sitio-ajeno.example.com']);

    expect($response)->toBeApiError(403, 'WIDGET_ORIGIN_NOT_ALLOWED');
});

it('una clave inválida responde 401 y un dominio desconocido 404', function () {
    expect($this->getJson('/api/v1/public/products', ['X-Qhapaq-Key' => 'pk_live_inexistente']))->toBeApiError(401, 'WIDGET_KEY_INVALID')
        ->and($this->getJson('/api/v1/public/products', ['X-Forwarded-Host' => 'nadie.example.com'])->status())->toBe(404);
});

it('las rutas antiguas con la agencia en la URL ya no existen', function () {
    expect($this->getJson('/api/v1/public/sites/andes/products')->status())->toBe(404);
});
