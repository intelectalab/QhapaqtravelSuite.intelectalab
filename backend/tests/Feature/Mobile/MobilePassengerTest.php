<?php

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
