<?php

use App\Domain\Corporate\Actions\CorporateStatements;
use Database\Seeders\Modules\CorporateAccountsSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require_once __DIR__.'/Support.php';

beforeEach(function () {
    $this->account = corpAccount();
});

it('lista las cuentas corporativas con saldo y muestra el detalle con centros de costo, viajeros y usuarios', function () {
    actingAsSeed('U01');

    $list = $this->getJson('/api/v1/crm/corporate-accounts')->assertOk();
    expect(collect($list->json('data'))->pluck('client.code'))->toContain('CLI-0002')
        ->and($list->json('meta.kpis.active'))->toBeGreaterThanOrEqual(1);

    $detail = $this->getJson("/api/v1/crm/corporate-accounts/{$this->account->id}")->assertOk();
    expect(collect($detail->json('data.cost_centers'))->pluck('code')->all())->toContain('CC-GER', 'CC-RRHH')
        ->and(collect($detail->json('data.portal_users'))->firstWhere('email', 'ubenavides@mcblanca.com.pe')['portal_role'])->toBe('administrador')
        ->and($detail->json('data.travelers'))->not->toBeEmpty()
        ->and($detail->json('data.default_cost_center.code'))->toBe('CC-RRHH');

    $this->getJson("/api/v1/crm/corporate-accounts/{$this->account->id}/cost-centers")->assertOk()->assertJsonPath('data.0.code', 'CC-GER');
    $this->getJson("/api/v1/crm/corporate-accounts/{$this->account->id}/travelers")->assertOk();
    $this->getJson("/api/v1/crm/corporate-accounts/{$this->account->id}/portal-users")->assertOk();
    $this->getJson('/api/v1/crm/corporate-accounts/form-options')->assertOk()->assertJsonPath('data.roles.0.value', 'administrador');
    $this->getJson('/api/v1/crm/corporate-accounts/no-existe')->assertNotFound();
});

it('da de alta la cuenta de una empresa, rechaza duplicados, personas y aprobación sin umbral, y audita', function () {
    actingAsSeed('U01');

    $created = $this->postJson('/api/v1/crm/corporate-accounts', ['client_id' => 'CLI-0004', 'credit_days' => 15, 'require_approval' => true, 'approval_threshold' => 8000, 'statement_recipients' => ['pagos@colegio.pe']], critical())->assertCreated();
    expect($created->json('data.status'))->toBe('activa')
        ->and($created->json('data.approval_threshold'))->toBe('8000.00')
        ->and(corpAudited(['entity' => 'Cuenta corporativa', 'entity_id' => 'CLI-0004', 'action' => 'alta']))->toBeTrue();

    expect($this->postJson('/api/v1/crm/corporate-accounts', ['client_id' => 'CLI-0004'], critical()))->toBeApiError(409, 'CORP_ACCOUNT_EXISTS');
    expect($this->postJson('/api/v1/crm/corporate-accounts', ['client_id' => 'CLI-0001'], critical()))->toBeApiError(422, 'CORP_CLIENT_COMPANY');
    expect($this->postJson('/api/v1/crm/corporate-accounts', ['client_id' => 'CLI-0009', 'require_approval' => true], critical()))->toBeApiError(422, 'CORP_THRESHOLD_REQUIRED');
    expect($this->postJson('/api/v1/crm/corporate-accounts', ['client_id' => 'CLI-0009'], ['Accept' => 'application/json'])->status())->toBe(422)
        ->and(rowOf('crm_corporate_accounts', idOf('crm_clients', 'CLI-0009'), null, 'client_id'))->toBeNull();
});

