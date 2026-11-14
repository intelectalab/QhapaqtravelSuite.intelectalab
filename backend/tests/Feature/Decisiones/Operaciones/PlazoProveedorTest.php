<?php

use App\Jobs\RemindPendingSupplierRequests;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function opsSlaRunReminder(): string
{
    dispatch_sync((new RemindPendingSupplierRequests)->forTenant((string) tenantA()->getKey()));

    return (string) DB::connection('pgsql_audit')->table('sys_job_runs')->where('tenant_id', tenantA()->getKey())->where('job_class', RemindPendingSupplierRequests::class)->orderByDesc('started_at')->value('result');
}

function opsSlaProviderId(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U17')->value('provider_id'));
}

function opsSlaAgencyHours(?int $hours): void
{
    withinTenant(tenantA(), function () use ($hours): void {
        $values = (array) json_decode((string) DB::table('sys_settings')->where('section', 'operations')->value('values'), true);
        unset($values['supplier_response_hours']);
        DB::table('sys_settings')->where('section', 'operations')->update(['values' => json_encode($hours === null ? $values : [...$values, 'supplier_response_hours' => $hours])]);
    });
}

function opsSlaProviderBody(object $row, array $overrides = []): array
{
    return [
        'name' => $row->name, 'type' => $row->type, 'ruc' => trim($row->ruc), 'city' => $row->city, 'contact_name' => $row->contact_name ?: 'Contacto comercial',
        'phone' => $row->phone, 'email' => $row->email, 'contract_start' => $row->contract_start, 'contract_end' => $row->contract_end,
        'currency' => trim($row->currency), 'payment_terms' => $row->payment_terms, 'rating' => (float) $row->rating ?: null, ...$overrides,
    ];
}

it('G3-34: la extranet usa el plazo del proveedor y, si no tiene, el de la agencia (24 h por defecto)', function () {
    $provider = opsSlaProviderId();
    withinTenant(tenantA(), fn () => DB::table('catalog_providers')->where('id', $provider)->update(['response_sla_hours' => null]));
    opsSlaAgencyHours(null);
    actingAsSeed('U17');

    expect($this->getJson('/api/v1/supplier/session')->assertOk()->json('data.frame.response_hours'))->toBe(24);

    opsSlaAgencyHours(36);
    expect($this->getJson('/api/v1/supplier/requests')->assertOk()->json('data.response_hours'))->toBe(36);

    withinTenant(tenantA(), fn () => DB::table('catalog_providers')->where('id', $provider)->update(['response_sla_hours' => 48]));
    $requests = $this->getJson('/api/v1/supplier/requests')->assertOk()->json('data');
    expect($requests['response_hours'])->toBe(48);

    $open = collect($requests['rows'])->firstWhere('state', 'por_responder');
    if ($open !== null && $open['deadline'] !== null) {
        $requestedAt = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('code', $open['code'])->value('requested_at'));
        expect(CarbonImmutable::parse($open['deadline'])->equalTo(CarbonImmutable::parse($requestedAt)->addHours(48)))->toBeTrue();
    }
});

it('G3-34: el plazo se edita en la ficha del proveedor, queda auditado y se valida', function () {
    lockCatalogProducts();
    Queue::fake();
    $row = withinTenant(tenantA(), fn () => DB::table('catalog_providers')->whereNull('deleted_at')->orderBy('ref')->first());
    actingAsSeed('U05');

    $this->patchJson("/api/v1/catalog/providers/{$row->ref}", opsSlaProviderBody($row, ['response_sla_hours' => 12]))->assertOk();
    expect((int) rowOf('catalog_providers', $row->ref, column: 'ref')->response_sla_hours)->toBe(12)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Proveedor')->where('entity_id', $row->ref)->where('action', 'plazo_respuesta')->exists()))->toBeTrue();

    $show = $this->getJson("/api/v1/catalog/providers/{$row->ref}")->assertOk()->json('data');
    expect($show['provider']['response_sla_hours'] ?? $show['response_sla_hours'] ?? null)->toBe(12)
        ->and($this->getJson('/api/v1/catalog/providers')->assertOk()->json('data.options.agency_response_hours'))->toBeInt();

    $this->patchJson("/api/v1/catalog/providers/{$row->ref}", opsSlaProviderBody($row, ['response_sla_hours' => 0]))->assertStatus(422)->assertJsonValidationErrors('response_sla_hours');

    $this->patchJson("/api/v1/catalog/providers/{$row->ref}", opsSlaProviderBody($row, ['response_sla_hours' => null]))->assertOk();
    expect(rowOf('catalog_providers', $row->ref, column: 'ref')->response_sla_hours)->toBeNull();
});

it('G3-34: el plazo de la agencia se guarda en Configuración › Operaciones con su rango', function () {
    actingAsSeed('U01');
    $values = $this->getJson('/api/v1/settings')->assertOk()->json('data.sections.operations.values');
    expect($values['supplier_response_hours'])->toBeInt();
    $version = (int) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'operations')->value('lock_version'));

    $this->patchJson('/api/v1/settings/operations', [...$values, 'supplier_response_hours' => 0], ['If-Match' => (string) $version])->assertStatus(422)->assertJsonValidationErrors('supplier_response_hours');
    $this->patchJson('/api/v1/settings/operations', [...$values, 'supplier_response_hours' => 30], ['If-Match' => (string) $version])->assertOk();
    expect($this->getJson('/api/v1/settings')->json('data.sections.operations.values.supplier_response_hours'))->toBe(30);
});

it('G3-34: el recordatorio al proveedor respeta su plazo de respuesta', function () {
    $request = withinTenant(tenantA(), fn () => DB::table('ops_supplier_requests as q')->join('catalog_providers as p', 'p.id', '=', 'q.provider_id')->join('booking_reservation_services as s', 's.id', '=', 'q.reservation_service_id')
        ->where('s.status', '<>', 'cancelado')->where('p.email', 'like', '%@%')->whereNull('q.deleted_at')->first(['q.id', 'q.provider_id', 'q.reservation_service_id']));
    expect($request)->not->toBeNull();
    withinTenant(tenantA(), function () use ($request): void {
        DB::table('ops_supplier_requests')->where('id', '<>', $request->id)->update(['status' => 'confirmado']);
        DB::table('ops_supplier_requests')->where('id', $request->id)->update(['status' => 'solicitado', 'requested_at' => now()->subHours(30)]);
        DB::table('booking_reservation_services')->where('id', $request->reservation_service_id)->update(['service_date' => CarbonImmutable::parse(BUSINESS_TODAY)->addDays(20)->toDateString()]);
        DB::table('catalog_providers')->where('id', $request->provider_id)->update(['response_sla_hours' => 48]);
    });
    $sent = fn () => withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'proveedor.recordatorio')->where('source_id', $request->id)->count());

    expect(opsSlaRunReminder())->toBe('Sin solicitudes pendientes de proveedores')
        ->and($sent())->toBe(0);

    withinTenant(tenantA(), fn () => DB::table('catalog_providers')->where('id', $request->provider_id)->update(['response_sla_hours' => 24]));
    opsSlaRunReminder();
    expect($sent())->toBe(1);
});
