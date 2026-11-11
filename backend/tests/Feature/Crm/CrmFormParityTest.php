<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function paridadProducto(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('code')->first(['id', 'code', 'name']));
}

function paridadDestino(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('ref')->first(['id', 'name']));
}

function paridadLead(array $extra = []): string
{
    return (string) test()->postJson('/api/v1/crm/leads', [
        'name' => 'Paridad '.Str::random(5),
        'email' => 'paridad.'.Str::lower(Str::random(10)).'@prueba.pe',
        'channel' => 'web',
        'source' => 'formulario_web',
        'interest' => 'paquete',
        'pax' => 2,
        ...$extra,
    ])->assertCreated()->json('data.code');
}

function paridadAuditado(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', $entity)->where('entity_id', $code)->where('action', $action)->exists());
}

function paridadCalificado(string $code): void
{
    test()->postJson("/api/v1/crm/leads/{$code}/qualify", ['budget' => 25, 'authority' => 25, 'need' => 18, 'timeline' => 18, 'mark_qualified' => true, 'lock_version' => (int) rowOf('crm_leads', $code)->lock_version])->assertOk();
}

it('crear un lead guarda el producto, el destino del catálogo y el responsable que elige la gerencia', function () {
    actingAsSeed('U02');
    $product = paridadProducto();
    $destination = paridadDestino();

    $code = paridadLead(['product_id' => $product->id, 'destination_id' => $destination->id, 'owner_id' => seedUser('U03')->id]);
    $row = rowOf('crm_leads', $code);

    expect($row->product_id)->toBe($product->id)
        ->and($row->destination_id)->toBe($destination->id)
        ->and($row->destination_label)->toBe($destination->name)
        ->and($row->owner_id)->toBe(seedUser('U03')->id);

    $this->getJson("/api/v1/crm/leads/{$code}")->assertOk()
        ->assertJsonPath('data.product.code', $product->code)
        ->assertJsonPath('data.destination_id', $destination->id);
});

it('Ventas registra el lead en su cartera aunque elija otro responsable, y el producto debe estar activo', function () {
    $seller = actingAsSeed('U03');

    $code = paridadLead(['owner_id' => seedUser('U04')->id]);
    $draft = withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'DRAFT')->value('id'));

    expect(rowOf('crm_leads', $code)->owner_id)->toBe($seller->id)
        ->and($this->postJson('/api/v1/crm/leads', ['name' => 'Producto en borrador', 'email' => 'borrador.'.Str::random(6).'@prueba.pe', 'channel' => 'web', 'source' => 'formulario_web', 'interest' => 'paquete', 'product_id' => $draft]))->toBeApiError(422, 'CRM-BR-06');
});

it('editar un lead cambia el producto, el destino y el responsable con los mismos campos que el alta', function () {
    actingAsSeed('U02');
    $code = paridadLead(['owner_id' => seedUser('U03')->id]);
    $product = paridadProducto();
    $lead = rowOf('crm_leads', $code);

    $this->patchJson("/api/v1/crm/leads/{$code}", [
        'name' => $lead->full_name, 'email' => $lead->email, 'channel' => 'web', 'source' => 'formulario_web', 'interest' => 'paquete',
        'product_id' => $product->id, 'destination_id' => paridadDestino()->id, 'owner_id' => seedUser('U04')->id,
    ], critical((int) $lead->lock_version))->assertOk()->assertJsonPath('data.product.code', $product->code);

    expect(rowOf('crm_leads', $code)->owner_id)->toBe(seedUser('U04')->id)
        ->and(paridadAuditado('Lead', $code, 'editar'))->toBeTrue()
        ->and(paridadAuditado('Lead', $code, 'reasignar'))->toBeTrue();
});

it('convertir un lead lo vincula a un cliente existente con la etapa, el responsable y la reunión de descubrimiento', function () {
    actingAsSeed('U02');
    $code = paridadLead(['owner_id' => seedUser('U03')->id]);
    paridadCalificado($code);

    $result = $this->postJson("/api/v1/crm/leads/{$code}/convert", [
        'client_mode' => 'existing', 'client_code' => 'CLI-0003', 'opportunity_title' => 'Paridad vinculada', 'stage' => 'cotizacion',
        'owner_id' => seedUser('U04')->id, 'amount' => 3200, 'currency' => 'USD', 'expected_close_date' => '2026-12-15',
        'schedule_discovery_meeting' => true, 'lock_version' => (int) rowOf('crm_leads', $code)->lock_version,
    ], critical())->assertOk()->json('data');

    $opportunity = rowOf('crm_opportunities', $result['opportunity']);
    $activity = rowOf('crm_activities', $result['activity']);

    expect($result['client'])->toBe('CLI-0003')
        ->and($opportunity->stage)->toBe('cotizacion')
        ->and($opportunity->owner_id)->toBe(seedUser('U04')->id)
        ->and($activity->type)->toBe('reunion')
        ->and($activity->related_id)->toBe($opportunity->id)
        ->and($activity->owner_id)->toBe(seedUser('U04')->id);
});