it('edita condiciones con If-Match, rechaza versiones viejas y suspende o reactiva la cuenta', function () {
    actingAsSeed('U01');
    $id = $this->account->id;
    $lock = (int) $this->account->lock_version;

    $this->patchJson("/api/v1/crm/corporate-accounts/{$id}", ['credit_days' => 45, 'approval_threshold' => 6000], ['If-Match' => (string) $lock])
        ->assertOk()->assertJsonPath('data.credit_days', 45)->assertJsonPath('data.approval_threshold', '6000.00');
    expect($this->patchJson("/api/v1/crm/corporate-accounts/{$id}", ['credit_days' => 60], ['If-Match' => (string) $lock]))->toBeApiError(409);
    expect(corpAudited(['entity' => 'Cuenta corporativa', 'entity_id' => 'CLI-0002', 'action' => 'actualizar']))->toBeTrue();

    $lock = (int) rowOf('crm_corporate_accounts', $id, null, 'id')->lock_version;
    $this->postJson("/api/v1/crm/corporate-accounts/{$id}/suspend", ['active' => false, 'reason' => 'Facturas vencidas'], ['If-Match' => (string) $lock])->assertOk()->assertJsonPath('data.status', 'suspendida');
    $lock = (int) rowOf('crm_corporate_accounts', $id, null, 'id')->lock_version;
    expect($this->postJson("/api/v1/crm/corporate-accounts/{$id}/suspend", ['active' => false], ['If-Match' => (string) $lock]))->toBeApiError(409, 'CORP_ACCOUNT_SAME_STATUS');
    $this->postJson("/api/v1/crm/corporate-accounts/{$id}/suspend", ['active' => true], ['If-Match' => (string) $lock])->assertOk()->assertJsonPath('data.status', 'activa');
    expect(corpAudited(['entity' => 'Cuenta corporativa', 'entity_id' => 'CLI-0002', 'action' => 'suspender']))->toBeTrue();
});

it('crea, edita y desactiva centros de costo y protege el centro por defecto', function () {
    actingAsSeed('U01');
    $id = $this->account->id;

    $this->postJson("/api/v1/crm/corporate-accounts/{$id}/cost-centers", ['code' => 'cc-mkt', 'name' => 'Marketing', 'budget_amount' => 12000, 'budget_period' => 'trimestral'])
        ->assertCreated()->assertJsonPath('data.code', 'CC-MKT')->assertJsonPath('data.budget_amount', '12000.00');
    expect($this->postJson("/api/v1/crm/corporate-accounts/{$id}/cost-centers", ['code' => 'CC-MKT', 'name' => 'Otra'])->json('code'))->toBe('CORP_COST_CENTER_DUPLICATE');

    $this->patchJson("/api/v1/crm/corporate-accounts/{$id}/cost-centers/CC-MKT", ['budget_amount' => 15000, 'active' => false])->assertOk()->assertJsonPath('data.active', false);
    expect($this->patchJson("/api/v1/crm/corporate-accounts/{$id}/cost-centers/CC-RRHH", ['active' => false]))->toBeApiError(422, 'CORP_COST_CENTER_DEFAULT');
    expect(corpAudited(['entity' => 'Centro de costo', 'entity_id' => 'CLI-0002/CC-MKT', 'action' => 'desactivar']))->toBeTrue();
});

