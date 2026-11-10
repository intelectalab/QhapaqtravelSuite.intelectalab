<?php

use Illuminate\Support\Facades\DB;

function crmMetaHistorial(string $code): array
{
    $id = rowOf('crm_sales_targets', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('crm_sales_target_adjustments')->where('target_id', $id)->orderBy('occurred_at')->get()->all());
}

function crmMetaAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Meta comercial')->where('entity_id', $code)->where('action', $action)->exists());
}

function crmMetaVersion(string $code): int
{
    return (int) rowOf('crm_sales_targets', $code)->lock_version;
}

it('crear una meta para un asesor la deja en borrador con su período, historial y bono', function () {
    actingAsSeed('U02');
    $seller = seedUser('U03');

    $code = $this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'asesor', 'scope_id' => $seller->id, 'period' => '2026-11', 'goal_sales' => 45000, 'goal_bookings' => 12, 'bonus_amount' => 650])
        ->assertCreated()->json('data.code');

    $target = rowOf('crm_sales_targets', $code);
    expect($target->status)->toBe('borrador')
        ->and($target->period_from)->toBe('2026-11-01')
        ->and($target->period_to)->toBe('2026-11-30')
        ->and((float) $target->goal_sales_pen)->toBe(45000.0)
        ->and((float) $target->bonus_amount)->toBe(650.0)
        ->and($target->bonus_currency)->toBe('PEN')
        ->and(collect(crmMetaHistorial($code))->pluck('action')->all())->toBe(['crear'])
        ->and(crmMetaAuditada($code, 'crear'))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/crm/sales-targets')->assertOk()->json('data.targets'))->pluck('code'))->toContain($code);
});

it('crear una meta de sede activada nace vigente y sin bono', function () {
    actingAsSeed('U02');
    $sede = withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('name', 'Arequipa — Yanahuara')->value('id'));

    $code = $this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'sede', 'scope_id' => $sede, 'period' => '2026-Q4', 'goal_sales' => 80000, 'bonus_amount' => 500, 'activate' => true])
        ->assertCreated()->json('data.code');

    $target = rowOf('crm_sales_targets', $code);
    expect($target->status)->toBe('vigente')
        ->and($target->period_type)->not->toBeNull()
        ->and($target->period_to)->toBe('2026-12-31')
        ->and($target->bonus_amount)->toBeNull();
});

it('no se repite la meta de un alcance y período, ni se crea para un período terminado', function () {
    actingAsSeed('U02');
    $seller = seedUser('U03');

    expect($this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'asesor', 'scope_id' => $seller->id, 'period' => '2026-10', 'goal_sales' => 1000]))->toBeApiError(409, 'MET-BR-01');
    expect($this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'asesor', 'scope_id' => $seller->id, 'period' => '2026-08', 'goal_sales' => 1000]))->toBeApiError(422, 'MET-BR-03');
    expect($this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'asesor', 'scope_id' => '01a1b4f8-0000-7000-8000-000000000000', 'period' => '2026-12', 'goal_sales' => 1000]))->toBeApiError(422, 'VALIDATION_ERROR');
});

it('crear una meta valida alcance, período y meta de ventas', function () {
    actingAsSeed('U02');

    $this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'region', 'scope_id' => 'x', 'period' => 'noviembre', 'goal_sales' => 0, 'goal_conversion' => 120])
        ->assertStatus(422)->assertJsonValidationErrors(['scope_type', 'scope_id', 'period', 'goal_sales', 'goal_conversion']);
});

it('Ventas consulta metas pero no las crea', function () {
    $seller = actingAsSeed('U03');

    expect($this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'asesor', 'scope_id' => $seller->id, 'period' => '2026-12', 'goal_sales' => 99999]))->toBeApiError(403);
});

it('ajustar una meta exige motivo y guarda el antes y después', function () {
    actingAsSeed('U02');

    $this->patchJson('/api/v1/crm/sales-targets/MET-0014', ['goal_sales' => 65000])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->patchJson('/api/v1/crm/sales-targets/MET-0014', ['goal_sales' => 65000, 'goal_bookings' => 15, 'bonus_amount' => 700, 'reason' => 'Nueva campaña de temporada alta'])->assertOk();

    $target = rowOf('crm_sales_targets', 'MET-0014');
    $last = collect(crmMetaHistorial('MET-0014'))->last();
    expect((float) $target->goal_sales_pen)->toBe(65000.0)
        ->and((float) $target->bonus_amount)->toBe(700.0)
        ->and($last->action)->toBe('ajustar')
        ->and($last->reason)->toBe('Nueva campaña de temporada alta')
        ->and((float) json_decode((string) $last->before, true)['goal_sales_pen'])->toBe(60000.0)
        ->and((float) json_decode((string) $last->after, true)['goal_sales_pen'])->toBe(65000.0)
        ->and(crmMetaAuditada('MET-0014', 'ajustar'))->toBeTrue();
});

