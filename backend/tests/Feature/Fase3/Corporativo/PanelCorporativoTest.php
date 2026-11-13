<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/Support.php';

beforeEach(function () {
    $this->account = corpAccount();
});

it('U18 abre el panel corporativo: resumen, compras, movimientos, estados, centros, viajeros y usuarios', function () {
    actingAsSeed('U18');

    $session = $this->getJson('/api/v1/portal/client/session')->assertOk();
    expect($session->json('data.corporate.role'))->toBe('administrador');

    $summary = $this->getJson('/api/v1/portal/client/corporate/summary?period='.now()->year)->assertOk();
    expect($summary->json('meta.panel.role'))->toBe('administrador')
        ->and($summary->json('meta.panel.can.manage'))->toBeTrue()
        ->and($summary->json('data.months'))->toHaveCount(12)
        ->and((float) $summary->json('data.kpis.total'))->toBeGreaterThan(0)
        ->and(collect($summary->json('data.cost_centers'))->pluck('code'))->toContain('CC-RRHH');

    $this->getJson('/api/v1/portal/client/corporate/purchases?period='.now()->year)->assertOk()->assertJsonPath('data.currency', 'PEN');
    $movements = $this->getJson('/api/v1/portal/client/corporate/movements?period='.now()->year)->assertOk();
    $rows = collect($movements->json('data.rows'));
    expect($rows->pluck('kind')->unique()->values()->all())->toContain('compra', 'pago')
        ->and($rows->first()['balance'])->toBe($movements->json('data.totals.closing_balance'));

    $statements = $this->getJson('/api/v1/portal/client/corporate/statements')->assertOk();
    expect($statements->json('data.items'))->not->toBeEmpty()->and($statements->json('data.can_manage'))->toBeTrue();
    $this->getJson('/api/v1/portal/client/corporate/statements/'.$statements->json('data.items.0.code').'/pdf')->assertOk()->assertJsonStructure(['data' => ['file_name']]);

    $this->getJson('/api/v1/portal/client/corporate/cost-centers')->assertOk()->assertJsonCount(4, 'data');
    $this->getJson('/api/v1/portal/client/corporate/travelers')->assertOk();
    $this->getJson('/api/v1/portal/client/corporate/users')->assertOk();
    $this->getJson('/api/v1/portal/client/corporate/approvals')->assertOk();
    expect($this->getJson('/api/v1/portal/client/corporate/summary?period=trimestre'))->toBeApiError(422, 'PERIOD_INVALID');
});

it('CP-09: ninguna respuesta del panel incluye costos de proveedor, márgenes ni comisiones', function () {
    actingAsSeed('U18');
    $body = '';

    foreach (['summary', 'purchases', 'movements', 'statements', 'cost-centers', 'approvals', 'travelers', 'users'] as $path) {
        $body .= $this->getJson("/api/v1/portal/client/corporate/{$path}")->assertOk()->getContent();
    }

    expect($body)->not->toMatch('/"(cost_total|net_cost|supplier_cost|margin|margin_pct|commission|commission_amount|cost)"/');
});

it('el administrador configura el envío automático con If-Match y CP-05 exige destinatarios', function () {
    actingAsSeed('U18');
    $lock = (int) rowOf('crm_corporate_accounts', $this->account->id, null, 'id')->lock_version;

    $this->patchJson('/api/v1/portal/client/corporate/statement-settings', ['statement_auto' => true, 'statement_day' => 5, 'statement_recipients' => ['finanzas@mcblanca.com.pe']], ['If-Match' => (string) $lock])
        ->assertOk()->assertJsonPath('data.statement_day', 5)->assertJsonPath('data.statement_recipients.0', 'finanzas@mcblanca.com.pe');
    expect(corpAudited(['entity' => 'Cuenta corporativa', 'entity_id' => 'CLI-0002', 'action' => 'actualizar']))->toBeTrue();

    $lock = (int) rowOf('crm_corporate_accounts', $this->account->id, null, 'id')->lock_version;
    expect($this->patchJson('/api/v1/portal/client/corporate/statement-settings', ['statement_auto' => true, 'statement_day' => 5, 'statement_recipients' => []], ['If-Match' => (string) $lock]))->toBeApiError(422, 'CORP_RECIPIENTS_REQUIRED');
    expect($this->patchJson('/api/v1/portal/client/corporate/statement-settings', ['statement_auto' => false, 'statement_day' => 5, 'statement_recipients' => []], ['If-Match' => (string) ($lock - 1)]))->toBeApiError(409);
});

