<?php

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function aprSolicitudDatos(array $extra = []): array
{
    return [
        'type' => 'other',
        'title' => 'Excepción de pago en destino',
        'amount' => 1500,
        'currency' => 'PEN',
        'reservation' => 'RES-2026-000350',
        'justification' => 'El cliente paga el saldo en Cusco por acuerdo comercial.',
        ...$extra,
    ];
}

function aprSolicitudNueva(array $extra = []): string
{
    return (string) test()->postJson('/api/v1/approvals', aprSolicitudDatos($extra), critical())->assertCreated()->json('data.code');
}

function aprEventos(string $code): array
{
    $id = rowOf('collab_approval_requests', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('collab_approval_events')->where('request_id', $id)->orderBy('occurred_at')->pluck('event')->all());
}

function aprAuditada(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', $entity)->where('entity_id', $code)->where('action', $action)->exists());
}

function aprTipoCambioUsd(): float
{
    return (float) withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->value('rate_pen'));
}

it('crear una solicitud genérica la deja pendiente en nivel 1 con su plazo y aparece en la bandeja del solicitante', function () {
    $seller = actingAsSeed('U03');

    $code = aprSolicitudNueva();

    $request = rowOf('collab_approval_requests', $code);
    $item = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->firstWhere('code', $code);
    expect($request->status)->toBe('pendiente')
        ->and($request->requester_id)->toBe($seller->id)
        ->and($request->is_generic)->toBeTrue()
        ->and((int) $request->current_level)->toBe(1)
        ->and((int) $request->total_levels)->toBe(1)
        ->and($request->subject_code)->toBe('RES-2026-000350')
        ->and(Carbon::parse($request->due_at)->equalTo(now()->addHours(48)))->toBeTrue()
        ->and(aprEventos($code))->toBe(['creada'])
        ->and(aprAuditada('Aprobación', $code, 'crear'))->toBeTrue()
        ->and($item['mine'])->toBeTrue()
        ->and($item['can_edit'])->toBeTrue()
        ->and($item['can_decide'])->toBeFalse();
});

it('un reembolso en dólares que supera el umbral en soles necesita dos niveles', function () {
    actingAsSeed('U03');
    $fx = aprTipoCambioUsd();

    $code = aprSolicitudNueva(['type' => 'refund', 'amount' => 400, 'currency' => 'USD']);

    $request = rowOf('collab_approval_requests', $code);
    expect(round((float) $request->fx_rate, 4))->toBe(round($fx, 4))
        ->and(400 * $fx)->toBeGreaterThan(1000)
        ->and((int) $request->total_levels)->toBe(2);
});

it('crear una solicitud valida tipo, título, monto y justificación', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/approvals', aprSolicitudDatos(['type' => 'quote', 'title' => 'Hey', 'amount' => -5, 'currency' => 'EUR', 'justification' => 'Corta']), critical())
        ->assertStatus(422)->assertJsonValidationErrors(['type', 'title', 'amount', 'currency', 'justification']);
});

it('quien no usa la bandeja de aprobaciones no crea solicitudes', function () {
    actingAsSeed('U08');

    expect($this->postJson('/api/v1/approvals', aprSolicitudDatos(), critical()))->toBeApiError(403);
});

it('el solicitante edita su solicitud pendiente y los niveles se recalculan con el nuevo monto', function () {
    actingAsSeed('U03');
    $code = aprSolicitudNueva(['type' => 'refund', 'amount' => 300]);
    expect((int) rowOf('collab_approval_requests', $code)->total_levels)->toBe(1);

    $this->patchJson("/api/v1/approvals/{$code}", aprSolicitudDatos(['title' => 'Reembolso por excursión cancelada', 'amount' => 1800, 'reservation' => 'RES-2026-000346']))->assertOk();

    $request = rowOf('collab_approval_requests', $code);
    expect($request->title)->toBe('Reembolso por excursión cancelada')
        ->and((float) $request->amount)->toBe(1800.0)
        ->and($request->subject_code)->toBe('RES-2026-000346')
        ->and($request->request_type)->toBe('refund')
        ->and((int) $request->total_levels)->toBe(2)
        ->and(aprAuditada('Aprobación', $code, 'editar'))->toBeTrue();
});

it('solo el solicitante edita una solicitud genérica y pendiente', function () {
    actingAsSeed('U03');
    $code = aprSolicitudNueva();

    actingAsSeed('U04');
    expect($this->patchJson("/api/v1/approvals/{$code}", aprSolicitudDatos(['title' => 'Edición ajena'])))->toBeApiError(403, 'APR-BR-03');
    expect($this->patchJson('/api/v1/approvals/APR-2026-0008', aprSolicitudDatos(['title' => 'Reversión editada'])))->toBeApiError(403, 'APR-BR-03');
    expect($this->patchJson('/api/v1/approvals/APR-2026-0004', aprSolicitudDatos(['title' => 'Ya resuelta'])))->toBeApiError(409, 'APR-BR-08');
    $this->patchJson("/api/v1/approvals/{$code}", aprSolicitudDatos(['title' => '']))->assertStatus(422)->assertJsonValidationErrors('title');

    expect(rowOf('collab_approval_requests', $code)->title)->toBe('Excepción de pago en destino');
});

