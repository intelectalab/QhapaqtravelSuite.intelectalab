<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
});

function draftQuoteFor(string $client = 'CLI-0012'): string
{
    return test()->postJson('/api/v1/quotes', [
        'client_code' => $client,
        'title' => 'Cusco para compartir',
        'currency' => 'USD',
        'travel_from' => '2026-12-10',
        'travel_to' => '2026-12-12',
        'pax_adt' => 2,
        'items' => [['product_code' => 'CUS-MAPI-FD', 'date' => '2026-12-10', 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto', 'unit_price' => '600']],
    ])->assertCreated()->json('data.code');
}

function quoteHeaders(string $code): array
{
    return critical((int) rowOf('quote_quotes', $code)->lock_version);
}

function tokenFromUrl(string $url): string
{
    return substr($url, strrpos($url, '/') + 1);
}

it('V2 / 03 §11 #12: envía por varios canales a la vez, crea un envío por canal y genera el enlace', function () {
    actingAsSeed('U03');
    $code = draftQuoteFor();

    $sent = $this->postJson("/api/v1/quotes/{$code}/send", ['channels' => ['Email', 'WhatsApp', 'Portal'], 'recipient' => 'cliente@example.com', 'phone' => '+51987654321', 'message' => 'Te comparto la propuesta.'], quoteHeaders($code))
        ->assertOk()->json('data');

    expect($sent['channels'])->toBe(['Email', 'WhatsApp', 'Portal'])
        ->and($sent['url'])->toContain('/c/');
    $sends = withinTenant(tenantA(), fn () => DB::table('quote_sends as s')->join('quote_quotes as q', 'q.id', '=', 's.quote_id')->where('q.code', $code)->pluck('s.recipient', 's.channel'));
    expect($sends->all())->toMatchArray(['Email' => 'cliente@example.com', 'WhatsApp' => '+51987654321', 'Portal' => 'Portal del cliente']);

    $this->postJson("/api/v1/quotes/{$code}/send", ['channels' => []], quoteHeaders($code))->assertStatus(422)->assertJsonValidationErrors('channels');
});

it('V1: el enlace público muestra la versión vigente sin costos y registra la vista', function () {
    actingAsSeed('U03');
    $code = draftQuoteFor();
    $url = $this->postJson("/api/v1/quotes/{$code}/send", ['channels' => ['Portal']], quoteHeaders($code))->assertOk()->json('data.url');

    $page = $this->getJson('/api/v1/public/quotes/'.tokenFromUrl($url))->assertOk()->json('data');
    expect($page['code'])->toBe($code)
        ->and($page['items'][0])->not->toHaveKey('unit_cost')
        ->and($page['totals'])->not->toHaveKey('cost')
        ->and(json_encode($page))->not->toContain('cost_total');

    $quote = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', $code)->first(['id', 'status', 'viewed_at']));
    expect($quote->status)->toBe('vista')
        ->and($quote->viewed_at)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('quote_views')->where('quote_id', $quote->id)->where('source', 'portal')->count()))->toBe(1);
});

it('V1: regenerar el enlace revoca el anterior y queda auditado', function () {
    actingAsSeed('U03');
    $code = draftQuoteFor();
    $old = $this->postJson("/api/v1/quotes/{$code}/send", ['channels' => ['Portal']], quoteHeaders($code))->assertOk()->json('data.url');

    $fresh = $this->postJson("/api/v1/quotes/{$code}/token", [], quoteHeaders($code))->assertOk()->json('data');
    expect($fresh['url'])->not->toBe($old)->and($fresh['regenerated'])->toBeTrue();

    $this->getJson('/api/v1/public/quotes/'.tokenFromUrl($old))->assertNotFound();
    $this->getJson('/api/v1/public/quotes/'.tokenFromUrl($fresh['url']))->assertOk();
    $this->getJson('/api/v1/public/quotes/no-es-un-token')->assertNotFound();

    expect($this->getJson("/api/v1/quotes/{$code}")->json('data.share.url'))->toBe($fresh['url'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', $code)->where('action', 'regenerar_token')->exists()))->toBeTrue();

    actingAsSeed('U07');
    $this->postJson("/api/v1/quotes/{$code}/token", [], quoteHeaders($code))->assertForbidden();
});

it('V3 / 03 §11 #4: la evidencia de aprobación es una lista cerrada con referencia obligatoria', function () {
    actingAsSeed('U03');
    $code = draftQuoteFor();
    $this->postJson("/api/v1/quotes/{$code}/send", ['channels' => ['Portal']], quoteHeaders($code))->assertOk();

    $this->postJson("/api/v1/quotes/{$code}/approve", ['approved_by_name' => 'Ana Torres', 'channel' => 'Llamada'], quoteHeaders($code))
        ->assertStatus(422)->assertJsonValidationErrors(['channel', 'ref']);

    $this->postJson("/api/v1/quotes/{$code}/approve", ['approved_by_name' => 'Ana Torres', 'channel' => 'Orden de compra / servicio', 'ref' => 'OC-2026-118'], quoteHeaders($code))->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', $code)->first(['status', 'approval_channel', 'approval_ref'])))
        ->status->toBe('aprobada')
        ->approval_channel->toBe('Orden de compra / servicio')
        ->approval_ref->toBe('OC-2026-118');
});
