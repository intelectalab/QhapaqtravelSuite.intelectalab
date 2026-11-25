<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function ctxQuoteWithDestination(): object
{
    return withinTenant(tenantA(), fn () => DB::table('quote_quotes as q')
        ->join('quote_items as i', 'i.quote_version_id', '=', 'q.current_version_id')
        ->join('catalog_products as p', 'p.id', '=', 'i.product_id')
        ->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
        ->whereNull('q.deleted_at')->whereNull('d.deleted_at')->where('q.status', 'borrador')
        ->orderBy('q.code')->first(['q.code', 'q.id', 'd.name as destination']));
}

function ctxConversationWithMessages(): object
{
    $conversation = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->orderBy('code')->first(['id', 'code', 'channel']));
    $now = now();

    withinTenant(tenantA(), fn () => DB::table('collab_messages')->insert([
        ['id' => (string) Str::uuid7(), 'tenant_id' => tenantA()->getKey(), 'conversation_id' => $conversation->id, 'channel' => $conversation->channel, 'direction' => 'internal', 'body' => 'Nota del equipo: cliente difícil', 'sent_at' => $now->copy()->addMinutes(5), 'created_at' => $now],
        ['id' => (string) Str::uuid7(), 'tenant_id' => tenantA()->getKey(), 'conversation_id' => $conversation->id, 'channel' => $conversation->channel, 'direction' => 'in', 'body' => 'Quiero ir a Cusco, escríbeme a ana.perez@correo.pe o al +51 987 654 321', 'sent_at' => $now->copy()->addMinutes(6), 'created_at' => $now],
    ]));

    return $conversation;
}

it('ai/context de una cotización trae el cliente, los pasajeros y los servicios de la versión vigente', function () {
    actingAsSeed('U01');
    $quote = ctxQuoteWithDestination();
    expect($quote)->not->toBeNull();

    $response = $this->getJson('/api/v1/ai/context?source_type=quote&source_code='.$quote->code)
        ->assertOk()
        ->assertJsonPath('data.source.type', 'quote')
        ->assertJsonPath('data.source.code', $quote->code)
        ->assertJsonPath('data.recent', []);

    $facts = collect($response->json('data.facts'))->keyBy('key');
    expect($facts->keys()->all())->toContain('client', 'pax', 'products')
        ->and($facts['destinations']['value'])->toContain($quote->destination)
        ->and($response->json('data.usage'))->toHaveKeys(['enabled', 'limit', 'remaining', 'exhausted'])
        ->and($response->json('data.kinds'))->toHaveKey('reply_draft');
});

it('ai/context de una cotización muestra la razón social completa si el cliente es empresa y solo el nombre si es persona', function () {
    actingAsSeed('U01');
    $rows = withinTenant(tenantA(), fn () => DB::table('quote_quotes as q')->join('crm_clients as c', 'c.id', '=', 'q.client_id')->whereNull('q.deleted_at')
        ->whereIn('c.kind', ['empresa', 'persona'])->orderBy('q.code')->get(['q.code', 'c.kind', 'c.name'])->unique('kind')->keyBy('kind'));
    expect($rows->keys()->sort()->values()->all())->toBe(['empresa', 'persona']);

    foreach ($rows as $kind => $row) {
        $client = collect($this->getJson('/api/v1/ai/context?source_type=quote&source_code='.$row->code)->assertOk()->json('data.facts'))->firstWhere('key', 'client');
        expect($client['value'])->toBe($kind === 'empresa' ? trim($row->name) : Str::before(trim($row->name), ' '));
    }
});

it('un pedido desde la cotización usa su destino aunque el texto no lo diga y guarda solo referencias', function () {
    actingAsSeed('U01');
    $quote = ctxQuoteWithDestination();

    $response = $this->postJson('/api/v1/ai/requests', ['kind' => 'itinerary', 'prompt' => 'Arma un itinerario de 3 días para la pareja', 'source_type' => 'quote', 'source_code' => $quote->code], critical())
        ->assertStatus(202)
        ->assertJsonPath('data.source.code', $quote->code);

    expect($response->json('data.output.title'))->toBe("3 días en {$quote->destination}");

    $input = json_decode((string) withinTenant(tenantA(), fn () => DB::table('sys_ai_requests')->where('id', $response->json('data.id'))->value('input_ref')), true);
    expect($input['source'])->toBe($quote->code)
        ->and($input['record']['products'])->each->toBeString();

    $this->getJson('/api/v1/ai/context?source_type=quote&source_code='.$quote->code)->assertOk()->assertJsonPath('data.recent.0.id', $response->json('data.id'));
});

it('SC-04: el contexto de una conversación omite correos, teléfonos y notas internas', function () {
    actingAsSeed('U01');
    $conversation = ctxConversationWithMessages();

    $response = $this->getJson('/api/v1/ai/context?source_type=conversation&source_code='.$conversation->code)->assertOk();
    $body = (string) $response->getContent();
    $last = collect($response->json('data.facts'))->firstWhere('key', 'last');

    expect($last['value'])->toContain('Quiero ir a Cusco')
        ->and($body)->not->toContain('ana.perez@correo.pe')
        ->and($body)->not->toContain('987 654 321')
        ->and($body)->not->toContain('cliente difícil');

    $id = $this->postJson('/api/v1/ai/requests', ['kind' => 'reply_draft', 'prompt' => 'Responde al último mensaje del cliente', 'source_type' => 'conversation', 'source_code' => $conversation->code], critical())
        ->assertStatus(202)->assertJsonPath('data.output.text', fn (string $text): bool => str_contains($text, 'Cusco'))->json('data.id');
    $input = (string) withinTenant(tenantA(), fn () => DB::table('sys_ai_requests')->where('id', $id)->value('input_ref'));

    expect($input)->not->toContain('Quiero ir a Cusco');
});

it('un lead fuera de la cartera del asesor responde 404', function () {
    $owner = seedUser('U03');
    $code = (string) withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->where('owner_id', $owner->getKey())->orderBy('code')->value('code'));
    expect($code)->not->toBe('');

    actingAsSeed('U03');
    $this->getJson('/api/v1/ai/context?source_type=lead&source_code='.$code)->assertOk()->assertJsonPath('data.source.type', 'lead');

    actingAsSeed('U04');
    $this->getJson('/api/v1/ai/context?source_type=lead&source_code='.$code)->assertNotFound();
});

it('X-01: el admin de otra agencia no ve el contexto de una cotización ajena', function () {
    $quote = ctxQuoteWithDestination();

    actingAsTenantBAdmin();
    $this->getJson('/api/v1/ai/context?source_type=quote&source_code='.$quote->code)->assertNotFound();
});

it('ai/context sin registro responde 422 y Finanzas recibe 403 con el permiso requerido', function () {
    actingAsSeed('U01');
    $this->getJson('/api/v1/ai/context')->assertStatus(422)->assertJsonValidationErrors(['source_type', 'source_code']);

    actingAsSeed('U07');
    $response = $this->getJson('/api/v1/ai/context?source_type=quote&source_code=COT-2026-00001');

    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('ai.assistant.use');
});
