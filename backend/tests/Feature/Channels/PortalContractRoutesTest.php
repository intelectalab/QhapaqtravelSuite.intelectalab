<?php

it('el portal del cliente responde en las rutas /portal/client del contrato', function (string $path) {
    actingAsSeed('U14');

    $this->getJson("/api/v1/portal/client/{$path}")->assertOk();
})->with(['session', 'home', 'reservations', 'quotes', 'receivables', 'tickets', 'profile']);

it('el pasajero entra al mismo portal con su viaje', function () {
    actingAsSeed('U15');

    $this->getJson('/api/v1/portal/client/session')->assertOk()->assertJsonPath('data.role', 'passenger');
});

it('el portal B2B abre la sesión de la agencia en /b2b/me', function () {
    actingAsSeed('U13');

    $this->getJson('/api/v1/b2b/me')->assertOk();
});

it('las rutas antiguas de los portales ya no existen', function (string $user, string $path) {
    actingAsSeed($user);

    expect($this->getJson("/api/v1/{$path}")->status())->toBe(404);
})->with([
    'portal' => ['U14', 'portal/trips'],
    'b2b' => ['U13', 'b2b/session'],
]);