it('registra, edita e importa viajeros sin duplicar documentos', function () {
    actingAsSeed('U01');
    $id = $this->account->id;

    $traveler = $this->postJson("/api/v1/crm/corporate-accounts/{$id}/travelers", ['full_name' => 'Patricia Rojas Vela', 'doc_type' => 'DNI', 'doc_number' => '45879632', 'cost_center_id' => 'CC-OPS'])
        ->assertCreated()->assertJsonPath('data.cost_center', 'CC-OPS')->json('data.id');
    expect($this->postJson("/api/v1/crm/corporate-accounts/{$id}/travelers", ['full_name' => 'Otra Persona', 'doc_type' => 'DNI', 'doc_number' => '45879632'])->json('code'))->toBe('CORP_TRAVELER_DUPLICATE');
    expect($this->postJson("/api/v1/crm/corporate-accounts/{$id}/travelers", ['full_name' => 'Sin Tipo', 'doc_number' => '1234'])->json('code'))->toBe('CORP_TRAVELER_DOC');

    $this->patchJson("/api/v1/crm/corporate-accounts/{$id}/travelers/{$traveler}", ['employee_code' => 'MCB-120', 'active' => false])->assertOk()->assertJsonPath('data.active', false)->assertJsonPath('data.employee_code', 'MCB-120');

    $import = $this->postJson("/api/v1/crm/corporate-accounts/{$id}/travelers/import", ['rows' => [
        ['full_name' => 'Diego Salas Quispe', 'doc_type' => 'DNI', 'doc_number' => '70112233', 'cost_center' => 'CC-SEG'],
        ['full_name' => 'Patricia Rojas Vela', 'doc_type' => 'DNI', 'doc_number' => '45879632', 'email' => 'projas@mcblanca.com.pe'],
        ['full_name' => 'Fila con error', 'doc_type' => 'XYZ', 'doc_number' => '1'],
    ]], critical())->assertOk();
    expect($import->json('data.created'))->toBe(1)
        ->and($import->json('data.updated'))->toBe(1)
        ->and($import->json('data.skipped.0.row'))->toBe(4)
        ->and(corpAudited(['entity' => 'Viajero corporativo', 'entity_id' => 'CLI-0002', 'action' => 'importar']))->toBeTrue();
});

it('invita usuarios del portal con rol, valida CP-06 y reenvía la invitación', function () {
    actingAsSeed('U01');
    $id = $this->account->id;

    $invited = $this->postJson("/api/v1/crm/corporate-accounts/{$id}/portal-users", ['full_name' => 'Lucía Paredes Ríos', 'email' => 'lparedes@mcblanca.com.pe', 'portal_role' => 'aprobador', 'cost_center_id' => 'CC-SEG'], critical())
        ->assertCreated()->assertJsonPath('data.status', 'invitado')->assertJsonPath('data.cost_center', 'CC-SEG');
    $login = rowOf('iam_users', 'lparedes@mcblanca.com.pe', null, 'email');
    expect($login->status)->toBe('pendiente')
        ->and($login->client_id)->toBe($this->account->client_id);

    expect($this->postJson("/api/v1/crm/corporate-accounts/{$id}/portal-users", ['full_name' => 'Repetido', 'email' => 'LParedes@mcblanca.com.pe', 'portal_role' => 'viajero'], critical()))->toBeApiError(422, 'CP-06');
    expect($this->postJson("/api/v1/crm/corporate-accounts/{$id}/portal-users", ['full_name' => 'Sin Centro', 'email' => 'sincentro@mcblanca.com.pe', 'portal_role' => 'aprobador'], critical()))->toBeApiError(422, 'CORP_APPROVER_COST_CENTER');

    $this->postJson("/api/v1/crm/corporate-accounts/{$id}/portal-users/{$invited->json('data.id')}/resend-invite")->assertOk();
    expect(corpAudited(['entity' => 'Usuario corporativo', 'entity_id' => 'CLI-0002/lparedes@mcblanca.com.pe', 'action' => 'reenviar_invitacion']))->toBeTrue();

    $admin = corpMember($this->account, 'ubenavides@mcblanca.com.pe');
    expect($this->patchJson("/api/v1/crm/corporate-accounts/{$id}/portal-users/{$admin->id}", ['portal_role' => 'pagador']))->toBeApiError(422, 'CP-06');
    expect($this->postJson("/api/v1/crm/corporate-accounts/{$id}/portal-users/{$admin->id}/resend-invite"))->toBeApiError(409, 'CORP_INVITE_NOT_PENDING');

    $this->patchJson("/api/v1/crm/corporate-accounts/{$id}/portal-users/{$invited->json('data.id')}", ['portal_role' => 'pagador', 'cost_center_id' => null])->assertOk()->assertJsonPath('data.portal_role', 'pagador');
    expect(corpAudited(['entity' => 'Usuario corporativo', 'entity_id' => 'CLI-0002/lparedes@mcblanca.com.pe', 'action' => 'cambio_rol']))->toBeTrue();
});

