<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    lockSeededBookings();
    Storage::fake((string) config('filesystems.default'));
});

function supCrudAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function supCrudProvider(string $ref): object
{
    return rowOf('catalog_providers', $ref, column: 'ref');
}

function supCrudContacts(string $ref): array
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_provider_contacts')->where('provider_id', supCrudProvider($ref)->id)->orderBy('created_at')->get()->all());
}

function supCrudInvoice(array $extra = []): array
{
    return ['number' => 'f001-4521', 'issue_date' => '2026-09-28', 'amount' => 190, 'file_name' => 'F001-4521.pdf', 'file_content' => base64_encode("%PDF-1.4\nfactura tambo real\n%%EOF"), ...$extra];
}

function supCrudRate(array $extra = []): array
{
    return ['service' => 'SRV-008', 'proposed_cost' => 102.5, 'effective_from' => '2026-11-15', 'reason_type' => 'Cambio de temporada', 'reason_detail' => 'Temporada alta de diciembre.', ...$extra];
}

it('el proveedor agrega, edita y quita contactos de su empresa', function () {
    actingAsSeed('U17');

    $this->postJson('/api/v1/supplier/company/contacts', ['name' => 'Julia Paredes', 'role' => 'Jefa de reservas', 'phone' => '+51 984 556 677', 'email' => 'JULIA@tamboreal.pe'])->assertCreated();
    $contact = collect($this->getJson('/api/v1/supplier/company')->assertOk()->json('data.contacts'))->firstWhere('name', 'Julia Paredes');
    expect($contact['email'])->toBe('julia@tamboreal.pe')
        ->and(supCrudAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-001', 'action' => 'agregar_contacto']))->toBeTrue();

    $this->patchJson("/api/v1/supplier/company/contacts/{$contact['id']}", ['name' => 'Julia Paredes Ríos', 'role' => 'Gerente de ventas', 'email' => 'ventas@tamboreal.pe'])->assertOk();
    $row = rowOf('catalog_provider_contacts', $contact['id'], column: 'id');
    expect($row->name)->toBe('Julia Paredes Ríos')
        ->and($row->role)->toBe('Gerente de ventas')
        ->and($row->phone)->toBeNull()
        ->and(supCrudAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-001', 'action' => 'editar_contacto']))->toBeTrue();

    $this->deleteJson("/api/v1/supplier/company/contacts/{$contact['id']}")->assertOk();
    expect(rowOf('catalog_provider_contacts', $contact['id'], column: 'id'))->toBeNull()
        ->and(collect($this->getJson('/api/v1/supplier/company')->json('data.contacts'))->pluck('id'))->not->toContain($contact['id'])
        ->and(supCrudAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-001', 'action' => 'quitar_contacto']))->toBeTrue();
});

it('valida el contacto y no deja a la empresa sin ningún contacto', function () {
    actingAsSeed('U17');

    $this->postJson('/api/v1/supplier/company/contacts', ['name' => 'Ju'])->assertStatus(422)->assertJsonValidationErrors('name');
    $this->postJson('/api/v1/supplier/company/contacts', ['name' => 'Julia Paredes', 'phone' => 'llamar luego', 'email' => 'sin-arroba'])->assertStatus(422)->assertJsonValidationErrors(['phone', 'email']);

    $only = supCrudContacts('PRV-001');
    expect($only)->toHaveCount(1);
    expect($this->deleteJson("/api/v1/supplier/company/contacts/{$only[0]->id}"))->toBeApiError(409, 'SUP-BR-60');
    expect(supCrudContacts('PRV-001'))->toHaveCount(1);
});

it('un proveedor no edita ni quita contactos de otro proveedor', function () {
    actingAsSeed('U17');
    $foreign = supCrudContacts('PRV-002')[0];

    $this->patchJson("/api/v1/supplier/company/contacts/{$foreign->id}", ['name' => 'Cambio ajeno'])->assertNotFound();
    $this->deleteJson("/api/v1/supplier/company/contacts/{$foreign->id}")->assertNotFound();
    $this->patchJson('/api/v1/supplier/company/contacts/no-es-uuid', ['name' => 'Cambio ajeno'])->assertNotFound();
    expect(rowOf('catalog_provider_contacts', $foreign->id, column: 'id')->name)->toBe($foreign->name);
});

it('el proveedor registra su factura y aparece en la cuenta por pagar y en aprobaciones de la agencia', function () {
    actingAsSeed('U17');

    $this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(), critical())->assertCreated()->assertJsonPath('data.number', 'F001-4521')->assertJsonPath('data.difference', 0);

    $invoice = withinTenant(tenantA(), fn () => DB::table('supplier_invoices')->where('payable_id', rowOf('fin_payables', 'CXP-00407')->id)->whereNull('deleted_at')->first());
    $document = rowOf('sys_documents', $invoice->document_id, column: 'id');
    expect($invoice->status)->toBe('registrada')
        ->and($invoice->number)->toBe('F001-4521')
        ->and((string) $invoice->amount)->toBe('190.00')
        ->and($document->entity_type)->toBe('fin_payables')
        ->and(rowOf('fin_payables', 'CXP-00407')->supplier_doc_number)->toBe('F001-4521')
        ->and(supCrudAudit(['entity' => 'Cuenta por pagar', 'entity_id' => 'CXP-00407', 'action' => 'factura_proveedor']))->toBeTrue();
    Storage::disk((string) config('filesystems.default'))->assertExists($document->storage_path);

    $portal = collect($this->getJson('/api/v1/supplier/payables')->json('data.rows'))->firstWhere('code', 'CXP-00407');
    expect($portal['invoice']['number'])->toBe('F001-4521')
        ->and($portal['can_invoice'])->toBeFalse();

    actingAsSeed('U07');
    expect(collect($this->getJson('/api/v1/finance/payables')->assertOk()->json('data.rows'))->firstWhere('code', 'CXP-00407')['supplier_doc'])->toBe('F001-4521');
    $approval = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->first(fn (array $item) => ($item['source'] ?? null) === 'invoice' && $item['code'] === 'F001-4521');
    expect($approval)->not->toBeNull()
        ->and($approval['status'])->toBe('pendiente');
});

it('advierte la diferencia con el saldo y no acepta una segunda factura ni datos inválidos', function () {
    actingAsSeed('U17');

    $this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(['number' => 'F001-1', 'file_name' => 'factura.doc']), critical())->assertStatus(422)->assertJsonValidationErrors('file_name');
    $this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(['number' => 'F1-1']), critical())->assertStatus(422)->assertJsonValidationErrors('number');
    $this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(['issue_date' => '2026-12-01']), critical())->assertStatus(422)->assertJsonValidationErrors('issue_date');
    expect($this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(['file_content' => '%%%no-base64%%%']), critical()))->toBeApiError(422, 'SUP-BR-40');

    $this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(['amount' => 200]), critical())->assertCreated()->assertJsonPath('data.difference', 10);
    expect($this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(['number' => 'F001-4522']), critical()))->toBeApiError(409, 'SUP-BR-42');
    expect($this->postJson('/api/v1/supplier/payables/CXP-00402/invoices', supCrudInvoice(), critical()))->toBeApiError(409, 'SUP-BR-40');
    expect(Storage::disk((string) config('filesystems.default'))->allFiles())->toHaveCount(1);
});

