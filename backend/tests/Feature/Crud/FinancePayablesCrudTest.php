<?php

use Illuminate\Support\Facades\DB;

function finCxpBody(array $overrides = []): array
{
    return [
        'reservation' => 'RES-2026-000348',
        'provider' => 'PRV-004',
        'cost_type' => 'gasto_operativo_destino',
        'concept' => 'Movilidad adicional por cierre de vía',
        'amount' => '1250.35',
        'currency' => 'PEN',
        'supplier_doc' => 'F001-4521',
        ...$overrides,
    ];
}

function finCxpAudit(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => $entity, 'entity_id' => $code, 'action' => $action])->exists());
}

function finCxpHistory(string $code): array
{
    return withinTenant(tenantA(), fn () => DB::table('fin_status_history')->where('entity_type', 'payable')->where('entity_id', idOf('fin_payables', $code))->pluck('status')->all());
}

it('registrar un costo adicional crea la obligación abierta, sin aprobar, por el importe exacto y vence en 15 días', function () {
    actingAsSeed('U07');

    $code = $this->postJson('/api/v1/finance/payables', finCxpBody(), critical())->assertCreated()->json('data.code');
    $row = rowOf('fin_payables', $code);

    expect($code)->toStartWith('CXP-')
        ->and($row->kind)->toBe('costo_adicional')
        ->and($row->cost_type)->toBe('gasto_operativo_destino')
        ->and((string) $row->amount)->toBe('1250.35')
        ->and((string) $row->paid_amount)->toBe('0.00')
        ->and($row->currency)->toBe('PEN')
        ->and($row->status)->toBe('abierta')
        ->and($row->approved_at)->toBeNull()
        ->and($row->due_date)->toBe('2026-10-14')
        ->and($row->supplier_doc_number)->toBe('F001-4521')
        ->and($row->reservation_id)->toBe(reservationRow('RES-2026-000348')->id)
        ->and($row->provider_id)->toBe(rowOf('catalog_providers', 'PRV-004', column: 'ref')->id)
        ->and(collect($this->getJson('/api/v1/finance/payables')->assertOk()->json('data.rows'))->pluck('code'))->toContain($code)
        ->and(finCxpAudit('Costo', $code, 'registrar'))->toBeTrue();
});

it('FIN-BR-23: el costo se registra solo sobre una reserva vigente y un proveedor activo', function () {
    actingAsSeed('U07');
    $before = withinTenant(tenantA(), fn () => DB::table('fin_payables')->count());

    expect($this->postJson('/api/v1/finance/payables', finCxpBody(['reservation' => 'RES-2026-000349']), critical()))->toBeApiError(422, 'FIN-BR-23')
        ->and($this->postJson('/api/v1/finance/payables', finCxpBody(['reservation' => 'RES-2026-000343']), critical()))->toBeApiError(422, 'FIN-BR-23');

    withinTenant(tenantA(), fn () => DB::table('catalog_providers')->where('ref', 'PRV-004')->update(['status' => 'inactivo']));
    expect($this->postJson('/api/v1/finance/payables', finCxpBody(), critical()))->toBeApiError(422, 'PRD-BR-007')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payables')->count()))->toBe($before);
});

it('valida importe, moneda, tipo de costo y tipo de cambio', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/payables', finCxpBody(['amount' => '0', 'currency' => 'EUR', 'cost_type' => 'otro', 'fx_rate' => '30']), critical())
        ->assertStatus(422)->assertJsonValidationErrors(['amount', 'currency', 'cost_type', 'fx_rate']);
});

it('FIN-BR-59: Gerencia aprueba cuentas por pagar pero no registra costos; Ventas no entra', function () {
    actingAsSeed('U02');
    expect($this->postJson('/api/v1/finance/payables', finCxpBody(), critical()))->toBeApiError(403, 'FIN-BR-59');

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/finance/payables', finCxpBody(), critical()))->toBeApiError(403);
});

