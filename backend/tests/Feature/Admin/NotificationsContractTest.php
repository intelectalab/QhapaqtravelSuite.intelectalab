<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

function failedMessage(string $code, string $channel, ?string $userCode, ?string $error = 'Tiempo de espera agotado.'): void
{
    withinTenant(tenantA(), fn () => DB::table('notif_messages')->insert([
        'code' => $code,
        'event_code' => 'reserva.confirmada',
        'channel' => $channel,
        'recipient_user_id' => $userCode ? seedUser($userCode)->id : null,
        'recipient_address' => $userCode ? null : '987 000 111',
        'subject' => 'Reserva confirmada',
        'status' => 'fallido',
        'last_error' => $error,
    ]));
}

it('notifications/rules devuelve la matriz evento × canal con KPIs', function () {
    actingAsSeed('U01');

    $response = $this->getJson('/api/v1/notifications/rules')->assertOk();

    expect($response->json('data'))->toHaveCount(10)
        ->and($response->json('data.0'))->toHaveKeys(['event_code', 'label', 'ch_email', 'ch_whatsapp', 'ch_push', 'ch_portal', 'recipients', 'timing', 'condition'])
        ->and($response->json('meta.kpis'))->toHaveKeys(['sent_7d', 'failed', 'pending', 'routes']);
});

it('T-18: la incidencia crítica no puede quedar sin canales', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/notifications/rules/incidencia.critica', ['ch_email' => false, 'ch_whatsapp' => false, 'ch_push' => false, 'ch_portal' => false]))->toBeApiError(422, 'NTF-BR-01');

    $this->patchJson('/api/v1/notifications/rules/pago.recibido', ['ch_push' => true, 'timing' => 'batch_15m'])->assertOk()
        ->assertJsonPath('data.ch_push', true)->assertJsonPath('data.timing', 'batch_15m');
});

it('rules/{event}/test envía por los canales activos al usuario actual', function () {
    Mail::fake();
    actingAsSeed('U01');
    $this->patchJson('/api/v1/notifications/rules/voucher.emitido', ['ch_email' => true, 'ch_whatsapp' => false, 'ch_push' => false, 'ch_portal' => true]);

    $sent = $this->postJson('/api/v1/notifications/rules/voucher.emitido/test')->assertOk()->json('meta.sent');

    expect($sent)->toHaveCount(2);
});

it('plantillas: lectura predeterminada, nueva versión, prueba y restauración', function () {
    Mail::fake();
    actingAsSeed('U01');
    $uri = '/api/v1/notifications/templates/reserva.confirmada/email';

    $this->getJson($uri)->assertOk()->assertJsonPath('data.source', 'sistema');
    $this->putJson($uri, ['subject' => 'Tu reserva {{reserva}}', 'body' => 'Hola {{cliente}}, confirmamos {{reserva}} para el {{fecha_viaje}}.'])->assertOk()
        ->assertJsonPath('data.source', 'agencia')->assertJsonPath('data.version', 1);
    $this->putJson($uri, ['subject' => 'Tu reserva {{reserva}} está lista', 'body' => 'Hola {{cliente}}.'])->assertOk()->assertJsonPath('data.version', 2);
    $this->postJson("{$uri}/test")->assertOk()->assertJsonPath('data.message.channel', 'email');

    $this->deleteJson($uri)->assertNoContent();
    $this->getJson($uri)->assertOk()->assertJsonPath('data.source', 'sistema');
    expect($this->deleteJson($uri))->toBeApiError(409, 'NTF-BR-05');
});

it('T-19: plantilla con variable no permitida o push de más de 140 caracteres', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/notifications/templates/pago.recibido/email', ['subject' => 'Pago', 'body' => 'Total {{precio}}']))->toBeApiError(422, 'NTF-BR-03');
    expect($this->putJson('/api/v1/notifications/templates/pago.recibido/push', ['subject' => 'Pago', 'body' => str_repeat('a', 141)]))->toBeApiError(422, 'NTF-BR-04');
    expect($this->getJson('/api/v1/notifications/templates/pago.recibido/portal'))->toBeApiError(404);
});

it('notifications/messages filtra por canal y estado', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/notifications/messages?filter[status]=fallido')->assertOk()->json('data');

    expect($data)->not->toBeEmpty()
        ->and(collect($data)->pluck('status')->unique()->all())->toBe(['fallido']);
});

it('NTF-BR-07: un error permanente no se reintenta; uno temporal sí', function () {
    actingAsSeed('U01');
    failedMessage('NTF-PEST-T', 'push', 'U05');

    expect($this->postJson('/api/v1/notifications/messages/NTF-9916/retry'))->toBeApiError(409, 'NTF-BR-07');
    $this->postJson('/api/v1/notifications/messages/NTF-PEST-T/retry')->assertOk()->assertJsonPath('data.status', 'pendiente');
});

it('retry-failed encola los fallidos temporales y omite los permanentes', function () {
    actingAsSeed('U01');
    failedMessage('NTF-PEST-A', 'email', 'U05');

    $data = $this->postJson('/api/v1/notifications/messages/retry-failed')->assertStatus(202)->json('data');

    expect($data['codes'])->toContain('NTF-PEST-A')->not->toContain('NTF-9916')
        ->and($data['skipped'])->toBeGreaterThanOrEqual(1);
});

it('NTF-BR-08: el reenvío por correo solo aplica a otros canales con correo conocido', function () {
    Mail::fake();
    actingAsSeed('U01');
    failedMessage('NTF-PEST-W', 'whatsapp', 'U05', 'Número no registrado (código 131026).');

    $copy = $this->postJson('/api/v1/notifications/messages/NTF-PEST-W/fallback')->assertOk()->json('data');

    expect($copy['channel'])->toBe('email')->and($copy['is_fallback'])->toBeTrue();
    expect($this->postJson('/api/v1/notifications/messages/NTF-PEST-W/fallback'))->toBeApiError(409, 'NTF-BR-08');
    expect($this->postJson('/api/v1/notifications/messages/NTF-9916/fallback'))->toBeApiError(422, 'NTF-BR-08');
});

it('las rutas de notificaciones exigen admin.settings.manage', function (string $method, string $uri) {
    actingAsSeed('U02');

    expect($this->json($method, $uri))->toBeApiError(403);
})->with([
    ['GET', '/api/v1/notifications/rules'],
    ['GET', '/api/v1/notifications/messages'],
    ['GET', '/api/v1/notifications/templates/reserva.confirmada/email'],
    ['POST', '/api/v1/notifications/messages/retry-failed'],
]);
