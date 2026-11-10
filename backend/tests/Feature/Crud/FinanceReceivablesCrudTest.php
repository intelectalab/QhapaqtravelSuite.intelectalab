<?php

use Illuminate\Support\Facades\DB;

it('anular una cuota abierta la deja cancelada con fecha, motivo y auditoría', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/receivables/CXC-00711/cancel', ['reason' => 'Cliente cambió la forma de pago'], critical())->assertOk()->assertJsonPath('data.code', 'CXC-00711');

    $row = rowOf('fin_receivables', 'CXC-00711');
    expect($row->status)->toBe('cancelada')
        ->and($row->cancel_reason)->toBe('Cliente cambió la forma de pago')
        ->and($row->cancelled_at)->not->toBeNull()
        ->and($row->deleted_at)->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Cuenta por cobrar', 'entity_id' => 'CXC-00711', 'action' => 'cancelar', 'before_value' => 'abierta'])->exists()))->toBeTrue();
});

it('una cuota anulada ya no recibe pagos', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/receivables/CXC-00712/cancel', ['reason' => 'Reserva reemplazada'], critical())->assertOk();

    $response = $this->postJson('/api/v1/finance/payments', ['receivable_id' => 'CXC-00712', 'method' => 'transferencia_bcp', 'amount' => '100.00', 'paid_on' => BUSINESS_TODAY, 'reference' => 'OP-CANCELADA'], critical());

    expect($response->status())->toBeIn([404, 409, 422])
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'OP-CANCELADA')->exists()))->toBeFalse()
        ->and((string) rowOf('fin_receivables', 'CXC-00712')->paid_amount)->toBe('0.00');
});

it('FIN-BR-01: una cuota pagada o ya anulada no se anula', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/finance/receivables/CXC-00710/cancel', ['reason' => 'Intento de anulación'], critical()))->toBeApiError(409, 'FIN-BR-01')
        ->and(rowOf('fin_receivables', 'CXC-00710')->status)->toBe('pagada');

    $this->postJson('/api/v1/finance/receivables/CXC-00711/cancel', ['reason' => 'Cliente cambió la forma de pago'], critical())->assertOk();
    expect($this->postJson('/api/v1/finance/receivables/CXC-00711/cancel', ['reason' => 'Otra vez'], critical()))->toBeApiError(409, 'FIN-BR-01');
});

it('anular exige motivo y el perfil operativo de Finanzas', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/receivables/CXC-00711/cancel', ['reason' => 'x'], critical())->assertStatus(422)->assertJsonValidationErrors(['reason']);

    foreach (['U02', 'U08'] as $user) {
        actingAsSeed($user);
        expect($this->postJson('/api/v1/finance/receivables/CXC-00711/cancel', ['reason' => 'Cliente cambió la forma de pago'], critical()))->toBeApiError(403);
    }

    expect(rowOf('fin_receivables', 'CXC-00711')->status)->toBe('abierta');
});