it('el solicitante retira su solicitud: queda anulada, con evento, y ya no se decide', function () {
    actingAsSeed('U03');
    $code = aprSolicitudNueva();

    $this->postJson("/api/v1/approvals/{$code}/withdraw", ['note' => 'El cliente pagó completo'], critical((int) rowOf('collab_approval_requests', $code)->lock_version))->assertOk();

    $request = rowOf('collab_approval_requests', $code);
    expect($request->status)->toBe('anulada')
        ->and($request->decided_at)->not->toBeNull()
        ->and(aprEventos($code))->toBe(['creada', 'retirada'])
        ->and(aprAuditada('Aprobación', $code, 'retirar'))->toBeTrue();

    actingAsSeed('U02');
    expect($this->postJson("/api/v1/approvals/{$code}/approve", [], critical((int) $request->lock_version)))->toBeApiError(409, 'APR-BR-08');
});

it('solo quien pidió la aprobación la retira y una solicitud resuelta no se retira', function () {
    actingAsSeed('U03');
    $code = aprSolicitudNueva();

    actingAsSeed('U02');
    expect($this->postJson("/api/v1/approvals/{$code}/withdraw", [], critical((int) rowOf('collab_approval_requests', $code)->lock_version)))->toBeApiError(403, 'APR-BR-03')
        ->and(rowOf('collab_approval_requests', $code)->status)->toBe('pendiente');

    actingAsSeed('U06');
    expect($this->postJson('/api/v1/approvals/APR-2026-0003/withdraw', [], critical((int) rowOf('collab_approval_requests', 'APR-2026-0003')->lock_version)))->toBeApiError(409, 'APR-BR-08');
});

it('una solicitud de cuenta por pagar no se retira desde la bandeja: se resuelve en su origen', function () {
    $request = rowOf('collab_approval_requests', 'APR-2026-0009');
    actingAsUser(withinTenant(tenantA(), fn () => User::query()->findOrFail($request->requester_id)), tenantA());

    expect($request->request_type)->toBe('payable')
        ->and($this->postJson('/api/v1/approvals/APR-2026-0009/withdraw', [], critical((int) $request->lock_version)))->toBeApiError(409, 'APR-WITHDRAW-ORIGIN')
        ->and(rowOf('collab_approval_requests', 'APR-2026-0009')->status)->toBe('pendiente');
});

it('editar una regla cambia el plazo y el permiso que deciden las solicitudes nuevas de ese tipo', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/approval-rules/RA-14', ['permission' => 'finance.receivables', 'min_amount' => 0, 'sla_hours' => 72, 'active' => true, 'forbid_self' => true])->assertOk();

    $rule = rowOf('collab_approval_rules', 'RA-14');
    expect($rule->permission)->toBe('finance.receivables')
        ->and((int) $rule->sla_hours)->toBe(72)
        ->and(aprAuditada('Regla de aprobación', 'RA-14', 'editar'))->toBeTrue();

    actingAsSeed('U03');
    $code = aprSolicitudNueva();
    expect(Carbon::parse(rowOf('collab_approval_requests', $code)->due_at)->equalTo(now()->addHours(72)))->toBeTrue();

    actingAsSeed('U07');
    $this->postJson("/api/v1/approvals/{$code}/approve", ['note' => 'Conforme'], critical((int) rowOf('collab_approval_requests', $code)->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'aprobada');
});

it('el permiso de una regla de origen no cambia aunque se ajusten su plazo y su umbral', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/approval-rules/RA-01', ['permission' => 'finance.receivables', 'min_amount' => 0, 'sla_hours' => 12, 'active' => true, 'forbid_self' => true])->assertOk();

    $rule = rowOf('collab_approval_rules', 'RA-01');
    expect($rule->permission)->toBe('quotes.approve_internal')
        ->and((int) $rule->sla_hours)->toBe(12);
});

it('cada tipo conserva una regla activa de nivel 1 y la regla valida sus datos', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/approval-rules/RA-14', ['min_amount' => 0, 'sla_hours' => 48, 'active' => false, 'forbid_self' => true]))->toBeApiError(422, 'APR-BR-15')
        ->and(rowOf('collab_approval_rules', 'RA-14')->is_active)->toBeTrue();

    $this->patchJson('/api/v1/approval-rules/RA-13', ['min_amount' => 1000, 'sla_hours' => 24, 'active' => false, 'forbid_self' => true])->assertOk();
    expect(rowOf('collab_approval_rules', 'RA-13')->is_active)->toBeFalse();

    $this->patchJson('/api/v1/approval-rules/RA-14', ['permission' => 'todo.poderoso', 'min_amount' => -1, 'sla_hours' => 0, 'active' => true])
        ->assertStatus(422)->assertJsonValidationErrors(['permission', 'min_amount', 'sla_hours', 'forbid_self']);
    expect($this->patchJson('/api/v1/approval-rules/RA-99', ['min_amount' => 0, 'sla_hours' => 24, 'active' => true, 'forbid_self' => true]))->toBeApiError(404);
});

it('una regla desactivada deja de sumar niveles a las solicitudes nuevas', function () {
    actingAsSeed('U01');
    $this->patchJson('/api/v1/approval-rules/RA-13', ['min_amount' => 1000, 'sla_hours' => 24, 'active' => false, 'forbid_self' => true])->assertOk();

    actingAsSeed('U03');
    $code = aprSolicitudNueva(['type' => 'refund', 'amount' => 5000]);

    expect((int) rowOf('collab_approval_requests', $code)->total_levels)->toBe(1);
});

it('solo la administración edita reglas de aprobación', function () {
    actingAsSeed('U02');

    expect($this->patchJson('/api/v1/approval-rules/RA-14', ['min_amount' => 0, 'sla_hours' => 1, 'active' => true, 'forbid_self' => false]))->toBeApiError(403)
        ->and((int) rowOf('collab_approval_rules', 'RA-14')->sla_hours)->toBe(48);
});
