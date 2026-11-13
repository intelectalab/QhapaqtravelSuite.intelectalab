<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

function crecAOtaSetup(): array
{
    return withinTenant(tenantA(), function () {
        $connection = (string) DB::table('channel_ota_connections')->insertGetId([
            'code' => 'OTA-PEST-01',
            'ota' => 'viator',
            'name' => 'Viator pruebas',
            'account_ref' => 'P-0001',
            'webhook_secret_encrypted' => Crypt::encryptString('secreto-de-pruebas'),
            'status' => 'conectado',
        ]);
        $product = DB::table('catalog_products')->whereNull('deleted_at')->value('id');
        DB::table('channel_ota_product_mappings')->insert(['connection_id' => $connection, 'product_id' => $product, 'ota_product_ref' => 'VIA-PRD-1', 'status' => 'activo']);

        return ['connection' => $connection];
    });
}

function crecAOtaPost(array $event, string $secret = 'secreto-de-pruebas'): TestResponse
{
    $raw = json_encode($event);

    return test()->call('POST', '/api/v1/webhooks/ota/viator', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_OTA_SIGNATURE' => hash_hmac('sha256', $raw, $secret)], $raw);
}

it('POST /quotes/{id}/external-offers/search busca ofertas en el adaptador y POST las añade a la cotización', function () {
    actingAsSeed('U02');

    $search = $this->postJson('/api/v1/quotes/COT-2026-00191/external-offers/search', ['kind' => 'hotel', 'destination' => 'Cusco', 'pax' => 2])->assertOk()->json('data');
    expect($search['results'])->toHaveCount(3)
        ->and($search['results'][0]['provider'])->toBe('hotelbeds')
        ->and($search['code'])->toBe('COT-2026-00191');

    $offer = $search['results'][0];
    $added = $this->postJson('/api/v1/quotes/COT-2026-00191/external-offers', ['provider' => $offer['provider'], 'offer_ref' => $offer['offer_ref']], critical())->assertOk()->json('data');
    expect($added['external_offers'])->toHaveCount(1)
        ->and($added['external_offers'][0]['sell_amount'])->toBe($offer['sell_amount'])
        ->and($added['external_offers'][0]['status'])->toBe('cotizada')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Cotización', 'entity_id' => 'COT-2026-00191', 'action' => 'agregar_oferta'])->exists()))->toBeTrue();

    expect($this->postJson('/api/v1/quotes/COT-2026-00191/external-offers', ['provider' => $offer['provider'], 'offer_ref' => $offer['offer_ref']], critical()))->toBeApiError(409, 'OFFER_ALREADY_ADDED');
    expect($this->postJson('/api/v1/quotes/COT-2026-00191/external-offers', ['provider' => 'hotelbeds', 'offer_ref' => 'SBX-hotel-0-inventado'], critical()))->toBeApiError(422, 'OFFER_NOT_FOUND');

    $offerId = $added['external_offers'][0]['id'];
    $this->deleteJson("/api/v1/quotes/COT-2026-00191/external-offers/{$offerId}")->assertNoContent();
    expect(withinTenant(tenantA(), fn () => DB::table('quote_external_offers')->where('id', $added['external_offers'][0]['id'])->value('status')))->toBe('cancelada');
    expect($this->deleteJson("/api/v1/quotes/COT-2026-00191/external-offers/{$offerId}"))->toBeApiError(404);
});

it('una cotización convertida no admite ofertas y Ventas solo trabaja su cartera', function () {
    actingAsSeed('U02');
    $converted = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('status', 'convertida')->value('code'));
    $offer = $this->postJson("/api/v1/quotes/{$converted}/external-offers/search", ['kind' => 'aereo', 'origin' => 'Lima', 'destination' => 'Cusco'])->assertOk()->json('data.results.0');

    expect($this->postJson("/api/v1/quotes/{$converted}/external-offers", ['provider' => $offer['provider'], 'offer_ref' => $offer['offer_ref']], critical()))->toBeApiError(422, 'QUOTE_NOT_EDITABLE');

    $sales = seedUser('U04');
    $foreign = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->where('owner_id', '<>', $sales->getKey())->value('code'));
    actingAsSeed('U04');
    expect($this->postJson("/api/v1/quotes/{$foreign}/external-offers/search", ['kind' => 'hotel', 'destination' => 'Cusco']))->toBeApiError(403, 'SEC-BR-09');
});