it('CP-04: el reparto de costos suma 100 % y su importe suma el total de la reserva', function () {
    actingAsSeed('U01');
    $reservation = reservationRow('RES-2026-000348');

    $this->getJson('/api/v1/reservations/RES-2026-000348/cost-allocations')->assertOk()->assertJsonPath('data.allocations.0.cost_center.code', 'CC-RRHH');

    expect($this->putJson('/api/v1/reservations/RES-2026-000348/cost-allocations', ['allocations' => [['cost_center' => 'CC-RRHH', 'pct' => 60], ['cost_center' => 'CC-GER', 'pct' => 30]]], ['If-Match' => (string) $reservation->lock_version]))->toBeApiError(422, 'CP-04');

    $response = $this->putJson('/api/v1/reservations/RES-2026-000348/cost-allocations', ['allocations' => [['cost_center' => 'CC-RRHH', 'pct' => 66.67], ['cost_center' => 'CC-GER', 'pct' => 33.33]]], ['If-Match' => (string) $reservation->lock_version])->assertOk();
    $amounts = collect($response->json('data.allocations'))->sum(fn (array $row) => (float) $row['amount']);
    expect(round($amounts, 2))->toBe(round((float) $reservation->total_amount, 2))
        ->and(corpAudited(['entity' => 'Reserva', 'entity_id' => 'RES-2026-000348', 'action' => 'reparto_costos']))->toBeTrue();
    expect($this->putJson('/api/v1/reservations/RES-2026-000348/cost-allocations', ['allocations' => [['cost_center' => 'CC-RRHH', 'pct' => 100]]], ['If-Match' => (string) ($reservation->lock_version + 5)]))->toBeApiError(409);
});

it('pide la aprobación de la empresa para la versión vigente de una cotización y no duplica la pendiente', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/crm/corporate-accounts', ['client_id' => 'CLI-0009', 'require_approval' => true, 'approval_threshold' => 5000], critical())->assertCreated();
    $accountId = rowOf('crm_corporate_accounts', idOf('crm_clients', 'CLI-0009'), null, 'client_id')->id;
    $this->postJson("/api/v1/crm/corporate-accounts/{$accountId}/cost-centers", ['code' => 'CC-LAB', 'name' => 'Laboratorio central'])->assertCreated();

    $approval = $this->postJson('/api/v1/quotes/COT-2026-00191/corporate-approval', [], critical())->assertOk();
    expect($approval->json('data.status'))->toBe('pendiente')
        ->and($approval->json('data.reference'))->toBe('COT-2026-00191')
        ->and($approval->json('data.code'))->toMatch('/^APC-\d{4}$/')
        ->and(corpAudited(['entity' => 'Aprobación corporativa', 'entity_id' => $approval->json('data.code'), 'action' => 'solicitar']))->toBeTrue();

    expect($this->postJson('/api/v1/quotes/COT-2026-00191/corporate-approval', [], critical()))->toBeApiError(409, 'CORPORATE_APPROVAL_PENDING');
    expect($this->postJson('/api/v1/quotes/COT-2026-00188/corporate-approval', [], critical()))->toBeApiError(422, 'CORP_ACCOUNT_REQUIRED');
});