it('el proveedor no anula su factura: si Finanzas la observa o rechaza, vuelve a subirla corregida', function () {
    actingAsSeed('U17');
    $this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(), critical())->assertCreated();

    expect($this->deleteJson('/api/v1/supplier/payables/CXP-00407/invoices')->status())->toBe(405)
        ->and(collect($this->getJson('/api/v1/supplier/payables')->json('data.rows'))->firstWhere('code', 'CXP-00407')['can_invoice'])->toBeFalse();

    foreach (['observada', 'rechazada'] as $status) {
        withinTenant(tenantA(), fn () => DB::table('supplier_invoices')->where('number', 'F001-4521')->update(['status' => $status]));
        expect(collect($this->getJson('/api/v1/supplier/payables')->json('data.rows'))->firstWhere('code', 'CXP-00407')['can_invoice'])->toBeTrue();
        $this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(), critical())->assertCreated();
        expect(withinTenant(tenantA(), fn () => DB::table('supplier_invoices')->where('number', 'F001-4521')->value('status')))->toBe('registrada');
    }
});

it('un proveedor no factura cuentas por pagar de otro proveedor', function () {
    actingAsSeed('U17');

    expect($this->postJson('/api/v1/supplier/payables/CXP-00423/invoices', supCrudInvoice(['amount' => 1180.8]), critical()))->toBeApiError(404);
    expect(rowOf('fin_payables', 'CXP-00423')->supplier_doc_number)->toBeNull();

    actingAsSeed('U01');
    expect($this->postJson('/api/v1/supplier/payables/CXP-00407/invoices', supCrudInvoice(), critical()))->toBeApiError(403);
});

