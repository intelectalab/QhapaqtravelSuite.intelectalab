<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

function ntfPaxBody(array $overrides = []): array
{
    return [
        'name' => 'Recordatorio de documentos 72 h',
        'event' => 'viaje',
        'offset_hours' => -72,
        'channels' => ['email', 'whatsapp'],
        'subject' => 'Tu viaje {{reserva}} se acerca',
        'body' => 'Hola {{pasajero}}, recuerda llevar tus documentos para {{producto}}.',
        'lang' => 'ES',
        'only_if_missing_docs' => true,
        ...$overrides,
    ];
}

function ntfPaxAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Plantilla de mensaje', 'entity_id' => $code, 'action' => $action])->exists());
}

function ntfPaxCodes(): array
{
    return collect(test()->getJson('/api/v1/notifications/pax-templates')->assertOk()->json('data.templates'))->pluck('code')->all();
}

it('crear una plantilla de mensaje al pasajero la deja activa con sus canales y condiciones', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody())->assertCreated()->json('data.code');
    $row = rowOf('notif_pax_message_templates', $code);

    expect($code)->toBe('PMT-011')
        ->and($row->active)->toBeTrue()
        ->and($row->event)->toBe('viaje')
        ->and((int) $row->offset_hours)->toBe(-72)
        ->and($row->channels)->toBe('{email,whatsapp}')
        ->and(json_decode((string) $row->conditions, true)['onlyIfMissingDocs'])->toBeTrue()
        ->and(ntfPaxCodes())->toContain($code)
        ->and(ntfPaxAudit($code, 'crear'))->toBeTrue();
});

it('MSG-01: valida variables, asunto para correo, canales y longitud para WhatsApp', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody(['body' => 'Hola {{nombre_secreto}}, te esperamos.']))->assertStatus(422)->assertJsonValidationErrors(['body']);
    $this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody(['subject' => '']))->assertStatus(422)->assertJsonValidationErrors(['subject']);
    $this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody(['channels' => ['whatsapp'], 'subject' => '', 'body' => str_repeat('a', 1025)]))->assertStatus(422)->assertJsonValidationErrors(['body']);
    $this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody(['channels' => [], 'event' => 'otro', 'offset_hours' => 900]))->assertStatus(422)->assertJsonValidationErrors(['channels', 'event', 'offset_hours']);

    $this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody(['channels' => ['whatsapp'], 'subject' => '']))->assertCreated();
    expect(withinTenant(tenantA(), fn () => DB::table('notif_pax_message_templates')->count()))->toBe(11);
});

it('eliminar una plantilla sin mensajes enviados la quita del listado', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody())->assertCreated()->json('data.code');

    $this->deleteJson("/api/v1/notifications/pax-templates/{$code}")->assertOk()->assertJsonPath('data.code', $code);

    expect(rowOf('notif_pax_message_templates', $code))->toBeNull()
        ->and(ntfPaxCodes())->not->toContain($code)
        ->and(ntfPaxAudit($code, 'eliminar'))->toBeTrue()
        ->and($this->deleteJson("/api/v1/notifications/pax-templates/{$code}"))->toBeApiError(404);
});

it('MSG-04: una plantilla con mensajes enviados no se elimina, se desactiva', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->whereNull('template_id')->where('status', '<>', 'programado')->limit(1)->update(['template_id' => idOf('notif_pax_message_templates', 'PMT-001')]));
    expect(withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->where('template_id', idOf('notif_pax_message_templates', 'PMT-001'))->exists()))->toBeTrue();

    expect($this->deleteJson('/api/v1/notifications/pax-templates/PMT-001'))->toBeApiError(409, 'MSG-04')
        ->and(rowOf('notif_pax_message_templates', 'PMT-001'))->not->toBeNull();

    $this->patchJson('/api/v1/notifications/pax-templates/PMT-001', ['active' => false])->assertOk()->assertJsonPath('data.active', false);
    expect(rowOf('notif_pax_message_templates', 'PMT-001')->active)->toBeFalse();
});

