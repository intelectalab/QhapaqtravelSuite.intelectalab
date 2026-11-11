<?php

use Illuminate\Support\Facades\DB;

function mktPlantillaAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Plantilla')->where('entity_id', $code)->where('action', $action)->exists());
}

function mktPlantillaWhatsapp(array $extra = []): array
{
    return ['channel' => 'whatsapp', 'name' => 'promo_verano_paracas', 'category' => 'MARKETING', 'body' => "Hola {{nombre}}, este verano te esperamos en Paracas con el código {{codigo_promo}}.\nResponde BAJA para no recibir más promociones.", ...$extra];
}

it('una plantilla de correo se crea activa y una de WhatsApp queda en revisión de Meta con su ID del adaptador', function () {
    actingAsSeed('U01');

    $email = $this->postJson('/api/v1/marketing/templates', ['channel' => 'email', 'name' => 'Verano en Paracas', 'category' => 'MARKETING', 'subject' => 'Tu verano, {{nombre}}', 'body' => "Hola {{nombre}}:\nTe esperamos.\n{{enlace_baja}}"])->assertCreated()->json('data.code');
    $whatsapp = $this->postJson('/api/v1/marketing/templates', mktPlantillaWhatsapp())->assertCreated()->json('data.code');

    expect(rowOf('mkt_templates', $email)->status)->toBe('activa')
        ->and(rowOf('mkt_templates', $whatsapp)->status)->toBe('en_revision')
        ->and(rowOf('mkt_templates', $whatsapp)->provider_template_id)->toStartWith('wa_tpl_sbx_')
        ->and(mktPlantillaAuditada($whatsapp, 'crear'))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/marketing/templates')->assertOk()->json('data'))->pluck('code'))->toContain($email, $whatsapp);
});

it('valida el enlace de baja, el «Responde BAJA», las variables y el nombre de Meta', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/marketing/templates', ['channel' => 'email', 'name' => 'Sin baja', 'category' => 'MARKETING', 'subject' => 'Hola', 'body' => 'Un correo comercial sin enlace.']))->toBeApiError(422, 'MKT-BR-02');
    expect($this->postJson('/api/v1/marketing/templates', mktPlantillaWhatsapp(['body' => 'Hola {{nombre}}, tenemos una oferta para ti.'])))->toBeApiError(422, 'MKT-BR-02');
    expect($this->postJson('/api/v1/marketing/templates', mktPlantillaWhatsapp(['body' => 'Hola {{cliente}}, oferta. Responde BAJA.'])))->toBeApiError(422, 'VALIDATION_ERROR');
    expect($this->postJson('/api/v1/marketing/templates', mktPlantillaWhatsapp(['name' => 'Promo Verano'])))->toBeApiError(422, 'VALIDATION_ERROR');
    expect($this->postJson('/api/v1/marketing/templates', ['channel' => 'email', 'name' => 'Sin asunto', 'category' => 'SERVICIO', 'body' => 'Mensaje de servicio al pasajero.']))->toBeApiError(422, 'VALIDATION_ERROR');
    $this->postJson('/api/v1/marketing/templates', ['channel' => 'fax', 'name' => '', 'category' => 'OTRA', 'body' => ''])->assertStatus(422)->assertJsonValidationErrors(['channel', 'name', 'category', 'body']);
});

it('registrar la respuesta de Meta aprueba la plantilla y editar una aprobada la devuelve a revisión', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/marketing/templates', mktPlantillaWhatsapp())->assertCreated()->json('data.code');
    $version = (int) rowOf('mkt_templates', $code)->lock_version;

    $this->putJson("/api/v1/marketing/templates/{$code}", ['meta_status' => 'aprobada'], critical($version))->assertOk()->assertJsonPath('data.status', 'aprobada');
    expect(rowOf('mkt_templates', $code)->reviewed_at)->not->toBeNull()
        ->and(mktPlantillaAuditada($code, 'aprobacion_meta'))->toBeTrue();
    expect($this->putJson("/api/v1/marketing/templates/{$code}", ['meta_status' => 'aprobada'], critical($version + 1)))->toBeApiError(409, 'MKT-BR-03');

    $this->putJson("/api/v1/marketing/templates/{$code}", mktPlantillaWhatsapp(['body' => "Hola {{nombre}}, nuevas fechas para Paracas.\nResponde BAJA para no recibir más."]), critical($version + 1))->assertOk()->assertJsonPath('data.status', 'en_revision');
    expect(rowOf('mkt_templates', $code)->status)->toBe('en_revision')
        ->and(mktPlantillaAuditada($code, 'editar'))->toBeTrue();
    expect($this->putJson("/api/v1/marketing/templates/{$code}", mktPlantillaWhatsapp(), critical($version)))->toBeApiError(409, 'STALE_VERSION');
});

it('editar una plantilla de correo conserva su estado activo y no admite respuesta de Meta', function () {
    actingAsSeed('U01');
    $row = rowOf('mkt_templates', 'TPL-01');

    $this->putJson('/api/v1/marketing/templates/TPL-01', ['name' => $row->name, 'category' => 'MARKETING', 'subject' => 'Novedades del mes', 'body' => "Hola {{nombre}}:\nNovedades.\n{{enlace_baja}}"], critical((int) $row->lock_version))->assertOk();
    expect(rowOf('mkt_templates', 'TPL-01')->status)->toBe('activa')
        ->and(rowOf('mkt_templates', 'TPL-01')->subject)->toBe('Novedades del mes');
    expect($this->putJson('/api/v1/marketing/templates/TPL-01', ['meta_status' => 'aprobada'], critical((int) $row->lock_version + 1)))->toBeApiError(409, 'MKT-BR-03');
});

it('Ventas no gestiona plantillas', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/marketing/templates'))->toBeApiError(403);
    expect($this->postJson('/api/v1/marketing/templates', mktPlantillaWhatsapp()))->toBeApiError(403);
});
