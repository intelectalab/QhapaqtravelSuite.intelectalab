<?php

use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockSeededBookings();
});

function extranetAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function extranetRateRequest(): object
{
    return withinTenant(tenantA(), function (): object {
        $request = DB::table('supplier_rate_requests as q')->join('catalog_services as s', 's.id', '=', 'q.service_id')->whereNull('s.deleted_at')->whereColumn('s.currency', 'q.currency')->orderBy('q.code')->first(['q.id']);
        DB::table('supplier_rate_requests')->where('id', $request->id)->update(['status' => 'pendiente', 'reviewed_by' => null, 'reviewed_at' => null, 'review_note' => null, 'resulting_rate_id' => null]);

        return DB::table('supplier_rate_requests')->where('id', $request->id)->first();
    });
}

function extranetInvoice(): object
{
    return withinTenant(tenantA(), function (): object {
        $payable = DB::table('fin_payables')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'pagada'])->whereNotExists(fn ($query) => $query->from('supplier_invoices as i')->whereColumn('i.payable_id', 'fin_payables.id')->whereNull('i.deleted_at'))->orderBy('code')->first();
        $uploader = DB::table('iam_users')->where('code', 'U17')->value('id');
        $document = DB::table('sys_documents')->insertGetId([
            'doc_type' => 'factura_proveedor',
            'entity_type' => 'fin_payables',
            'entity_id' => $payable->id,
            'storage_disk' => 'local',
            'storage_path' => 'pest/F001-7781.pdf',
            'file_name' => 'F001-7781.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'sha256' => hash('sha256', 'F001-7781'),
            'created_by' => $uploader,
        ], 'id');
        $id = DB::table('supplier_invoices')->insertGetId([
            'payable_id' => $payable->id,
            'provider_id' => $payable->provider_id,
            'number' => 'F001-7781',
            'issue_date' => BUSINESS_TODAY,
            'amount' => bcsub((string) $payable->amount, (string) $payable->paid_amount, 2),
            'currency' => $payable->currency,
            'amount_difference' => '0.00',
            'document_id' => $document,
            'original_file_name' => 'F001-7781.pdf',
            'status' => 'registrada',
            'uploaded_by' => $uploader,
            'uploaded_at' => now(),
            'created_by' => $uploader,
        ], 'id');
        DB::table('fin_payables')->where('id', $payable->id)->update(['supplier_doc_number' => 'F001-7781']);

        return (object) ['id' => (string) $id, 'payable_code' => $payable->code];
    });
}

it('el proveedor ve su cuenta, sus KPIs, su contrato y su historial de tarifas', function () {
    actingAsSeed('U17');

    $me = $this->getJson('/api/v1/supplier/me')->assertOk()->json('data');
    expect($me['provider'])->toHaveKeys(['ref', 'name', 'currency', 'payment_terms'])->and($me['permissions'])->toContain('supplier.portal.view');

    $dashboard = $this->getJson('/api/v1/supplier/dashboard')->assertOk()->json('data');
    expect($dashboard['kpis'])->toHaveKeys(['pending', 'upcoming', 'receivable', 'contract_days']);

    $contract = $this->getJson('/api/v1/supplier/contract')->assertOk()->json('data');
    expect($contract)->toHaveKeys(['conditions', 'contract', 'contacts'])->and($contract['contract'])->toHaveKeys(['start', 'end', 'days_left', 'alert']);

    $page = $this->getJson('/api/v1/supplier/rate-requests?page[size]=2')->assertOk()->json();
    $own = withinTenant(tenantA(), fn () => DB::table('supplier_rate_requests')->where('provider_id', DB::table('catalog_providers')->where('ref', 'PRV-001')->value('id'))->count());
    expect(count($page['data']))->toBe(min(2, $own))->and($page['meta'])->toHaveKey('next_cursor');
});

it('la extranet no se abre a un usuario interno', function () {
    actingAsSeed('U05');

    expect($this->getJson('/api/v1/supplier/me')->status())->toBe(403);
});