it('GET /reports/insights genera alertas de cobranza atrasada desde datos reales y POST /resolve las cierra', function () {
    actingAsSeed('U07');
    withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('code', 'CXC-00714')->update(['status' => 'vencida', 'due_date' => now()->subDays(20)->toDateString()]));
    $overdue = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->whereNull('deleted_at')->where('status', 'vencida')->whereColumn('paid_amount', '<', 'amount')->count());

    foreach ([-1, 0, 1] as $offset) {
        Cache::forget('t:'.tenantA()->getKey().':insights:'.now()->addDays($offset)->toDateString());
    }

    $page = $this->getJson('/api/v1/reports/insights?filter[kind]=cobranza_atrasada&page[size]=100')->assertOk()->json();
    $collections = collect($page['data']);

    expect($collections->count())->toBe(min($overdue, 50))
        ->and($collections->pluck('metric.code'))->toContain('CXC-00714')
        ->and($page['meta']['kpis']['open'])->toBeGreaterThanOrEqual($collections->count());

    $first = $collections->firstWhere('metric.code', 'CXC-00714');
    expect($first['metric'])->toHaveKeys(['code', 'balance', 'days_overdue']);

    $this->postJson("/api/v1/reports/insights/{$first['id']}/resolve", ['status' => 'resuelta'])->assertOk()->assertJsonPath('data.status', 'resuelta');
    expect($this->postJson("/api/v1/reports/insights/{$first['id']}/resolve", ['status' => 'descartada']))->toBeApiError(409, 'INSIGHT_CLOSED');
    expect($this->postJson('/api/v1/reports/insights/no-es-un-id/resolve', ['status' => 'resuelta']))->toBeApiError(404);

    actingAsSeed('U04');
    expect($this->getJson('/api/v1/reports/insights'))->toBeApiError(403);
});

it('POST /webhooks/ota/{ota} registra la reserva entrante una sola vez, rechaza productos sin mapeo y procesa la cancelación', function () {
    crecAOtaSetup();
    $event = ['event' => 'booking.created', 'tenant_id' => (string) tenantA()->getKey(), 'connection' => 'OTA-PEST-01', 'booking' => ['ref' => 'VIA-BK-1001', 'product_ref' => 'VIA-PRD-1', 'travel_date' => '2026-12-10', 'pax' => 2, 'gross_amount' => '300.00', 'net_amount' => '240.00', 'currency' => 'USD']];

    expect(crecAOtaPost($event, 'otro-secreto'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    crecAOtaPost($event)->assertOk()->assertJsonPath('data.status', 'recibida');
    crecAOtaPost($event)->assertOk()->assertJsonPath('data.result', 'duplicado');

    crecAOtaPost([...$event, 'booking' => [...$event['booking'], 'ref' => 'VIA-BK-1002', 'product_ref' => 'VIA-SIN-MAPEO']])->assertOk()->assertJsonPath('data.status', 'rechazada');
    crecAOtaPost([...$event, 'event' => 'booking.cancelled'])->assertOk()->assertJsonPath('data.status', 'cancelada');

    expect(withinTenant(tenantA(), fn () => DB::table('channel_ota_bookings')->where('ota_booking_ref', 'VIA-BK-1001')->count()))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_ota_bookings')->where('ota_booking_ref', 'VIA-BK-1001')->value('status')))->toBe('cancelada');
    expect(crecAOtaPost([...$event, 'connection' => 'OTA-NO-EXISTE']))->toBeApiError(404);
});
