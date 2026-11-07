<?php

use Illuminate\Support\Facades\DB;

function tenantValue(string $table, string $column, array $where = []): mixed
{
    return withinTenant(tenantA(), fn () => DB::table($table)->where($where)->orderBy($column)->value($column));
}

it('API y webhooks: las rutas de integraciones responden y las de admin/api ya no existen', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/admin/api')->assertOk()->assertJsonStructure(['data' => ['keys', 'webhooks', 'deliveries']]);
    $this->getJson('/api/v1/integrations/api-keys')->assertOk()->assertJsonStructure(['data']);
    $this->getJson('/api/v1/integrations/webhooks')->assertOk()->assertJsonStructure(['data']);

    $key = $this->postJson('/api/v1/integrations/api-keys', ['name' => 'Prueba de contrato', 'environment' => 'test', 'scopes' => ['catalog:read']], critical())->assertCreated()->json('data.code');
    $this->deleteJson("/api/v1/integrations/api-keys/{$key}", ['reason' => 'Ya no se usa'], critical())->assertOk();
    expect(tenantValue('integration_api_keys', 'status', ['code' => $key]))->toBe('revoked');

    $hook = (string) tenantValue('integration_webhooks', 'code', ['status' => 'active']);
    $this->patchJson("/api/v1/integrations/webhooks/{$hook}", ['status' => 'paused'], critical())->assertOk();
    expect(tenantValue('integration_webhooks', 'status', ['code' => $hook]))->toBe('paused');
    $this->patchJson("/api/v1/integrations/webhooks/{$hook}", ['status' => 'active'], critical())->assertOk();

    $this->postJson('/api/v1/admin/api/keys', [], critical())->assertNotFound();
    $this->postJson("/api/v1/admin/api/keys/{$key}/revoke", [], critical())->assertNotFound();
    $this->postJson("/api/v1/admin/api/webhooks/{$hook}/pause", [], critical())->assertNotFound();
});

it('suscripción: GET /billing/subscription responde y /admin/subscription ya no existe', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/billing/subscription')->assertOk()->assertJsonStructure(['data' => ['plan', 'subscription']]);
    $this->getJson('/api/v1/admin/subscription')->assertNotFound();
    $this->patchJson('/api/v1/admin/subscription/billing', [], critical())->assertNotFound();
});

it('reglas de reserva: PATCH {code} activa y desactiva, reset restablece y /admin/rules ya no existe', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/admin/booking-rules')->assertOk();
    $before = (bool) tenantValue('sys_booking_rules', 'enabled', ['code' => 'R-LODGING']);
    $this->patchJson('/api/v1/admin/booking-rules/R-LODGING', ['enabled' => ! $before], critical((int) tenantValue('sys_booking_rules', 'lock_version', ['code' => 'R-LODGING'])))->assertOk();
    expect((bool) tenantValue('sys_booking_rules', 'enabled', ['code' => 'R-LODGING']))->toBe(! $before);

    $this->postJson('/api/v1/admin/booking-rules/reset', ['code' => 'R-LODGING', 'reason' => 'Prueba de contrato'], critical())->assertOk()->assertJsonPath('data.codes', ['R-LODGING']);
    expect((bool) tenantValue('sys_booking_rules', 'enabled', ['code' => 'R-LODGING']))->toBe((bool) tenantValue('sys_booking_rule_catalog', 'default_enabled', ['code' => 'R-LODGING']));

    $this->getJson('/api/v1/admin/rules')->assertNotFound();
    $this->postJson('/api/v1/admin/rules/R-LODGING/toggle', ['enabled' => true], critical())->assertNotFound();
});

it('plantillas al pasajero: /notifications/pax-templates responde, PATCH active cambia el estado y /admin/pax-templates ya no existe', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/notifications/pax-templates')->assertOk();
    $code = (string) tenantValue('notif_pax_message_templates', 'code');
    $active = (bool) tenantValue('notif_pax_message_templates', 'active', ['code' => $code]);

    $this->patchJson("/api/v1/notifications/pax-templates/{$code}", ['active' => ! $active], critical())->assertOk()->assertJsonPath('data.active', ! $active);
    expect($this->patchJson("/api/v1/notifications/pax-templates/{$code}", ['active' => ! $active], critical()))->toBeApiError(422, 'CFG-BR-01');

    $this->getJson('/api/v1/admin/pax-templates')->assertNotFound();
    $this->postJson("/api/v1/admin/pax-templates/{$code}/toggle", [], critical())->assertNotFound();
});

it('widget: /channels/widget responde y /channels/web ya no existe', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/channels/widget')->assertOk();
    $this->getJson('/api/v1/channels/web')->assertNotFound();
    $this->postJson('/api/v1/channels/web/domains', ['domain' => 'ejemplo.pe'], critical())->assertNotFound();
});

it('reseñas: GET /reviews, hide con motivo, reject sin motivo 422 y las rutas de channels/own-reviews ya no existen', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/reviews')->assertOk();
    $code = (string) tenantValue('crm_own_reviews', 'code', ['status' => 'publicada']);

    $version = (int) tenantValue('crm_own_reviews', 'lock_version', ['code' => $code]);

    $this->postJson("/api/v1/reviews/{$code}/reject", [], critical($version))->assertUnprocessable();
    $this->postJson("/api/v1/reviews/{$code}/hide", ['reason' => 'Prueba de contrato'], critical($version))->assertOk();
    expect(tenantValue('crm_own_reviews', 'status', ['code' => $code]))->toBe('oculta');

    $this->getJson('/api/v1/channels/own-reviews')->assertNotFound();
    $this->postJson("/api/v1/channels/own-reviews/{$code}/moderate", ['action' => 'publicar'], critical())->assertNotFound();
});

it('solicitudes de reseña: send y cancel reemplazan a channels/review-requests/{code}', function () {
    actingAsSeed('U01');
    $code = (string) tenantValue('crm_review_requests', 'code', ['status' => 'programada']);

    $this->postJson("/api/v1/review-requests/{$code}/cancel", [], critical())->assertOk();
    expect(tenantValue('crm_review_requests', 'status', ['code' => $code]))->toBe('cancelada');
    expect($this->postJson("/api/v1/review-requests/{$code}/send", [], critical()))->toBeApiError(409, 'RVW-09');

    $this->postJson("/api/v1/channels/review-requests/{$code}", ['action' => 'enviar'], critical())->assertNotFound();
});
