<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockTreasury();
    Queue::fake();
});

function gapAudit(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => $entity, 'entity_id' => $code, 'action' => $action])->exists());
}

function gapOpenReceivableWithEmail(): object
{
    return withinTenant(tenantA(), fn () => DB::table('fin_receivables as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')
        ->whereIn('r.status', ['abierta', 'parcial', 'vencida'])->where('c.email', 'like', '%@%')->orderBy('r.code')->first(['r.code', 'r.id']))
        ?? throw new RuntimeException('No hay cuotas abiertas con correo.');
}

it('solicitar anticipo crea la cuota por lo que falta comprometer y avisa al cliente', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/receivables/CXC-00711/cancel', ['reason' => 'Se reemplaza por un anticipo'], critical())->assertOk();
    $option = collect($this->getJson('/api/v1/finance/receivables')->assertOk()->json('data.advance_reservations'))->first() ?? throw new RuntimeException('Sin reservas con saldo por comprometer.');

    $code = $this->postJson('/api/v1/finance/receivables/advances', ['reservation' => $option['value'], 'amount' => min(100, $option['available']), 'due_date' => '2026-10-05', 'concept' => 'Anticipo de prueba', 'notify' => true], critical())->assertCreated()->json('data.code');
    $row = rowOf('fin_receivables', $code);

    expect($row->kind)->toBe('anticipo')
        ->and($row->status)->toBe('abierta')
        ->and($row->due_date)->toBe('2026-10-05')
        ->and(gapAudit('Cuenta por cobrar', $code, 'solicitar_anticipo'))->toBeTrue();
    expect($this->postJson('/api/v1/finance/receivables/advances', ['reservation' => $option['value'], 'amount' => $option['available'] + 1000, 'due_date' => '2026-10-05', 'concept' => 'Demasiado'], critical()))->toBeApiError(422, 'PROC-041');
    expect($this->postJson('/api/v1/finance/receivables/advances', ['reservation' => $option['value'], 'amount' => 10, 'due_date' => '2026-09-01', 'concept' => 'Fecha pasada'], critical()))->toBeApiError(422);

    actingAsSeed('U02');
    expect($this->postJson('/api/v1/finance/receivables/advances', ['reservation' => $option['value'], 'amount' => 10, 'due_date' => '2026-10-05', 'concept' => 'Sin permiso'], critical()))->toBeApiError(403);
});

it('el recordatorio manual queda registrado con el saldo y no se envía a una cuota pagada', function () {
    actingAsSeed('U07');
    $receivable = gapOpenReceivableWithEmail();

    $this->postJson("/api/v1/finance/receivables/{$receivable->code}/reminders", [], critical())->assertCreated()->assertJsonPath('data.code', $receivable->code);
    $reminder = withinTenant(tenantA(), fn () => DB::table('fin_receivable_reminders')->where('receivable_id', $receivable->id)->orderByDesc('sent_at')->first());

    expect($reminder->channels)->toBe('email')
        ->and(rowOf('fin_receivables', $receivable->code)->last_reminder_at)->not->toBeNull()
        ->and($this->getJson("/api/v1/finance/receivables/{$receivable->code}")->json('data.reminders'))->not->toBeEmpty()
        ->and(gapAudit('Cuenta por cobrar', $receivable->code, 'recordar'))->toBeTrue();

    $paid = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('status', 'pagada')->value('code'));
    expect($this->postJson("/api/v1/finance/receivables/{$paid}/reminders", [], critical()))->toBeApiError(409, 'FIN-BR-05');
});

it('reintentar la validación devuelve un pago rechazado a pendiente con su intento', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payments/PAG-01922/reject', ['reason' => 'El abono no figura'], critical((int) rowOf('fin_payments', 'PAG-01922')->lock_version))->assertOk();
    $lock = (int) rowOf('fin_payments', 'PAG-01922')->lock_version;

    expect($this->postJson('/api/v1/finance/payments/PAG-01922/retry', ['lock_version' => $lock - 1], critical()))->toBeApiError(409, 'STALE_VERSION');
    $this->postJson('/api/v1/finance/payments/PAG-01922/retry', ['lock_version' => $lock, 'note' => 'El cliente reenvió la constancia'], critical())->assertOk();
    $row = rowOf('fin_payments', 'PAG-01922');

    expect($row->status)->toBe('pendiente')
        ->and((int) $row->retries)->toBe(1)
        ->and($row->reject_reason)->toBeNull()
        ->and(gapAudit('Pago', 'PAG-01922', 'reintentar'))->toBeTrue()
        ->and($this->getJson('/api/v1/finance/payments/PAG-01922')->json('data.retries'))->toBe(1);
    expect($this->postJson('/api/v1/finance/payments/PAG-01922/retry', [], critical()))->toBeApiError(409, 'FIN-BR-13');
});