it('Catálogo lista y aprueba una solicitud de tarifa', function () {
    $request = extranetRateRequest();
    actingAsSeed('U01');

    $page = $this->getJson('/api/v1/catalog/rate-requests?filter[status]=pendiente')->assertOk()->json();
    expect(collect($page['data'])->pluck('code'))->toContain($request->code)->and($page['meta']['pending'])->toBeGreaterThan(0);

    $this->postJson("/api/v1/catalog/rate-requests/{$request->id}/approve", ['note' => 'Conforme'])->assertOk()->assertJsonPath('data.status', 'aprobada');
    expect(rowOf('supplier_rate_requests', $request->code)->resulting_rate_id)->not->toBeNull()
        ->and(extranetAudit(['entity_id' => $request->code, 'action' => 'aprobar_actualizacion']))->toBeTrue();

    expect($this->postJson("/api/v1/catalog/rate-requests/{$request->code}/reject", ['note' => 'Tarde']))->toBeApiError(409, 'APR-BR-08');
});

it('Catálogo rechaza una solicitud de tarifa con nota', function () {
    $request = extranetRateRequest();
    actingAsSeed('U01');

    expect($this->postJson("/api/v1/catalog/rate-requests/{$request->code}/reject", []))->toBeApiError(422);
    $this->postJson("/api/v1/catalog/rate-requests/{$request->code}/reject", ['note' => 'Fuera de mercado'])->assertOk()->assertJsonPath('data.status', 'rechazada')->assertJsonPath('data.review_note', 'Fuera de mercado');
});

it('Operaciones no aprueba tarifas: 403 con el permiso requerido', function () {
    $request = extranetRateRequest();
    actingAsSeed('U05');

    $response = $this->postJson("/api/v1/catalog/rate-requests/{$request->code}/approve", []);
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('catalog.products.manage_rates');
});

it('Finanzas rechaza la factura del proveedor y repetirlo responde 409', function () {
    $invoice = extranetInvoice();
    actingAsSeed('U07');

    $this->postJson("/api/v1/finance/supplier-invoices/{$invoice->id}/reject", ['note' => 'RUC no corresponde'])->assertOk()->assertJsonPath('data.status', 'rechazada');
    expect(extranetAudit(['entity_id' => $invoice->payable_code, 'action' => 'rechazar_factura_proveedor']))->toBeTrue()
        ->and(rowOf('fin_payables', $invoice->payable_code)->supplier_doc_number)->toBeNull();

    expect($this->postJson("/api/v1/finance/supplier-invoices/{$invoice->id}/reject", ['note' => 'Otra vez']))->toBeApiError(409, 'APR-BR-08');
});

it('invita a un usuario del proveedor a la extranet', function () {
    actingAsSeed('U01');
    $email = 'recepcion.extranet@example.com';

    $data = $this->postJson('/api/v1/catalog/providers/PRV-001/users', ['name' => 'Recepción Hotel', 'email' => $email])->assertOk()->json('data');
    $user = withinTenant(tenantA(), fn () => DB::table('iam_users')->where('email', $email)->first());
    expect($data['ref'])->toBe('PRV-001')->and($user->status)->toBe('pendiente')->and($user->provider_id)->toBe($data['id'])
        ->and(collect($data['users'])->pluck('email'))->toContain($email)
        ->and(extranetAudit(['entity_id' => 'PRV-001', 'action' => 'invitar_usuario']))->toBeTrue();

    expect($this->postJson('/api/v1/catalog/providers/PRV-001/users', ['name' => 'Recepción Hotel', 'email' => $email]))->toBeApiError(422, 'USR-BR-01');
});

it('invitar usuarios de proveedor exige también administrar usuarios', function () {
    actingAsSeed('U05');

    $response = $this->postJson('/api/v1/catalog/providers/PRV-001/users', ['name' => 'Recepción Hotel', 'email' => 'otro.extranet@example.com']);
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('admin.users.manage');
});
