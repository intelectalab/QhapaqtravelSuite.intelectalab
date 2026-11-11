<?php

use Illuminate\Support\Facades\DB;

function aprReglaNueva(array $extra = []): array
{
    return ['type' => 'other', 'permission' => 'finance.receivables', 'min_amount' => 3000, 'sla_hours' => 24, 'active' => true, 'forbid_self' => true, ...$extra];
}

function aprRegla(string $type, int $level, float $min): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('collab_approval_rules')->whereNull('deleted_at')->where('request_type', $type)->where('level', $level)->where('min_amount_pen', $min)->first());
}

it('la administración crea una regla de nivel 2 y las solicitudes que superan el umbral suman ese nivel', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/approval-rules', aprReglaNueva())->assertCreated()->json('data.code');

    $rule = rowOf('collab_approval_rules', $code);
    expect((int) $rule->level)->toBe(2)
        ->and($rule->permission)->toBe('finance.receivables')
        ->and($rule->is_origin_locked)->toBeFalse()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Regla de aprobación')->where('entity_id', $code)->where('action', 'crear')->exists()))->toBeTrue();

    actingAsSeed('U03');
    $request = $this->postJson('/api/v1/approvals', ['type' => 'other', 'title' => 'Excepción de pago en destino', 'amount' => 4000, 'currency' => 'PEN', 'justification' => 'El cliente paga el saldo en Cusco por acuerdo comercial.'], critical())->assertCreated()->json('data.code');
    expect((int) rowOf('collab_approval_requests', $request)->total_levels)->toBe(2);
});

it('no se repite tipo, nivel y monto, y el permiso debe tenerlo alguien activo', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/approval-rules', aprReglaNueva(['type' => 'refund', 'min_amount' => 1000])))->toBeApiError(409, 'APR-BR-15');
    $this->postJson('/api/v1/approval-rules', aprReglaNueva(['type' => 'quote_x', 'permission' => 'todo.poderoso', 'sla_hours' => 0]))
        ->assertStatus(422)->assertJsonValidationErrors(['type', 'permission', 'sla_hours']);
});

it('solo se eliminan reglas de nivel 2 y las solicitudes pendientes recalculan sus niveles', function () {
    actingAsSeed('U03');
    $request = $this->postJson('/api/v1/approvals', ['type' => 'refund', 'title' => 'Reembolso por excursión cancelada', 'amount' => 1800, 'currency' => 'PEN', 'justification' => 'La excursión se canceló por lluvias en la ruta.'], critical())->assertCreated()->json('data.code');
    expect((int) rowOf('collab_approval_requests', $request)->total_levels)->toBe(2);

    actingAsSeed('U01');
    expect($this->deleteJson('/api/v1/approval-rules/RA-12'))->toBeApiError(422, 'APR-BR-15');
    $this->deleteJson('/api/v1/approval-rules/RA-13')->assertOk();

    expect(aprRegla('refund', 2, 1000))->toBeNull()
        ->and((int) rowOf('collab_approval_requests', $request)->total_levels)->toBe(1)
        ->and(collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.rules'))->pluck('code'))->not->toContain('RA-13');
});

it('restaurar la matriz devuelve los valores por defecto y quita las reglas propias', function () {
    actingAsSeed('U01');
    $custom = $this->postJson('/api/v1/approval-rules', aprReglaNueva())->assertCreated()->json('data.code');
    $this->patchJson('/api/v1/approval-rules/RA-01', ['min_amount' => 0, 'sla_hours' => 2, 'active' => true, 'forbid_self' => false])->assertOk();
    $this->deleteJson('/api/v1/approval-rules/RA-13')->assertOk();

    $this->postJson('/api/v1/approval-rules/reset')->assertOk()->assertJsonPath('data.rules', 14);

    expect((int) rowOf('collab_approval_rules', 'RA-01')->sla_hours)->toBe(8)
        ->and(rowOf('collab_approval_rules', 'RA-01')->forbid_self_approval)->toBeTrue()
        ->and(aprRegla('refund', 2, 1000)?->code)->toBe('RA-13')
        ->and(aprRegla('other', 2, 3000))->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('collab_approval_rules')->where('code', $custom)->value('deleted_at')))->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Regla de aprobación')->where('entity_id', 'matriz')->where('action', 'restaurar')->exists()))->toBeTrue();
});