it('convertir crea una empresa con su razón social y segmento, y exige el cliente al vincular', function () {
    actingAsSeed('U02');
    $code = paridadLead(['owner_id' => seedUser('U03')->id]);
    paridadCalificado($code);
    $version = (int) rowOf('crm_leads', $code)->lock_version;
    $base = ['opportunity_title' => 'Viaje corporativo', 'amount' => 9000, 'currency' => 'PEN', 'expected_close_date' => '2026-12-20', 'lock_version' => $version];

    $this->postJson("/api/v1/crm/leads/{$code}/convert", [...$base, 'client_mode' => 'existing'], critical())->assertStatus(422)->assertJsonValidationErrors('client_code');

    $client = $this->postJson("/api/v1/crm/leads/{$code}/convert", [...$base, 'kind' => 'empresa', 'name' => 'Minera Paridad SAC', 'segment' => 'Corporativo', 'doc_type' => 'RUC', 'doc_number' => '20'.random_int(100000000, 999999999)], critical())
        ->assertOk()->json('data.client');
    $row = rowOf('crm_clients', $client);

    expect($row->kind)->toBe('empresa')->and($row->name)->toBe('Minera Paridad SAC')->and($row->segment_code)->toBe('Corporativo');
});

it('una oportunidad entra en la etapa elegida con su producto y al editarla se puede cambiar el cliente', function () {
    actingAsSeed('U02');
    $product = paridadProducto();

    $code = $this->postJson('/api/v1/crm/opportunities', ['client_code' => 'CLI-0003', 'title' => 'Paridad de etapas', 'amount' => 1800, 'currency' => 'USD', 'expected_close_date' => '2026-12-01', 'stage' => 'negociacion', 'product_id' => $product->id])
        ->assertCreated()->json('data.code');
    $row = rowOf('crm_opportunities', $code);

    expect($row->stage)->toBe('negociacion')->and($row->product_id)->toBe($product->id);

    $this->patchJson("/api/v1/crm/opportunities/{$code}", ['client_code' => 'CLI-0001', 'title' => 'Paridad de etapas', 'amount' => 1800, 'currency' => 'USD', 'expected_close_date' => '2026-12-01', 'probability' => 70, 'product_id' => $product->id, 'lock_version' => (int) $row->lock_version])->assertOk();

    expect(rowOf('crm_opportunities', $code)->client_id)->toBe(idOf('crm_clients', 'CLI-0001'))
        ->and($this->getJson("/api/v1/crm/opportunities/{$code}")->json('data.product.code'))->toBe($product->code)
        ->and(paridadAuditado('Oportunidad', $code, 'editar'))->toBeTrue();
});

it('una actividad se crea para otro responsable y con una cotización, y se edita con la misma relación y fecha', function () {
    actingAsSeed('U02');
    $quote = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->whereIn('status', ['borrador', 'enviada', 'vista', 'negociacion'])->orderBy('code')->value('code'));

    $code = $this->postJson('/api/v1/crm/activities', ['type' => 'llamada', 'subject' => 'Seguimiento de la cotización', 'due_at' => '2026-12-05 10:00', 'owner_id' => seedUser('U03')->id, 'related_type' => 'quote', 'related_code' => $quote])
        ->assertCreated()->json('data.code');
    $row = rowOf('crm_activities', $code);

    expect($row->owner_id)->toBe(seedUser('U03')->id)->and($row->related_type)->toBe('quote');

    $this->patchJson("/api/v1/crm/activities/{$code}", ['type' => 'reunion', 'subject' => 'Reunión con el cliente', 'related_type' => 'client', 'related_code' => 'CLI-0003', 'due_at' => '2026-12-07 15:00', 'lock_version' => (int) $row->lock_version])->assertOk();
    $edited = rowOf('crm_activities', $code);

    expect($edited->related_type)->toBe('client')
        ->and($edited->related_id)->toBe(idOf('crm_clients', 'CLI-0003'))
        ->and((int) $edited->lock_version)->toBe((int) $row->lock_version + 1)
        ->and($this->patchJson("/api/v1/crm/activities/{$code}", ['type' => 'reunion', 'subject' => 'Otra vez', 'lock_version' => (int) $row->lock_version]))->toBeApiError(409, 'STALE_VERSION');
});