it('anular una cuenta por pagar abierta la deja cancelada con su motivo, historial y auditoría', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/payables/CXP-00405/cancel', ['reason' => 'Servicio no prestado por el proveedor'], critical())->assertOk()->assertJsonPath('data.code', 'CXP-00405');

    $row = rowOf('fin_payables', 'CXP-00405');
    expect($row->status)->toBe('cancelada')
        ->and($row->observation)->toBe('Servicio no prestado por el proveedor')
        ->and($row->deleted_at)->toBeNull()
        ->and(finCxpHistory('CXP-00405'))->toContain('cancelada')
        ->and(finCxpAudit('Cuenta por pagar', 'CXP-00405', 'cancelar'))->toBeTrue();
});

it('una cuenta por pagar anulada ya no se aprueba, no se paga ni se vuelve a anular', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payables/CXP-00405/cancel', ['reason' => 'Servicio duplicado'], critical())->assertOk();
    $lock = (int) rowOf('fin_payables', 'CXP-00405')->lock_version;

    expect($this->postJson('/api/v1/finance/payables/CXP-00405/cancel', ['reason' => 'Otra vez'], critical()))->toBeApiError(409, 'FIN-BR-18')
        ->and($this->postJson('/api/v1/finance/payables/CXP-00405/approve', [], critical($lock)))->toBeApiError(409, 'FIN-BR-18')
        ->and($this->postJson('/api/v1/finance/payables/CXP-00405/payouts', ['method' => 'transferencia', 'amount' => '100', 'paid_on' => BUSINESS_TODAY, 'operation_ref' => 'OP-1'], critical($lock)))->toBeApiError(409, 'FIN-BR-18');
});

it('FIN-BR-18: una obligación pagada o con pagos no se anula', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/finance/payables/CXP-00403/cancel', ['reason' => 'Intento de anulación'], critical()))->toBeApiError(409, 'FIN-BR-18');

    $this->postJson('/api/v1/finance/payables/CXP-00402/payouts', ['method' => 'transferencia', 'amount' => '910.00', 'paid_on' => BUSINESS_TODAY, 'operation_ref' => 'OP-778899'], critical((int) rowOf('fin_payables', 'CXP-00402')->lock_version))->assertCreated();
    expect($this->postJson('/api/v1/finance/payables/CXP-00402/cancel', ['reason' => 'Intento de anulación'], critical()))->toBeApiError(409, 'FIN-BR-18')
        ->and(rowOf('fin_payables', 'CXP-00402')->status)->not->toBe('cancelada');
});

it('anular exige motivo y Ventas no puede anular', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payables/CXP-00405/cancel', ['reason' => 'no'], critical())->assertStatus(422)->assertJsonValidationErrors(['reason']);

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/finance/payables/CXP-00405/cancel', ['reason' => 'Servicio no prestado'], critical()))->toBeApiError(403);
    expect(rowOf('fin_payables', 'CXP-00405')->status)->toBe('abierta');
});

it('un doble envío con la misma Idempotency-Key registra un solo costo adicional y repite la respuesta', function () {
    actingAsSeed('U07');
    $key = idem();
    $count = fn () => withinTenant(tenantA(), fn () => DB::table('fin_payables')->where('concept', 'Movilidad adicional por cierre de vía')->count());
    $before = $count();

    $first = $this->postJson('/api/v1/finance/payables', finCxpBody(), critical(null, $key))->assertCreated();
    $again = $this->postJson('/api/v1/finance/payables', finCxpBody(), critical(null, $key))->assertCreated();

    expect($again->headers->get('Idempotent-Replayed'))->toBe('true')
        ->and($again->json('data.code'))->toBe($first->json('data.code'))
        ->and($count())->toBe($before + 1)
        ->and($this->postJson('/api/v1/finance/payables', finCxpBody(['amount' => '99.00']), critical(null, $key)))->toBeApiError(422, 'IDEMPOTENCY_KEY_REUSED');
});

it('sin Idempotency-Key el costo adicional se registra igual, porque el contrato no la exige', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/payables', finCxpBody())->assertCreated();
});