it('con varias reglas en el mismo nivel decide la de mayor umbral aplicable (APR-BR-01)', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/approval-rules', aprReglaNueva(['type' => 'refund', 'permission' => 'quotes.approve_internal', 'min_amount' => 8000]))->assertCreated();

    actingAsSeed('U03');
    $small = $this->postJson('/api/v1/approvals', ['type' => 'refund', 'title' => 'Reembolso parcial de hotel', 'amount' => 2000, 'currency' => 'PEN', 'justification' => 'Cambio de hotel por sobreventa del proveedor.'], critical())->json('data.code');
    $large = $this->postJson('/api/v1/approvals', ['type' => 'refund', 'title' => 'Reembolso total del paquete', 'amount' => 9000, 'currency' => 'PEN', 'justification' => 'El cliente no pudo viajar por cierre del aeropuerto.'], critical())->json('data.code');

    actingAsSeed('U02');
    $items = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'));
    expect($items->firstWhere('code', $small)['rule']['code'])->toBe('RA-12');

    $this->postJson("/api/v1/approvals/{$large}/approve", ['note' => 'Conforme'], critical((int) rowOf('collab_approval_requests', $large)->lock_version))->assertOk();
    $items = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'));
    expect($items->firstWhere('code', $large)['permission'])->toBe('quotes.approve_internal')
        ->and($items->firstWhere('code', $large)['level'])->toBe(2);
});

it('la solicitud de crédito B2B exige la agencia y guarda agencia y reserva como origen', function () {
    actingAsSeed('U03');
    $base = ['type' => 'credit_b2b', 'title' => 'Ampliar línea de crédito', 'amount' => 3000, 'currency' => 'PEN', 'justification' => 'La agencia tiene tres grupos confirmados para diciembre.'];

    $this->postJson('/api/v1/approvals', $base, critical())->assertStatus(422)->assertJsonValidationErrors(['agency']);
    expect($this->postJson('/api/v1/approvals', [...$base, 'agency' => 'AGB-99'], critical()))->toBeApiError(422, 'VALIDATION_ERROR');

    $agency = withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->whereNull('deleted_at')->orderBy('code')->first(['id', 'code']));
    $code = $this->postJson('/api/v1/approvals', [...$base, 'agency' => $agency->code, 'reservation' => 'RES-2026-000346'], critical())->assertCreated()->json('data.code');

    $request = rowOf('collab_approval_requests', $code);
    $item = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->firstWhere('code', $code);
    expect($request->subject_type)->toBe('channel_b2b_agencies')
        ->and($request->subject_id)->toBe($agency->id)
        ->and($request->subject_code)->toBe($agency->code)
        ->and($item['agency'])->toBe($agency->code)
        ->and($item['reservation'])->toBe('RES-2026-000346')
        ->and($this->getJson('/api/v1/approvals')->json('data.options.agencies'))->not->toBeEmpty();
});

it('la reversión de pago llega a la bandeja con los datos del pago y al aprobarla revierte el pago', function () {
    actingAsSeed('U07');
    $item = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->firstWhere('code', 'APR-2026-0008');

    expect($item['type'])->toBe('reversal')
        ->and($item['href'])->toBe('/finanzas/pagos/PAG-01921')
        ->and(collect($item['facts'])->first())->toStartWith('Pago: PAG-01921')
        ->and($item['can_decide'])->toBeTrue();

    $this->postJson('/api/v1/approvals/APR-2026-0008/approve', ['note' => 'Se registra de nuevo con el TC del día'], critical((int) rowOf('collab_approval_requests', 'APR-2026-0008')->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'aprobada');

    $payment = rowOf('fin_payments', 'PAG-01921');
    expect($payment->status)->toBe('revertido')
        ->and($payment->reversal_request_id)->toBe(rowOf('collab_approval_requests', 'APR-2026-0008')->id);
});

it('crear, eliminar y restaurar reglas es solo de la administración', function () {
    actingAsSeed('U02');

    expect($this->postJson('/api/v1/approval-rules', aprReglaNueva()))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/approval-rules/RA-13'))->toBeApiError(403)
        ->and($this->postJson('/api/v1/approval-rules/reset'))->toBeApiError(403);
});