it('el proveedor retira su solicitud de tarifa, pide una nueva y llega a aprobaciones de la agencia', function () {
    actingAsSeed('U17');

    expect($this->postJson('/api/v1/supplier/rate-requests', supCrudRate(), critical()))->toBeApiError(409, 'SUP-BR-61');

    $this->postJson('/api/v1/supplier/rate-requests/SOL-TAR-0102/withdraw')->assertOk();
    expect(rowOf('supplier_rate_requests', 'SOL-TAR-0102')->status)->toBe('retirada')
        ->and(supCrudAudit(['entity' => 'Tarifa proveedor', 'entity_id' => 'SOL-TAR-0102', 'action' => 'retirar_solicitud']))->toBeTrue();
    expect($this->postJson('/api/v1/supplier/rate-requests/SOL-TAR-0102/withdraw'))->toBeApiError(409, 'SUP-BR-61');

    $code = $this->postJson('/api/v1/supplier/rate-requests', supCrudRate(), critical())->assertCreated()->json('data.code');
    $row = rowOf('supplier_rate_requests', $code);
    expect($row->status)->toBe('pendiente')
        ->and((string) $row->current_cost)->toBe('95.00')
        ->and((string) $row->proposed_cost)->toBe('102.50')
        ->and((string) rowOf('catalog_services', 'SRV-008', column: 'ref')->cost)->toBe('95.00')
        ->and(collect($this->getJson('/api/v1/supplier/rates')->json('data.services'))->firstWhere('ref', 'SRV-008')['pending']['code'])->toBe($code);

    actingAsSeed('U01');
    $items = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'));
    $approval = $items->first(fn (array $item) => ($item['source'] ?? null) === 'rate' && $item['code'] === $code);
    expect($approval)->not->toBeNull()
        ->and($approval['status'])->toBe('pendiente')
        ->and($approval['can_decide'])->toBeTrue()
        ->and($items->first(fn (array $item) => ($item['source'] ?? null) === 'rate' && $item['code'] === 'SOL-TAR-0102')['status'])->toBe('anulada');
});

it('el proveedor corrige su solicitud de tarifa pendiente respetando el aviso de 30 días', function () {
    actingAsSeed('U17');

    $this->patchJson('/api/v1/supplier/rate-requests/SOL-TAR-0102', supCrudRate(['service' => null, 'proposed_cost' => 110, 'effective_from' => '2026-12-01', 'reason_type' => 'Mejora del servicio']))->assertOk();
    $row = rowOf('supplier_rate_requests', 'SOL-TAR-0102');
    expect((string) $row->proposed_cost)->toBe('110.00')
        ->and($row->effective_from)->toBe('2026-12-01')
        ->and($row->reason_type)->toBe('Mejora del servicio')
        ->and(supCrudAudit(['entity' => 'Tarifa proveedor', 'entity_id' => 'SRV-008', 'action' => 'editar_solicitud']))->toBeTrue();

    expect($this->patchJson('/api/v1/supplier/rate-requests/SOL-TAR-0102', supCrudRate(['effective_from' => '2026-10-10'])))->toBeApiError(422, 'SUP-BR-61');
    expect($this->patchJson('/api/v1/supplier/rate-requests/SOL-TAR-0102', supCrudRate(['proposed_cost' => 95])))->toBeApiError(422, 'SUP-BR-61');
    $this->patchJson('/api/v1/supplier/rate-requests/SOL-TAR-0102', supCrudRate(['proposed_cost' => 0, 'reason_type' => 'Porque sí']))->assertStatus(422)->assertJsonValidationErrors(['proposed_cost', 'reason_type']);
    expect((string) rowOf('supplier_rate_requests', 'SOL-TAR-0102')->proposed_cost)->toBe('110.00');

    withinTenant(tenantA(), fn () => DB::table('supplier_rate_requests')->where('code', 'SOL-TAR-0102')->update(['status' => 'aprobada']));
    expect($this->patchJson('/api/v1/supplier/rate-requests/SOL-TAR-0102', supCrudRate(['proposed_cost' => 120])))->toBeApiError(409, 'SUP-BR-61');
});

it('un proveedor no pide ni cambia tarifas de servicios de otro proveedor', function () {
    actingAsSeed('U17');

    $this->postJson('/api/v1/supplier/rate-requests', supCrudRate(['service' => 'SRV-009']), critical())->assertNotFound();
    $this->patchJson('/api/v1/supplier/rate-requests/SOL-TAR-0101', supCrudRate())->assertNotFound();
    $this->postJson('/api/v1/supplier/rate-requests/SOL-TAR-0101/withdraw')->assertNotFound();
    expect(rowOf('supplier_rate_requests', 'SOL-TAR-0101')->status)->toBe('pendiente');

    actingAsSeed('U01');
    expect($this->postJson('/api/v1/supplier/rate-requests/SOL-TAR-0102/withdraw'))->toBeApiError(403);
});