it('CP-07: el administrador aprueba y rechaza con motivo; una segunda decisión responde 409', function () {
    $approval = corpPendingApproval($this->account, 'CC-RRHH', 'APC-0901');
    actingAsSeed('U18');

    expect($this->postJson('/api/v1/portal/client/corporate/approvals/APC-0901/reject', ['reason' => ''], ['If-Match' => (string) $approval->lock_version]))->toBeApiError(422);
    $this->postJson('/api/v1/portal/client/corporate/approvals/APC-0901/approve', [], critical((int) $approval->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'aprobada')->assertJsonPath('data.approver', 'Úrsula Benavides Lara');
    expect(corpAudited(['entity' => 'Aprobación corporativa', 'entity_id' => 'APC-0901', 'action' => 'aprobar']))->toBeTrue();

    $lock = (int) rowOf('booking_corporate_approvals', 'APC-0901')->lock_version;
    expect($this->postJson('/api/v1/portal/client/corporate/approvals/APC-0901/approve', [], critical($lock)))->toBeApiError(409, 'CP-07');

    $second = corpPendingApproval($this->account, 'CC-GER', 'APC-0902');
    $this->postJson('/api/v1/portal/client/corporate/approvals/APC-0902/reject', ['reason' => 'Fuera del presupuesto del trimestre'], ['If-Match' => (string) $second->lock_version])
        ->assertOk()->assertJsonPath('data.status', 'rechazada')->assertJsonPath('data.reason', 'Fuera del presupuesto del trimestre');
});

it('CP-07 / CP-02: el aprobador solo ve y decide las solicitudes de su centro de costo', function () {
    $own = corpPendingApproval($this->account, 'CC-GER', 'APC-0911');
    $other = corpPendingApproval($this->account, 'CC-RRHH', 'APC-0912', 'RES-2026-000350');
    $user = corpLogin($this->account, 'gpacheco@mcblanca.com.pe', 'Gonzalo Pacheco Ruiz');
    actingAsUser($user, tenantA());

    $codes = collect($this->getJson('/api/v1/portal/client/corporate/approvals')->assertOk()->json('data'))->pluck('code');
    expect($codes)->toContain('APC-0911')->not->toContain('APC-0912');

    $summary = $this->getJson('/api/v1/portal/client/corporate/summary')->assertOk();
    expect($summary->json('meta.panel.role'))->toBe('aprobador')
        ->and(collect($summary->json('data.cost_centers'))->pluck('code')->all())->toBe(['CC-GER']);
    expect($this->getJson('/api/v1/portal/client/corporate/users'))->toBeApiError(403, 'CP-02');

    expect($this->postJson('/api/v1/portal/client/corporate/approvals/APC-0912/approve', [], critical((int) $other->lock_version)))->toBeApiError(403, 'CP-07');
    $this->postJson('/api/v1/portal/client/corporate/approvals/APC-0911/approve', [], critical((int) $own->lock_version))->assertOk()->assertJsonPath('data.status', 'aprobada');
});

it('CP-02: el viajero solo ve sus viajes y no ve estados de cuenta ni aprobaciones', function () {
    $user = corpLogin($this->account, 'evaldivia@mcblanca.com.pe', 'Ernesto Valdivia Ríos');
    actingAsUser($user, tenantA());

    $purchases = collect($this->getJson('/api/v1/portal/client/corporate/purchases?period='.now()->year)->assertOk()->json('data.items'));
    expect($purchases)->not->toBeEmpty()
        ->and($purchases->every(fn (array $row) => in_array('Ernesto Valdivia Ríos', $row['travelers'], true)))->toBeTrue();
    expect($this->getJson('/api/v1/portal/client/corporate/statements'))->toBeApiError(403, 'CP-02')
        ->and($this->getJson('/api/v1/portal/client/corporate/approvals'))->toBeApiError(403, 'CP-02');
});

it('CP-02: un cliente de otra empresa no ve el panel y su sesión no lo muestra', function () {
    actingAsSeed('U14');

    expect($this->getJson('/api/v1/portal/client/session')->assertOk()->json('data.corporate'))->toBeNull();
    expect($this->getJson('/api/v1/portal/client/corporate/summary'))->toBeApiError(403, 'CP-02');

    actingAsSeed('U01');
    expect($this->getJson('/api/v1/portal/client/corporate/summary'))->toBeApiError(403);
});

it('CP-01: con la regla apagada el panel responde 403 y desaparece de la sesión', function () {
    corpRule(false);
    actingAsSeed('U18');

    expect($this->getJson('/api/v1/portal/client/corporate/summary'))->toBeApiError(403, 'RULE_NOT_IN_PLAN')
        ->and($this->getJson('/api/v1/portal/client/session')->json('data.corporate'))->toBeNull();
});

it('el administrador de la empresa invita usuarios, cambia roles, crea centros de costo y viajeros', function () {
    actingAsSeed('U18');

    $member = $this->postJson('/api/v1/portal/client/corporate/users', ['full_name' => 'Rosa Miranda Paz', 'email' => 'rmiranda@mcblanca.com.pe', 'portal_role' => 'viajero', 'cost_center_id' => 'CC-OPS'], critical())
        ->assertCreated()->assertJsonPath('data.portal_role', 'viajero')->json('data.id');
    $this->patchJson("/api/v1/portal/client/corporate/users/{$member}", ['portal_role' => 'pagador', 'cost_center_id' => null])->assertOk()->assertJsonPath('data.portal_role', 'pagador');
    $this->patchJson("/api/v1/portal/client/corporate/users/{$member}", ['status' => 'inactivo'])->assertOk()->assertJsonPath('data.status', 'inactivo');

    $self = corpMember($this->account, 'ubenavides@mcblanca.com.pe');
    expect($this->patchJson("/api/v1/portal/client/corporate/users/{$self->id}", ['status' => 'inactivo']))->toBeApiError(422, 'CP-06');

    $this->postJson('/api/v1/portal/client/corporate/cost-centers', ['code' => 'CC-LOG', 'name' => 'Logística', 'budget_amount' => 18000])->assertCreated()->assertJsonPath('data.code', 'CC-LOG');
    $this->patchJson('/api/v1/portal/client/corporate/cost-centers/CC-LOG', ['budget_amount' => 20000, 'budget_period' => 'mensual'])->assertOk()->assertJsonPath('data.budget_period', 'mensual');
    $this->postJson('/api/v1/portal/client/corporate/travelers', ['full_name' => 'Hugo Ventura Lazo', 'employee_code' => 'MCB-301', 'cost_center_id' => 'CC-LOG'])->assertCreated()->assertJsonPath('data.cost_center', 'CC-LOG');

    expect(corpAudited(['entity' => 'Usuario corporativo', 'entity_id' => 'CLI-0002/rmiranda@mcblanca.com.pe', 'action' => 'desactivar']))->toBeTrue()
        ->and(corpAudited(['entity' => 'Centro de costo', 'entity_id' => 'CLI-0002/CC-LOG', 'action' => 'crear']))->toBeTrue();
});

it('CP-08: la exportación se pide con 202, queda lista con su archivo y solo la descarga quien la pidió', function () {
    actingAsSeed('U18');

    $export = $this->postJson('/api/v1/portal/client/corporate/exports', ['report_type' => 'movimientos', 'format' => 'csv', 'filters' => ['period' => (string) now()->year]], critical())->assertStatus(202);
    $code = $export->json('data.code');
    expect($code)->toMatch('/^EXC-\d{4}$/')
        ->and(corpAudited(['entity' => 'Exportación corporativa', 'entity_id' => $code, 'action' => 'exportar']))->toBeTrue();

    $status = $this->getJson("/api/v1/portal/client/corporate/exports/{$code}")->assertOk();
    expect($status->json('data.status'))->toBe('listo')
        ->and($status->json('data.row_count'))->toBeGreaterThan(0);
    expect(collect($this->getJson('/api/v1/portal/client/corporate/exports')->assertOk()->json('data'))->pluck('code'))->toContain($code);

    $file = $this->get("/api/v1/portal/client/corporate/exports/{$code}?download=1")->assertOk();
    expect((string) $file->headers->get('Content-Type'))->toContain('text/csv')
        ->and($file->getContent())->toContain('Saldo');

    $user = corpLogin($this->account, 'cuentasporpagar@mcblanca.com.pe', 'Milagros Tello Ccori');
    actingAsUser($user, tenantA());
    $this->getJson("/api/v1/portal/client/corporate/exports/{$code}")->assertNotFound();

    $this->postJson('/api/v1/portal/client/corporate/exports', ['report_type' => 'compras', 'format' => 'xlsx'], critical())->assertStatus(202);
    withinTenant(tenantA(), function () use ($user): void {
        $member = DB::table('crm_corporate_portal_users')->where('user_id', $user->getKey())->value('id');
        foreach (range(1, 10) as $index) {
            DB::table('report_corporate_exports')->insert(['tenant_id' => tenantA()->getKey(), 'code' => sprintf('EXC-9%03d', $index), 'account_id' => $this->account->id, 'requested_by_portal_user_id' => $member, 'report_type' => 'compras', 'format' => 'pdf', 'status' => 'en_cola']);
        }
    });
    expect($this->postJson('/api/v1/portal/client/corporate/exports', ['report_type' => 'compras', 'format' => 'pdf'], critical()))->toBeApiError(422, 'CP-08');
});
