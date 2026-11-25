<?php

it('en desarrollo con proveedores de prueba el menú no marca nada como próximamente', function () {
    config(['integrations.require_real' => false]);
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/me/access')->assertOk()->json('data.upcoming'))->toBe([]);
});

it('en producción las pantallas sin proveedor real se marcan como próximamente', function () {
    config(['integrations.require_real' => true]);
    actingAsSeed('U01');

    $upcoming = $this->getJson('/api/v1/me/access')->assertOk()->json('data.upcoming');

    expect(array_keys($upcoming))->toEqualCanonicalizing(['/asistente', '/catalogo/importar', '/canales/contenido-ia', '/canales/ota', '/canales/resenas', '/finanzas/exportacion-contable'])
        ->and($upcoming['/asistente'])->toBe(['feature' => 'sales_ai', 'label' => 'Asistente de ventas con IA', 'message' => 'El asistente de ventas con IA estará disponible próximamente.'])
        ->and(json_encode($upcoming))->not->toContain('fake');
});

it('con un proveedor real configurado la pantalla deja de marcarse', function () {
    config(['integrations.require_real' => true, 'integrations.drivers.sales_ai' => 'openai']);
    actingAsSeed('U01');

    $upcoming = $this->getJson('/api/v1/me/access')->assertOk()->json('data.upcoming');

    expect($upcoming)->not->toHaveKeys(['/asistente', '/catalogo/importar'])
        ->and($upcoming)->toHaveKey('/canales/contenido-ia');
});