it('restaurar la plantilla predeterminada conserva las versiones de la agencia y la prueba vuelve a usar la del sistema', function () {
    Mail::fake();
    actingAsSeed('U01');
    $system = $this->getJson('/api/v1/notifications/templates/pago.recibido/email')->assertOk()->json('data');
    $this->putJson('/api/v1/notifications/templates/pago.recibido/email', ['subject' => 'Pago confirmado de {{reserva}}', 'body' => 'Hola {{cliente}}, registramos tu pago de {{monto}}.'])->assertOk();

    $this->deleteJson('/api/v1/notifications/templates/pago.recibido/email')->assertNoContent();

    expect($this->getJson('/api/v1/notifications/templates/pago.recibido/email')->assertOk()->json('data.source'))->toBe('sistema')
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_templates')->whereNotNull('tenant_id')->where('event_code', 'pago.recibido')->where('channel', 'email')->count()))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Notificación', 'entity_id' => 'pago.recibido.email', 'action' => 'restaurar_plantilla'])->exists()))->toBeTrue();

    $message = $this->postJson('/api/v1/notifications/templates/pago.recibido/email/test')->assertOk()->json('data.message');
    expect($message['channel'])->toBe('email')
        ->and($message['subject'])->not->toContain('Pago confirmado de')
        ->and($system['source'])->toBe('sistema');
});

it('NTF-BR-05: no se restaura lo que ya usa la plantilla del sistema y un canal no configurable responde 404', function () {
    actingAsSeed('U01');

    expect($this->deleteJson('/api/v1/notifications/templates/reserva.confirmada/whatsapp'))->toBeApiError(409, 'NTF-BR-05')
        ->and($this->deleteJson('/api/v1/notifications/templates/pago.recibido/portal'))->toBeApiError(404)
        ->and($this->deleteJson('/api/v1/notifications/templates/evento.inventado/email'))->toBeApiError(404);
});

it('probar una plantilla con un borrador envía el mensaje al usuario actual sin guardar el borrador', function () {
    Mail::fake();
    $user = actingAsSeed('U01');

    $message = $this->postJson('/api/v1/notifications/templates/reserva.confirmada/email/test', ['subject' => 'Borrador: tu reserva {{reserva}}', 'body' => 'Hola {{cliente}}, esto es una prueba.'])->assertOk()->json('data.message');

    expect($message['subject'])->toContain('Borrador: tu reserva RES-')
        ->and($message['subject'])->not->toContain('{{')
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('code', $message['code'])->value('recipient_user_id')))->toBe($user->id)
        ->and($this->getJson('/api/v1/notifications/templates/reserva.confirmada/email')->json('data.source'))->toBe('sistema')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Notificación', 'entity_id' => 'reserva.confirmada.email', 'action' => 'probar_plantilla', 'after_value' => $message['code']])->exists()))->toBeTrue();
});

it('NTF-BR-03 / NTF-BR-04: la prueba valida las variables y el largo del push', function () {
    actingAsSeed('U01');
    $count = withinTenant(tenantA(), fn () => DB::table('notif_messages')->count());

    expect($this->postJson('/api/v1/notifications/templates/pago.recibido/email/test', ['body' => 'Total {{precio}}']))->toBeApiError(422, 'NTF-BR-03')
        ->and($this->postJson('/api/v1/notifications/templates/pago.recibido/push/test', ['subject' => 'Pago', 'body' => str_repeat('a', 141)]))->toBeApiError(422, 'NTF-BR-04')
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->count()))->toBe($count);
});

it('Gerencia no administra plantillas', function () {
    actingAsSeed('U02');

    expect($this->postJson('/api/v1/notifications/pax-templates', ntfPaxBody()))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/notifications/pax-templates/PMT-002'))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/notifications/templates/pago.recibido/email'))->toBeApiError(403)
        ->and($this->postJson('/api/v1/notifications/templates/pago.recibido/email/test'))->toBeApiError(403);
});