it('pasado el 50 % del período solo el administrador reduce una meta vigente', function () {
    actingAsSeed('U02');
    expect($this->patchJson('/api/v1/crm/sales-targets/MET-0008', ['goal_sales' => 7000, 'reason' => 'Bajo rendimiento del mes']))->toBeApiError(403, 'MET-BR-05')
        ->and((float) rowOf('crm_sales_targets', 'MET-0008')->goal_sales_pen)->toBe(9000.0);

    $this->patchJson('/api/v1/crm/sales-targets/MET-0008', ['goal_sales' => 9500, 'reason' => 'Subimos la meta del mes'])->assertOk();

    actingAsSeed('U01');
    $this->patchJson('/api/v1/crm/sales-targets/MET-0008', ['goal_sales' => 7000, 'reason' => 'Ajuste autorizado por dirección'])->assertOk();
    expect((float) rowOf('crm_sales_targets', 'MET-0008')->goal_sales_pen)->toBe(7000.0);
});

it('una meta cerrada no se ajusta', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/crm/sales-targets/MET-0001', ['goal_sales' => 1, 'reason' => 'Intento sobre meta cerrada']))->toBeApiError(409, 'MET-STATE');
});

it('activar una meta en borrador la deja vigente y solo aplica a borradores', function () {
    actingAsSeed('U02');

    $version = crmMetaVersion('MET-0013');
    $this->postJson('/api/v1/crm/sales-targets/MET-0013/activate', [], critical($version))->assertOk();

    expect($this->postJson('/api/v1/crm/sales-targets/MET-0013/void', ['reason' => 'Versión vieja de la meta'], critical($version)))->toBeApiError(409, 'STALE_VERSION');
    expect(rowOf('crm_sales_targets', 'MET-0013')->status)->toBe('vigente')
        ->and(crmMetaVersion('MET-0013'))->toBe($version + 1)
        ->and(collect(crmMetaHistorial('MET-0013'))->last()->action)->toBe('activar')
        ->and(crmMetaAuditada('MET-0013', 'activar'))->toBeTrue();
    expect($this->postJson('/api/v1/crm/sales-targets/MET-0013/activate', [], critical(crmMetaVersion('MET-0013'))))->toBeApiError(409, 'MET-STATE');
});

it('anular una meta exige motivo y libera el alcance y período para una nueva', function () {
    actingAsSeed('U02');

    $this->postJson('/api/v1/crm/sales-targets/MET-0015/void', [], critical(crmMetaVersion('MET-0015')))->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/crm/sales-targets/MET-0015/void', ['reason' => 'Se cargó con el monto equivocado'], critical(crmMetaVersion('MET-0015')))->assertOk();

    expect(rowOf('crm_sales_targets', 'MET-0015')->status)->toBe('anulada')
        ->and(collect(crmMetaHistorial('MET-0015'))->last()->reason)->toBe('Se cargó con el monto equivocado');

    $this->postJson('/api/v1/crm/sales-targets', ['scope_type' => 'asesor', 'scope_id' => seedUser('U04')->id, 'period' => '2026-10', 'goal_sales' => 28000, 'activate' => true])->assertCreated();
    expect($this->postJson('/api/v1/crm/sales-targets/MET-0001/void', ['reason' => 'Ya no corresponde'], critical(crmMetaVersion('MET-0001'))))->toBeApiError(409, 'MET-STATE');
});

it('cerrar una meta de un período terminado congela el resultado', function () {
    actingAsSeed('U02');

    $this->postJson('/api/v1/crm/sales-targets/MET-0005/close', [], critical(crmMetaVersion('MET-0005')))->assertOk();

    $target = rowOf('crm_sales_targets', 'MET-0005');
    $result = json_decode((string) $target->result, true);
    expect($target->status)->toBe('cerrada')
        ->and($result)->toHaveKeys(['sales', 'bookings', 'margin', 'conversion', 'reservation_ids', 'closed_at'])
        ->and(collect(crmMetaHistorial('MET-0005'))->last()->action)->toBe('cerrar')
        ->and(crmMetaAuditada('MET-0005', 'cerrar'))->toBeTrue();
});

it('no se cierra una meta cuyo período sigue en curso ni una que no está vigente', function () {
    actingAsSeed('U02');

    expect($this->postJson('/api/v1/crm/sales-targets/MET-0008/close', [], critical(crmMetaVersion('MET-0008'))))->toBeApiError(422, 'MET-BR-06');
    expect($this->postJson('/api/v1/crm/sales-targets/MET-0013/close', [], critical(crmMetaVersion('MET-0013'))))->toBeApiError(409, 'MET-STATE');
    expect(rowOf('crm_sales_targets', 'MET-0008')->status)->toBe('vigente');
});
