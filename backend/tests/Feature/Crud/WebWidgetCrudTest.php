<?php

use Illuminate\Support\Facades\DB;

function webWidgetDefaults(array $overrides = []): array
{
    return ['product' => 'CUS-HUM-FD', 'method' => 'iframe', 'lang' => 'en', 'currency' => 'USD', 'theme' => '#1F6F5C', 'radius' => 14, 'reviews' => true, 'domain' => 'www.wayraviajes.pe', ...$overrides];
}

function webWidgetDomain(string $domain): ?object
{
    return rowOf('channel_widget_domains', $domain, column: 'domain');
}

function webWidgetFrom(string $domain)
{
    $key = (string) withinTenant(tenantA(), fn () => DB::table('channel_widget_config')->value('public_key'));

    return withPlatformSeeingTenant(fn () => test()->getJson('/api/v1/public/products', ['X-KipuControl-Key' => $key, 'Origin' => "https://{$domain}"]));
}

function webWidgetAudit(string $entity, string $id, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => $entity, 'entity_id' => $id, 'action' => $action])->exists());
}

it('guardar los predeterminados del widget los deja vigentes en la pantalla de integración', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/channels/widget', webWidgetDefaults())->assertOk()->assertJsonPath('data.saved', true);

    $defaults = $this->getJson('/api/v1/channels/widget')->assertOk()->json('data.defaults');
    expect($defaults['product'])->toBe('CUS-HUM-FD')
        ->and($defaults['method'])->toBe('iframe')
        ->and($defaults['lang'])->toBe('en')
        ->and($defaults['currency'])->toBe('USD')
        ->and($defaults['theme'])->toBe('#1F6F5C')
        ->and($defaults['radius'])->toBe(14)
        ->and($defaults['reviews'])->toBeTrue()
        ->and($defaults['domain'])->toBe('www.wayraviajes.pe')
        ->and(webWidgetAudit('Widget web', 'predeterminados', 'editar'))->toBeTrue();
});

it('valida producto, método, color y radio del widget', function () {
    actingAsSeed('U01');
    $before = $this->getJson('/api/v1/channels/widget')->assertOk()->json('data.defaults');

    $this->putJson('/api/v1/channels/widget', webWidgetDefaults(['product' => 'NO-EXISTE', 'method' => 'popup', 'theme' => 'verde', 'radius' => 40, 'lang' => 'fr']))
        ->assertStatus(422)->assertJsonValidationErrors(['product', 'method', 'theme', 'radius', 'lang']);

    expect($this->getJson('/api/v1/channels/widget')->json('data.defaults'))->toBe($before);
});

it('un dominio nuevo queda pendiente con su token y el widget no responde desde él hasta verificarlo', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/channels/widget/domains', ['domain' => 'Reservas.WayraViajes.pe', 'cms' => 'WordPress'])->assertCreated();

    $domain = webWidgetDomain('reservas.wayraviajes.pe');
    expect($domain)->not->toBeNull()
        ->and($domain->status)->toBe('pendiente')
        ->and($domain->cms)->toBe('WordPress')
        ->and($domain->verify_token)->toStartWith('kipucontrol-verify=')
        ->and(webWidgetAudit('Dominio del widget', 'reservas.wayraviajes.pe', 'crear'))->toBeTrue()
        ->and(webWidgetFrom('reservas.wayraviajes.pe'))->toBeApiError(403, 'WIDGET_ORIGIN_NOT_ALLOWED');
});

it('verificar el dominio habilita el widget desde ese sitio y quitarlo lo vuelve a bloquear', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/channels/widget/domains', ['domain' => 'reservas.wayraviajes.pe'])->assertCreated();
    $id = webWidgetDomain('reservas.wayraviajes.pe')->id;

    $this->postJson("/api/v1/channels/widget/domains/{$id}/verify")->assertOk()->assertJsonPath('data.id', $id);
    expect(webWidgetDomain('reservas.wayraviajes.pe')->status)->toBe('verificado')
        ->and(webWidgetDomain('reservas.wayraviajes.pe')->verified_at)->not->toBeNull()
        ->and(webWidgetAudit('Dominio del widget', 'reservas.wayraviajes.pe', 'verificar'))->toBeTrue();
    webWidgetFrom('reservas.wayraviajes.pe')->assertOk();

    actingAsSeed('U01');
    $this->deleteJson("/api/v1/channels/widget/domains/{$id}")->assertOk();
    expect(webWidgetDomain('reservas.wayraviajes.pe'))->toBeNull()
        ->and(webWidgetAudit('Dominio del widget', 'reservas.wayraviajes.pe', 'quitar'))->toBeTrue()
        ->and(webWidgetFrom('reservas.wayraviajes.pe'))->toBeApiError(403, 'WIDGET_ORIGIN_NOT_ALLOWED');
});

it('WEB-BR-02 / WEB-BR-03: no se repite un dominio ni se verifica dos veces', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/channels/widget/domains', ['domain' => 'reservas.wayraviajes.pe'])->assertCreated();
    $id = webWidgetDomain('reservas.wayraviajes.pe')->id;

    expect($this->postJson('/api/v1/channels/widget/domains', ['domain' => 'RESERVAS.wayraviajes.pe']))->toBeApiError(409, 'WEB-BR-02');
    $this->postJson("/api/v1/channels/widget/domains/{$id}/verify")->assertOk();
    expect($this->postJson("/api/v1/channels/widget/domains/{$id}/verify"))->toBeApiError(409, 'WEB-BR-03');
});

it('valida el formato del dominio y un dominio inexistente responde 404', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/channels/widget/domains', ['domain' => 'https://wayraviajes.pe/reservas'])->assertStatus(422)->assertJsonValidationErrors(['domain']);
    expect($this->postJson('/api/v1/channels/widget/domains/00000000-0000-7000-8000-000000000000/verify'))->toBeApiError(404)
        ->and($this->deleteJson('/api/v1/channels/widget/domains/00000000-0000-7000-8000-000000000000'))->toBeApiError(404);
});

it('Ventas no configura el widget ni sus dominios', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/channels/widget/domains', ['domain' => 'reservas.wayraviajes.pe'])->assertCreated();
    $id = webWidgetDomain('reservas.wayraviajes.pe')->id;

    actingAsSeed('U03');
    expect($this->putJson('/api/v1/channels/widget', webWidgetDefaults()))->toBeApiError(403)
        ->and($this->postJson('/api/v1/channels/widget/domains', ['domain' => 'otro.wayraviajes.pe']))->toBeApiError(403)
        ->and($this->postJson("/api/v1/channels/widget/domains/{$id}/verify"))->toBeApiError(403)
        ->and($this->deleteJson("/api/v1/channels/widget/domains/{$id}"))->toBeApiError(403)
        ->and(webWidgetDomain('reservas.wayraviajes.pe')->status)->toBe('pendiente');
});