it('programar el pago exige la obligación aprobada y una cuenta bancaria de su moneda', function () {
    actingAsSeed('U07');
    $code = $this->postJson('/api/v1/finance/payables', ['reservation' => 'RES-2026-000348', 'provider' => 'PRV-004', 'cost_type' => 'costo_adicional', 'concept' => 'Traslado extra', 'amount' => '320', 'currency' => 'PEN'], critical())->assertCreated()->json('data.code');

    expect($this->postJson("/api/v1/finance/payables/{$code}/schedule", ['scheduled_date' => '2026-10-02', 'bank_account' => 'CTA-01'], critical()))->toBeApiError(422, 'PROC-046');
    $this->postJson("/api/v1/finance/payables/{$code}/approve", ['lock_version' => (int) rowOf('fin_payables', $code)->lock_version], critical((int) rowOf('fin_payables', $code)->lock_version))->assertOk();
    expect($this->postJson("/api/v1/finance/payables/{$code}/schedule", ['scheduled_date' => '2026-10-02', 'bank_account' => 'CTA-02'], critical()))->toBeApiError(422, 'FIN-BR-21');
    expect($this->postJson("/api/v1/finance/payables/{$code}/schedule", ['scheduled_date' => '2026-09-01', 'bank_account' => 'CTA-01'], critical()))->toBeApiError(422);

    $this->postJson("/api/v1/finance/payables/{$code}/schedule", ['scheduled_date' => '2026-10-02', 'bank_account' => 'CTA-01', 'lock_version' => (int) rowOf('fin_payables', $code)->lock_version], critical())->assertOk();
    $row = rowOf('fin_payables', $code);
    $detail = $this->getJson("/api/v1/finance/payables/{$code}")->assertOk()->json('data');

    expect($row->scheduled_date)->toBe('2026-10-02')
        ->and($detail['scheduled']['account']['code'])->toBe('CTA-01')
        ->and(gapAudit('Cuenta por pagar', $code, 'programar'))->toBeTrue();

    $this->postJson("/api/v1/finance/payables/{$code}/payouts", ['method' => 'transferencia', 'amount' => '100', 'paid_on' => BUSINESS_TODAY, 'operation_ref' => 'OP-55', 'lock_version' => (int) rowOf('fin_payables', $code)->lock_version], critical((int) rowOf('fin_payables', $code)->lock_version))->assertCreated();
    expect(collect($this->getJson("/api/v1/finance/payables/{$code}")->json('data.payouts'))->first()['account'])->toBe('BCP Cta. Cte. PEN');

    actingAsSeed('U02');
    expect($this->postJson("/api/v1/finance/payables/{$code}/schedule", ['scheduled_date' => '2026-10-03', 'bank_account' => 'CTA-01'], critical()))->toBeApiError(403);
});

it('editar un costo adicional sin aprobar cambia proveedor, tipo, moneda y cambio como al crear', function () {
    actingAsSeed('U07');
    $code = $this->postJson('/api/v1/finance/payables', ['reservation' => 'RES-2026-000348', 'provider' => 'PRV-004', 'cost_type' => 'costo_adicional', 'concept' => 'Guía adicional', 'amount' => '200', 'currency' => 'PEN'], critical())->assertCreated()->json('data.code');
    $other = withinTenant(tenantA(), fn () => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->where('ref', '<>', 'PRV-004')->orderBy('ref')->value('ref'));

    $this->patchJson("/api/v1/finance/payables/{$code}", ['provider' => $other, 'cost_type' => 'penalidad_proveedor', 'currency' => 'USD', 'fx_rate' => '3.80', 'concept' => 'Guía adicional', 'amount' => '55', 'due_date' => '2026-10-10'], critical())->assertOk();
    $row = rowOf('fin_payables', $code);

    expect($row->currency)->toBe('USD')
        ->and((float) $row->fx_rate)->toBe(3.8)
        ->and($row->cost_type)->toBe('penalidad_proveedor')
        ->and($row->provider_id)->toBe(rowOf('catalog_providers', $other, column: 'ref')->id)
        ->and((string) $row->amount)->toBe('55.00');

    $this->postJson("/api/v1/finance/payables/{$code}/approve", [], critical((int) $row->lock_version))->assertOk();
    expect($this->patchJson("/api/v1/finance/payables/{$code}", ['provider' => 'PRV-004', 'concept' => 'Guía adicional', 'due_date' => '2026-10-10'], critical()))->toBeApiError(409, 'FIN-BR-19');
});

it('recalcular devuelve una comisión aprobada a revisión y una pagada no se recalcula', function () {
    actingAsSeed('U07');
    $approved = rowOf('fin_commissions', 'COM-0301');
    expect($approved->status)->toBe('aprobada');

    $result = $this->postJson('/api/v1/finance/commissions/COM-0301/recalculate', ['lock_version' => (int) $approved->lock_version], critical())->assertOk()->json('data');
    $row = rowOf('fin_commissions', 'COM-0301');

    expect($result['status'])->toBe('calculada')
        ->and($row->status)->toBe('calculada')
        ->and($row->approved_at)->toBeNull()
        ->and((int) $row->lock_version)->toBe((int) $approved->lock_version + 1)
        ->and(gapAudit('Comisión', 'COM-0301', 'recalcular'))->toBeTrue();
    expect($this->postJson('/api/v1/finance/commissions/COM-0298/recalculate', [], critical()))->toBeApiError(409, 'FIN-BR-29');
    expect($this->postJson('/api/v1/finance/commissions/COM-0301/recalculate', ['lock_version' => (int) $approved->lock_version], critical()))->toBeApiError(409, 'STALE_VERSION');

    actingAsSeed('U02');
    expect($this->postJson('/api/v1/finance/commissions/COM-0301/recalculate', [], critical()))->toBeApiError(403);
});

