<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

it('05 §6: el pasajero lee su viaje desde las rutas de la app móvil', function () {
    actingAsSeed('U15');

    foreach (['trip', 'itinerary', 'vouchers', 'documents', 'alerts', 'messages', 'support'] as $path) {
        $this->getJson("/api/v1/mobile/passenger/{$path}")->assertOk();
    }

    expect($this->getJson('/api/v1/mobile/passenger/trip')->json('data'))->toBe($this->getJson('/api/v1/portal/passenger/trip')->json('data'));
});

it('05 §6: el pasajero escribe a la agencia y marca sus mensajes como leídos', function () {
    actingAsSeed('U15');

    $this->postJson('/api/v1/mobile/passenger/messages', ['body' => '¿A qué hora pasan por el hotel mañana?'], critical())->assertSuccessful();
    $messages = $this->getJson('/api/v1/mobile/passenger/messages')->assertOk()->json('data');

    expect(json_encode($messages, JSON_UNESCAPED_UNICODE))->toContain('pasan por el hotel');
});

it('05 §6: el pasajero descarga el itinerario como enlace firmado y no ve documentos ajenos', function () {
    Storage::fake('local');
    Storage::disk('local')->buildTemporaryUrlsUsing(fn (string $path, DateTimeInterface $expiration): string => "https://archivos.prueba/{$path}");
    actingAsSeed('U15');

    $itinerary = $this->getJson('/api/v1/mobile/passenger/documents/itinerary/download')->assertOk()->json('data');
    expect($itinerary)->toHaveKeys(['file_name', 'url', 'expires_at']);

    expect($this->getJson('/api/v1/mobile/passenger/documents/VOU-NO-EXISTE/download'))->toBeApiError(404);
});

it('05 §6: el personal de la agencia no usa las rutas del pasajero', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/mobile/passenger/trip')->status())->toBe(403);
});

it('05 §3.13: el pasajero registra su teléfono para recibir avisos', function () {
    actingAsSeed('U15');

    $device = $this->postJson('/api/v1/mobile/devices', ['app' => 'pasajero', 'platform' => 'android', 'app_version' => '1.0.0', 'expo_push_token' => 'ExponentPushToken[pasajero]'])->assertCreated()->json('data.id');

    $this->deleteJson("/api/v1/mobile/devices/{$device}")->assertOk();
});

it('guías y pasajeros cierran sesión desde la app', function (string $user) {
    actingAsSeed($user);

    $this->postJson('/api/v1/auth/logout')->assertOk();
})->with(['U09', 'U15']);

it('05 §6: el pasajero confirma la lectura de una alerta y de un mensaje, y envía un comentario desde la app', function () {
    actingAsSeed('U15');
    $reservation = idOf('booking_reservations', 'RES-2026-000347');
    withinTenant(tenantA(), function () use ($reservation): void {
        DB::table('ops_incidents')->insert([
            'code' => 'INC-APP-01', 'reservation_id' => $reservation, 'type' => 'Horario', 'severity' => 'media', 'title' => 'Cambio de horario',
            'public_title' => 'El recojo se adelanta 30 minutos', 'public_message' => 'Te recogemos a las 4:30.', 'description' => 'Ajuste por tráfico',
            'status' => 'abierta', 'reported_by' => idOf('iam_users', 'U01'), 'sla_hours' => 24, 'sla_due_at' => now()->addDay(),
        ]);
        DB::table('notif_pax_messages')->insert(['code' => 'PXM-APP-1', 'reservation_id' => $reservation, 'channel' => 'email', 'recipient' => 'pasajero@correo.pe', 'subject' => 'Aviso', 'body' => 'Lleva tu pasaporte.', 'status' => 'enviado', 'sent_at' => now()]);
    });

    $this->postJson('/api/v1/mobile/passenger/alerts/INC-APP-01/read', [])->assertOk();
    $this->postJson('/api/v1/mobile/passenger/messages/PXM-APP-1/read', [])->assertOk()->assertJsonPath('data.updated', 1);
    $this->postJson('/api/v1/mobile/passenger/feedback', ['type' => 'felicitacion', 'rating' => 5, 'text' => 'Todo salió muy bien en el viaje.'], critical())->assertCreated();

    expect(withinTenant(tenantA(), fn () => DB::table('ops_incident_pax_acks')->where('incident_id', DB::table('ops_incidents')->where('code', 'INC-APP-01')->value('id'))->exists()))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_pax_feedback')->where('reservation_id', $reservation)->where('text', 'Todo salió muy bien en el viaje.')->value('status')))->toBe('nuevo');
});