it('CP-03: convertir una cotización sobre el umbral exige una aprobación vigente de la empresa', function () {
    $quote = approvedQuote('COT-2026-00188');
    [$accountId, $centerId, $memberId] = withinTenant(tenantA(), function () use ($quote): array {
        $accountId = (string) Str::uuid7();
        DB::table('crm_corporate_accounts')->insert(['id' => $accountId, 'tenant_id' => tenantA()->getKey(), 'client_id' => $quote->client_id, 'currency' => 'USD', 'require_approval' => true, 'approval_threshold' => '100.00']);
        $centerId = (string) Str::uuid7();
        DB::table('crm_corporate_cost_centers')->insert(['id' => $centerId, 'tenant_id' => tenantA()->getKey(), 'account_id' => $accountId, 'code' => 'CC-VIAJES', 'name' => 'Viajes']);
        $memberId = (string) Str::uuid7();
        DB::table('crm_corporate_portal_users')->insert(['id' => $memberId, 'tenant_id' => tenantA()->getKey(), 'account_id' => $accountId, 'email' => 'aprueba@empresa.pe', 'full_name' => 'Aprobador', 'portal_role' => 'aprobador', 'cost_center_id' => $centerId]);

        return [$accountId, $centerId, $memberId];
    });
    $approve = fn (string $createdAt) => withinTenant(tenantA(), fn () => DB::table('booking_corporate_approvals')->insert([
        'id' => (string) Str::uuid7(), 'tenant_id' => tenantA()->getKey(), 'code' => 'APC-'.random_int(5000, 9999), 'account_id' => $accountId,
        'quote_id' => $quote->id, 'cost_center_id' => $centerId, 'amount' => '2026.00', 'currency' => 'USD', 'status' => 'aprobada',
        'approver_portal_user_id' => $memberId, 'decided_at' => now(), 'expires_at' => now()->addDay(), 'created_at' => $createdAt,
    ]));
    $versionAt = (string) withinTenant(tenantA(), fn () => DB::table('quote_versions')->where('id', $quote->current_version_id)->value('created_at'));
    actingAsSeed('U03');

    expect($this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version)))->toBeApiError(422, 'CORPORATE_APPROVAL_REQUIRED');

    $approve(now()->parse($versionAt)->subDay()->toIso8601String());
    expect($this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version)))->toBeApiError(422, 'CORPORATE_APPROVAL_REQUIRED');

    $approve(now()->parse($versionAt)->addMinute()->toIso8601String());
    $this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version))->assertCreated();
});

it('CP-05: genera, envía y anula estados de cuenta mensuales que cuadran y no duplica el mes', function () {
    actingAsSeed('U07');
    $id = $this->account->id;

    $list = $this->getJson('/api/v1/finance/corporate-statements?filter[account_id]='.$id)->assertOk();
    expect($list->json('data'))->not->toBeEmpty()
        ->and(collect($list->json('meta.accounts'))->pluck('client_code'))->toContain('CLI-0002');

    foreach ($list->json('data') as $row) {
        expect(round((float) $row['opening_balance'] + (float) $row['charges'] - (float) $row['payments'] - (float) $row['credits'], 2))->toBe(round((float) $row['closing_balance'], 2));
    }

    $month = now()->format('Y-m');
    $current = collect($list->json('data'))->firstWhere('month', $month);
    if ($current === null) {
        $current = $this->postJson('/api/v1/finance/corporate-statements', ['account_id' => $id, 'month' => $month], critical())->assertCreated()->json('data');
    }

    expect($this->postJson('/api/v1/finance/corporate-statements', ['account_id' => $id, 'month' => $month], critical()))->toBeApiError(409, 'CP-05');
    expect($this->postJson('/api/v1/finance/corporate-statements', ['account_id' => $id, 'month' => now()->addMonths(2)->format('Y-m')], critical()))->toBeApiError(422, 'CP-05');

    $this->postJson("/api/v1/finance/corporate-statements/{$current['code']}/void", ['reason' => 'Se registró un pago tardío'])->assertOk()->assertJsonPath('data.status', 'anulado');
    $regenerated = $this->postJson('/api/v1/finance/corporate-statements', ['account_id' => $id, 'month' => $month], critical())->assertCreated();
    expect($regenerated->json('data.code'))->not->toBe($current['code'])
        ->and(round((float) $regenerated->json('data.opening_balance') + (float) $regenerated->json('data.charges') - (float) $regenerated->json('data.payments') - (float) $regenerated->json('data.credits'), 2))->toBe(round((float) $regenerated->json('data.closing_balance'), 2));

    $code = $regenerated->json('data.code');
    $this->getJson("/api/v1/finance/corporate-statements/{$code}")->assertOk()->assertJsonPath('data.code', $code);
    $this->postJson("/api/v1/finance/corporate-statements/{$code}/send", [], critical())->assertOk()->assertJsonPath('data.status', 'enviado');
    expect(corpAudited(['entity' => 'Estado de cuenta corporativo', 'entity_id' => $code, 'action' => 'enviar']))->toBeTrue();
    expect($this->postJson("/api/v1/finance/corporate-statements/{$current['code']}/send", [], critical()))->toBeApiError(409, 'CORP_STATEMENT_VOID');
    $this->getJson("/api/v1/finance/corporate-statements/{$code}/pdf")->assertOk()->assertJsonStructure(['data' => ['document_id', 'file_name']]);
});