it('las reglas de comisión se crean, se editan con su versión, no se superponen y se desactivan', function () {
    actingAsSeed('U07');
    $rules = $this->getJson('/api/v1/finance/commission-rules')->assertOk()->json('data');
    $direct = collect($rules)->firstWhere('condition', 'directo_ecommerce');

    expect($this->postJson('/api/v1/finance/commission-rules', ['condition' => 'directo_ecommerce', 'pct' => 4, 'base_type' => 'neto_sin_igv', 'valid_from' => '2026-10-01'], critical()))->toBeApiError(409, 'FIN-BR-25');

    $this->patchJson("/api/v1/finance/commission-rules/{$direct['id']}", ['valid_to' => '2026-09-30', 'lock_version' => $direct['lock_version']], critical())->assertOk();
    $id = $this->postJson('/api/v1/finance/commission-rules', ['condition' => 'directo_ecommerce', 'pct' => 4, 'base_type' => 'neto_sin_igv', 'valid_from' => '2026-10-01'], critical())->assertCreated()->json('data.id');
    expect($this->patchJson("/api/v1/finance/commission-rules/{$direct['id']}", ['pct' => 5, 'lock_version' => $direct['lock_version']], critical()))->toBeApiError(409, 'STALE_VERSION');

    $this->patchJson("/api/v1/finance/commission-rules/{$id}", ['active' => false], critical())->assertOk();
    $created = collect($this->getJson('/api/v1/finance/commission-rules')->json('data'))->firstWhere('id', $id);

    expect($created['active'])->toBeFalse()
        ->and($created['pct'])->toEqual(4)
        ->and(collect($this->getJson('/api/v1/finance/commissions')->json('data.rules'))->pluck('id'))->toContain($id)
        ->and(gapAudit('Regla de comisión', $id, 'desactivar'))->toBeTrue();
    expect($this->postJson('/api/v1/finance/commission-rules', ['condition' => 'corporativo_grupos', 'base_type' => 'neto_sin_igv', 'valid_from' => '2027-01-01'], critical()))->toBeApiError(422);

    actingAsSeed('U02');
    expect($this->postJson('/api/v1/finance/commission-rules', ['condition' => 'corporativo_grupos', 'pct' => 2, 'base_type' => 'neto_sin_igv', 'valid_from' => '2027-01-01'], critical()))->toBeApiError(403);
});

it('el cierre del periodo exige todos los controles, se audita y bloquea los cambios', function () {
    actingAsSeed('U08');
    $state = $this->getJson('/api/v1/finance/period-closes/2026-01')->assertOk()->json('data');

    expect($state['status'])->toBe('abierto')
        ->and($state['automatic'])->toHaveCount(4)
        ->and($state['manual'])->toHaveCount(3)
        ->and($state['can']['close'])->toBeFalse();
    expect($this->postJson('/api/v1/finance/period-closes/2026-01/close', [], critical()))->toBeApiError(409, 'FIN-BR-56');

    foreach (['fx', 'aging', 'igv'] as $check) {
        $this->putJson("/api/v1/finance/period-closes/2026-01/checks/{$check}", [], critical())->assertOk();
    }
    $this->deleteJson('/api/v1/finance/period-closes/2026-01/checks/igv', [], critical())->assertOk();
    expect(gapAudit('Cierre contable', '2026-01', 'control_reabierto'))->toBeTrue();
    $this->putJson('/api/v1/finance/period-closes/2026-01/checks/igv', [], critical())->assertOk();

    $closed = $this->postJson('/api/v1/finance/period-closes/2026-01/close', [], critical())->assertCreated()->json('data');

    expect($closed['status'])->toBe('cerrado')
        ->and($closed['closed_by'])->not->toBeNull()
        ->and(gapAudit('Cierre contable', '2026-01', 'cerrar_periodo'))->toBeTrue();
    expect($this->deleteJson('/api/v1/finance/period-closes/2026-01/checks/fx', [], critical()))->toBeApiError(409, 'FIN-BR-57');
    expect($this->getJson('/api/v1/finance/period-closes/2027-05'))->toBeApiError(422);

    actingAsSeed('U02');
    expect($this->getJson('/api/v1/finance/period-closes/2026-01'))->toBeApiError(403);
});

it('la rentabilidad marca las reservas liquidadas y agrupa por canal', function () {
    actingAsSeed('U07');
    $data = $this->getJson('/api/v1/finance/profitability')->assertOk()->json('data');

    expect($data['rows'][0])->toHaveKey('settled_at')
        ->and($data['kpis'])->toHaveKey('settled')
        ->and($data['by_channel'])->not->toBeEmpty()
        ->and($data['monthly'][0])->toHaveKey('margin_pct');
});
