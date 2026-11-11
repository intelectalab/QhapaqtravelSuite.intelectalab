<?php

use App\Jobs\ExpireSupplierAlternativeHolds;
use Illuminate\Support\Facades\DB;

function altAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function altProposal(array $extra = []): array
{
    return ['alt_kind' => 'Otra fecha', 'alt_date' => '2026-10-14', 'alt_net_cost' => 210.5, 'hold_until' => '2026-10-02', 'note' => 'Tenemos habitaciones libres el día siguiente.', ...$extra];
}

it('el proveedor propone una alternativa completa sin cambiar el estado del servicio', function () {
    actingAsSeed('U17');
    $service = serviceRow('RS-3442');

    $this->postJson('/api/v1/supplier/requests/RS-3442/alternative', altProposal(['alt_date' => serviceRow('RS-3442')->service_date]))->assertStatus(422);
    $this->postJson('/api/v1/supplier/requests/RS-3442/alternative', altProposal(['alt_kind' => 'Otra fecha', 'alt_date' => null]))->assertStatus(422);
    $this->postJson('/api/v1/supplier/requests/RS-3442/alternative', ['alt_kind' => 'Upgrade', 'note' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['alt_kind', 'note']);

    $this->postJson('/api/v1/supplier/requests/RS-3442/alternative', altProposal())->assertCreated();
    expect(serviceRow('RS-3442')->status)->toBe($service->status);
    $response = withinTenant(tenantA(), fn () => DB::table('supplier_request_responses')->where('reservation_service_id', $service->id)->where('type', 'alternativa')->first());
    expect($response->review_status)->toBe('pendiente')
        ->and((float) $response->alt_net_cost)->toBe(210.5)
        ->and($response->hold_until)->toBe('2026-10-02')
        ->and(altAudit(['entity' => 'Servicio reserva', 'entity_id' => 'RS-3442', 'action' => 'proveedor_alternativa']))->toBeTrue();

    $row = collect($this->getJson('/api/v1/supplier/requests')->assertOk()->json('data.rows'))->firstWhere('code', 'RS-3442');
    expect($row['state'])->toBe('alternativa_propuesta')->and($row['proposal']['kind'])->toBe('Otra fecha');

    expect($this->postJson('/api/v1/supplier/requests/RS-3442/alternative', altProposal()))->toBeApiError(409, 'SUP-BR-04');
});

it('operaciones acepta la alternativa, aplica fecha y tarifa y la confirma con el código', function () {
    actingAsSeed('U17');
    $this->postJson('/api/v1/supplier/requests/RS-3442/alternative', altProposal())->assertCreated();
    actingAsSeed('U05');

    $inbox = $this->getJson('/api/v1/ops/supplier-responses?filter[type]=alternativa&filter[review_status]=pendiente')->assertOk()->json('data.rows');
    $item = collect($inbox)->firstWhere('service.code', 'RS-3442');
    expect($item)->not->toBeNull()->and($item['proposal']['date'])->toBe('2026-10-14');

    $result = $this->postJson("/api/v1/ops/supplier-responses/{$item['id']}/accept", ['confirmation_code' => 'trv-8812', 'note' => 'Avisamos al cliente'])->assertOk()->json('data');
    $after = serviceRow('RS-3442');
    expect($result['status'])->toBe('confirmado')
        ->and($after->status)->toBe('confirmado')
        ->and($after->service_date)->toBe('2026-10-14')
        ->and((float) $after->cost_amount)->toBe(210.5)
        ->and($after->confirmation_code)->toBe('TRV-8812')
        ->and(rowOf('supplier_request_responses', $item['id'], column: 'id')->review_status)->toBe('aceptada')
        ->and(altAudit(['entity' => 'Servicio reserva', 'entity_id' => 'RS-3442', 'action' => 'aceptar_alternativa']))->toBeTrue();

    expect($this->postJson("/api/v1/ops/supplier-responses/{$item['id']}/reject", ['note' => 'Ya no aplica']))->toBeApiError(409);
});

it('operaciones rechaza la alternativa con motivo y la solicitud sigue por responder', function () {
    actingAsSeed('U17');
    $this->postJson('/api/v1/supplier/requests/RS-3442/alternative', altProposal(['alt_kind' => 'Otro tipo de habitación', 'alt_date' => null]))->assertCreated();
    $id = withinTenant(tenantA(), fn () => (string) DB::table('supplier_request_responses')->where('reservation_service_id', serviceRow('RS-3442')->id)->where('type', 'alternativa')->value('id'));
    $status = serviceRow('RS-3442')->status;

    actingAsSeed('U05');
    $this->postJson("/api/v1/ops/supplier-responses/{$id}/reject", ['note' => ''])->assertStatus(422)->assertJsonValidationErrors('note');
    $this->postJson("/api/v1/ops/supplier-responses/{$id}/reject", ['note' => 'El cliente necesita habitación doble'])->assertOk();
    expect(rowOf('supplier_request_responses', $id, column: 'id')->review_status)->toBe('rechazada')
        ->and(serviceRow('RS-3442')->status)->toBe($status)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'proveedor.alternativa_rechazada')->where('source_id', $id)->exists()))->toBeTrue();

    actingAsSeed('U17');
    $row = collect($this->getJson('/api/v1/supplier/requests')->json('data.rows'))->firstWhere('code', 'RS-3442');
    expect($row['state'])->toBe('por_responder')->and($row['proposal']['review_status'])->toBe('rechazada');

    actingAsSeed('U03');
    expect($this->postJson("/api/v1/ops/supplier-responses/{$id}/accept", []))->toBeApiError(403);
});

it('el job vence las alternativas con el bloqueo pasado', function () {
    lockScheduledJobs();
    actingAsSeed('U17');
    $this->postJson('/api/v1/supplier/requests/RS-3442/alternative', altProposal(['hold_until' => BUSINESS_TODAY]))->assertCreated();
    $id = withinTenant(tenantA(), fn () => (string) DB::table('supplier_request_responses')->where('reservation_service_id', serviceRow('RS-3442')->id)->where('type', 'alternativa')->value('id'));
    withinTenant(tenantA(), fn () => DB::table('supplier_request_responses')->where('id', $id)->update(['hold_until' => '2026-09-01']));

    dispatch_sync((new ExpireSupplierAlternativeHolds)->forTenant((string) tenantA()->getKey()));

    expect(rowOf('supplier_request_responses', $id, column: 'id')->review_status)->toBe('expirada')
        ->and(altAudit(['entity' => 'Servicio reserva', 'entity_id' => 'RS-3442', 'action' => 'expirar_alternativa']))->toBeTrue();
});