it('CP-05: el envío automático genera el mes anterior una sola vez', function () {
    $tenant = tenantA();
    $sent = withinTenant($tenant, function () {
        DB::table('crm_corporate_accounts')->where('id', $this->account->id)->update(['statement_auto' => true, 'statement_day' => 3]);
        DB::table('fin_corporate_statements')->where('account_id', $this->account->id)->where('period_start', now()->startOfMonth()->toDateString())->update(['status' => 'anulado']);
        $statements = app(CorporateStatements::class);
        $first = $statements->runAutomatic(now()->addMonthNoOverflow()->startOfMonth()->addDays(2)->toImmutable());
        $second = $statements->runAutomatic(now()->addMonthNoOverflow()->startOfMonth()->addDays(2)->toImmutable());

        return [$first, $second, DB::table('fin_corporate_statements')->where('account_id', $this->account->id)->where('period_start', now()->startOfMonth()->toDateString())->where('status', '<>', 'anulado')->get(['status'])];
    });

    expect($sent[0])->toBe($sent[1])
        ->and($sent[2])->toHaveCount(1)
        ->and($sent[2][0]->status)->toBe('enviado');
});

it('el seeder de demostración es idempotente y deja estados de cuenta que cuadran', function () {
    $counts = fn () => withinTenant(tenantA(), fn () => [
        DB::table('crm_corporate_cost_centers')->where('account_id', $this->account->id)->count(),
        DB::table('crm_corporate_portal_users')->where('account_id', $this->account->id)->count(),
        DB::table('fin_corporate_statements')->where('account_id', $this->account->id)->where('status', '<>', 'anulado')->count(),
    ]);
    $before = $counts();
    withinTenant(tenantA(), fn () => (new CorporateAccountsSeeder(tenantA()))->run());

    expect($counts())->toBe($before)
        ->and($before[0])->toBe(4)
        ->and($before[2])->toBeGreaterThan(3)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_corporate_statements')->whereRaw('closing_balance <> opening_balance + charges - payments - credits')->count()))->toBe(0);
});

it('Operaciones no gestiona cuentas corporativas y Contabilidad no las edita', function () {
    actingAsSeed('U05');
    expect($this->getJson('/api/v1/crm/corporate-accounts'))->toBeApiError(403)
        ->and($this->getJson('/api/v1/crm/corporate-accounts')->json('required_permissions'))->toContain('crm.corporate.manage');

    actingAsSeed('U08');
    expect($this->postJson('/api/v1/crm/corporate-accounts', ['client_id' => 'CLI-0004'], critical()))->toBeApiError(403);
    $this->getJson('/api/v1/finance/corporate-statements')->assertOk();
});

it('CP-01: con la regla apagada los endpoints del módulo responden 403', function () {
    corpRule(false);
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/crm/corporate-accounts'))->toBeApiError(403, 'RULE_NOT_IN_PLAN')
        ->and($this->getJson('/api/v1/finance/corporate-statements')->json('required_permissions'))->toContain('R-CORP-PORTAL');
});
