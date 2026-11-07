<?php

it('la tarifa de proveedor se decide en el aprobar/rechazar genérico de la bandeja', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/approvals/SOL-TAR-0101/reject', ['note' => 'Costo fuera de mercado'], critical(0))
        ->assertOk()
        ->assertJsonPath('data.status', 'rechazada');

    expect(rowOf('supplier_rate_requests', 'SOL-TAR-0101')->status)->toBe('rechazada')
        ->and(routeExists('POST', '/api/v1/approvals/provider-rates/SOL-TAR-0101/reject'))->toBeFalse()
        ->and(routeExists('POST', '/api/v1/approvals/settlements/LIQ-2026-00001/approve'))->toBeFalse();
});

it('la bandeja expone versión para decidir solicitudes del portal', function () {
    actingAsSeed('U01');

    $item = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->firstWhere('code', 'SOL-TAR-0102');

    expect($item['lock_version'] ?? null)->toBe(0);
});

it('quien no gestiona tarifas no decide la solicitud del proveedor', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/approvals/SOL-TAR-0102/approve', [], critical(0)))->toBeApiError(403);
    expect(rowOf('supplier_rate_requests', 'SOL-TAR-0102')->status)->toBe('pendiente');
});

it('la factura del proveedor se valida u observa en /finance/supplier-invoices', function () {
    expect(routeExists('POST', '/api/v1/finance/supplier-invoices/F001-1/validate'))->toBeTrue()
        ->and(routeExists('POST', '/api/v1/finance/supplier-invoices/F001-1/observe'))->toBeTrue()
        ->and(routeExists('POST', '/api/v1/approvals/supplier-invoices/F001-1/validate'))->toBeFalse();
});