it('el rechazo del proveedor deja el servicio rechazado en la reserva y la reserva a la espera del proveedor', function () {
    actingAsSeed('U17');
    $service = serviceRow('RS-3489');
    expect(reservationRow('RES-2026-000348')->status)->toBe('confirmada');

    $this->postJson('/api/v1/supplier/requests/RS-3489/reject', ['reason' => 'Sin disponibilidad (sold out)', 'note' => 'Hotel lleno por congreso.'], critical((int) $service->lock_version))
        ->assertOk()->assertJsonPath('data.alternative', null);

    $after = serviceRow('RS-3489');
    expect($after->status)->toBe('rechazado')
        ->and($after->reject_reason)->toBe('Sin disponibilidad (sold out): Hotel lleno por congreso.')
        ->and(reservationRow('RES-2026-000348')->status)->toBe('pendiente_proveedor')
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_supplier_requests')->where('reservation_service_id', $service->id)->value('status')))->toBe('rechazado')
        ->and(withinTenant(tenantA(), fn () => DB::table('supplier_request_responses')->where('reservation_service_id', $service->id)->value('type')))->toBe('rechazo')
        ->and(supCrudAudit(['entity' => 'Servicio reserva', 'entity_id' => 'RS-3489', 'action' => 'proveedor_rechaza']))->toBeTrue();

    actingAsSeed('U05');
    $services = collect($this->getJson('/api/v1/reservations/RES-2026-000348')->assertOk()->json('data.services'));
    expect($services->firstWhere('code', 'RS-3489')['status'])->toBe('rechazado');

    actingAsSeed('U17');
    expect($this->postJson('/api/v1/supplier/requests/RS-3489/reject', ['reason' => 'Otro', 'note' => 'Segundo rechazo.'], critical((int) serviceRow('RS-3489')->lock_version)))->toBeApiError(409, 'SUP-BR-04');
});

it('el proveedor rechaza proponiendo otra fecha y la agencia recibe el servicio alternativo', function () {
    actingAsSeed('U17');
    $service = serviceRow('RS-3442');

    $this->postJson('/api/v1/supplier/requests/RS-3442/reject', ['reason' => 'Sin disponibilidad (sold out)', 'note' => 'Sin cupo esa noche.', 'alt_date' => '2026-09-20'], critical((int) $service->lock_version))->assertStatus(422)->assertJsonValidationErrors('alt_date');
    $this->postJson('/api/v1/supplier/requests/RS-3442/reject', ['reason' => 'Lo que sea', 'note' => 'x'], critical((int) $service->lock_version))->assertStatus(422)->assertJsonValidationErrors(['reason', 'note']);

    $alternative = $this->postJson('/api/v1/supplier/requests/RS-3442/reject', ['reason' => 'Sin disponibilidad (sold out)', 'note' => 'Sin cupo esa noche.', 'alt_date' => '2026-10-14'], critical((int) $service->lock_version))->assertOk()->json('data.alternative');

    $new = serviceRow($alternative);
    expect($new->status)->toBe('pendiente')
        ->and($new->service_date)->toBe('2026-10-14')
        ->and($new->alt_of_id)->toBe($service->id)
        ->and(serviceRow('RS-3442')->replaced_by_id)->toBe($new->id);
});

it('un proveedor no rechaza solicitudes de otro proveedor ni con versión vencida', function () {
    actingAsSeed('U17');
    $foreign = serviceRow('RS-3487');

    $this->postJson('/api/v1/supplier/requests/RS-3487/reject', ['reason' => 'Otro', 'note' => 'No es mío.'], critical((int) $foreign->lock_version))->assertNotFound();
    expect(serviceRow('RS-3487')->status)->toBe('solicitado');

    $own = serviceRow('RS-3489');
    $this->postJson('/api/v1/supplier/requests/RS-3489/reject', ['reason' => 'Otro', 'note' => 'Versión vieja.'], critical((int) $own->lock_version + 3))->assertStatus(409);
    $this->postJson('/api/v1/supplier/requests/RS-3489/reject', ['reason' => 'Otro', 'note' => 'Sin versión.'], ['Accept' => 'application/json', 'Idempotency-Key' => idem()])->assertStatus(428);
    expect(serviceRow('RS-3489')->status)->toBe('solicitado');

    actingAsSeed('U05');
    expect($this->postJson('/api/v1/supplier/requests/RS-3489/reject', ['reason' => 'Otro', 'note' => 'Desde la agencia.'], critical((int) $own->lock_version)))->toBeApiError(403);
});