it('reprogramar guarda el motivo en la auditoría y Ventas no crea actividades para otro asesor', function () {
    actingAsSeed('U03');
    $code = $this->postJson('/api/v1/crm/activities', ['type' => 'llamada', 'subject' => 'Llamar', 'due_at' => '2026-12-05 10:00'])->assertCreated()->json('data.code');

    $this->postJson("/api/v1/crm/activities/{$code}/reschedule", ['due_at' => '2026-12-09 11:00', 'reason' => 'El cliente pidió otro día'])->assertOk();

    $after = withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Actividad')->where('entity_id', $code)->where('action', 'reprogramar')->value('after_value'));

    expect($after)->toContain('El cliente pidió otro día')
        ->and($this->postJson('/api/v1/crm/activities', ['type' => 'llamada', 'subject' => 'Ajena', 'due_at' => '2026-12-05 10:00', 'owner_id' => seedUser('U04')->id]))->toBeApiError(403, 'CRM-BR-31');
});

it('una empresa se crea y edita con su contacto principal, y la lista trae reservas, saldo y última compra', function () {
    actingAsSeed('U02');
    $ruc = '20'.random_int(100000000, 999999999);
    $payload = ['kind' => 'empresa', 'name' => 'Textiles Paridad SAC', 'doc_type' => 'RUC', 'doc_number' => $ruc, 'email' => 'compras.'.Str::random(6).'@paridad.pe', 'segment' => 'Corporativo', 'contact_name' => 'Rosa Quispe', 'contact_role' => 'Compras', 'contact_email' => 'rosa@paridad.pe'];

    $code = $this->postJson('/api/v1/crm/clients', $payload)->assertCreated()->json('data.code');
    $contact = withinTenant(tenantA(), fn () => DB::table('crm_client_contacts')->where('client_id', idOf('crm_clients', $code))->where('is_primary', true)->first());

    expect($contact->name)->toBe('Rosa Quispe')->and($contact->role)->toBe('Compras');

    $this->patchJson("/api/v1/crm/clients/{$code}", [...$payload, 'contact_name' => 'Rosa Quispe Mamani', 'contact_phone' => '987654321'])->assertOk();
    $contacts = withinTenant(tenantA(), fn () => DB::table('crm_client_contacts')->where('client_id', idOf('crm_clients', $code))->get());

    expect($contacts)->toHaveCount(1)
        ->and($contacts->first()->name)->toBe('Rosa Quispe Mamani')
        ->and(paridadAuditado('Cliente', $code, 'editar_contacto'))->toBeTrue();

    $rows = collect($this->getJson('/api/v1/crm/clients')->assertOk()->json('data'));
    $buyer = $rows->first(fn (array $row) => $row['reservations_count'] > 0);

    expect($rows->firstWhere('code', $code))->toHaveKeys(['reservations_count', 'balance_pen', 'last_purchase_date'])
        ->and($buyer['last_purchase_date'])->not->toBeNull();
});

it('desde una conversación se crea el lead vinculado y una actividad que queda en el hilo', function () {
    actingAsSeed('U02');
    $conversation = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->whereNull('lead_id')->whereNull('client_id')->orderBy('code')->first());

    $lead = $this->postJson("/api/v1/inbox/conversations/{$conversation->code}/lead", [
        'name' => $conversation->contact_name ?? 'Contacto del chat', 'email' => 'chat.'.Str::lower(Str::random(8)).'@prueba.pe', 'channel' => 'whatsapp', 'source' => 'whatsapp', 'interest' => 'paquete', 'lock_version' => (int) $conversation->lock_version,
    ], critical())->assertCreated()->json('data.code');

    expect(rowOf('collab_conversations', $conversation->code)->lead_id)->toBe(idOf('crm_leads', $lead))
        ->and(rowOf('crm_leads', $lead)->notes)->toContain($conversation->code)
        ->and($this->postJson("/api/v1/inbox/conversations/{$conversation->code}/lead", ['name' => 'Otro', 'email' => 'otro.'.Str::random(6).'@prueba.pe', 'channel' => 'web', 'source' => 'formulario_web', 'interest' => 'paquete'], critical()))->toBeApiError(409, 'INB-BR-06');

    $activity = $this->postJson("/api/v1/inbox/conversations/{$conversation->code}/activities", ['type' => 'llamada', 'subject' => 'Llamar por el chat', 'due_at' => '2026-12-05 10:00'], critical())->assertCreated()->json('data.code');
    $last = withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->orderByDesc('sent_at')->orderByDesc('id')->first());

    expect(rowOf('crm_activities', $activity)->related_id)->toBe(idOf('crm_leads', $lead))
        ->and($last->body)->toContain($activity);
});

it('Finanzas no crea leads ni actividades desde la bandeja', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0104/lead', ['name' => 'No', 'email' => 'no@prueba.pe', 'channel' => 'web', 'source' => 'formulario_web', 'interest' => 'paquete'], critical()))->toBeApiError(403);
});
