<?php

use App\Domain\Booking\Actions\InTripOffers;
use App\Domain\Finance\Actions\PaymentLinks;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/TramosHelpers.php';

const TRAMOS_RES = 'RES-2026-000361';

beforeEach(fn () => actingAsSeed('U01'));

it('la reserva muestra sus tramos con fechas, tours, movilidad y gasto por categoría', function () {
    $trip = $this->getJson('/api/v1/reservations/RES-2026-000361/trip')->assertOk()->json('data');

    expect($trip['legs'])->toHaveCount(4)
        ->and(collect($trip['legs'])->pluck('city')->all())->toBe(['Lima', 'Arequipa', 'Puno', 'Cusco'])
        ->and($trip['trip_end'])->toBe('2026-10-06')
        ->and(collect($trip['items'])->pluck('code')->sort()->values()->all())->toBe(['TR-AQP-PUN-B', 'TR-LIM-AQP-V', 'TT-LIM-1'])
        ->and($trip['by_category']['categories']['tour'])->toBe('130.00')
        ->and($trip['by_category']['categories']['transport'])->toBe('250.00')
        ->and($trip['rules']['in_trip_sales'])->toBeTrue();
});

it('TB-09: lista solo lo vendible en ruta de los tramos que faltan y sin repetir el trayecto que ya tiene movilidad', function () {
    $available = $this->getJson('/api/v1/reservations/RES-2026-000361/in-trip-offers')->assertOk()->json('meta.available');
    $ids = collect($available['items'])->pluck('item_id')->all();

    expect($available['enabled'])->toBeTrue()
        ->and($available['min_hours_before'])->toBe(12)
        ->and($ids)->toContain('TT-PUN-1', 'TT-CUS-2', 'TR-PUN-CUS-T')
        ->and($ids)->not->toContain('TT-PUN-2', 'TT-LIM-1', 'TT-AQP-1', 'TR-AQP-PUN-P', 'TR-AQP-PUN-B')
        ->and(collect($available['items'])->firstWhere('item_id', 'TT-PUN-1')['amount'])->toBe('80.00')
        ->and(collect($available['items'])->firstWhere('item_id', 'TT-PUN-1')['date'])->toBe('2026-10-01');
});

it('el asesor ofrece el kayak en Puno: precio congelado, link de pago y auditoría; no se ofrece dos veces', function () {
    $offer = $this->postJson('/api/v1/reservations/RES-2026-000361/in-trip-offers', ['kind' => 'tour', 'item_id' => 'TT-PUN-1', 'channel' => 'whatsapp'], critical())->assertCreated()->json('data');
    $link = withinTenant(tenantA(), fn () => DB::table('fin_payment_links')->where('code', $offer['payment_link']['code'])->first());

    expect($offer['status'])->toBe('link_enviado')
        ->and($offer['code'])->toStartWith('ITO-')
        ->and($offer['amount'])->toBe('80.00')
        ->and($offer['currency'])->toBe('USD')
        ->and($offer['expires_at'])->toBe('2026-09-30T23:00:00+00:00')
        ->and($link->status)->toBe('activo')
        ->and($link->sent_via)->toBe('whatsapp')
        ->and((string) $link->amount)->toBe('80.00')
        ->and(tramosAudited(['entity' => 'Venta en ruta', 'entity_id' => $offer['code'], 'action' => 'crear']))->toBeTrue()
        ->and($this->postJson('/api/v1/reservations/RES-2026-000361/in-trip-offers', ['kind' => 'tour', 'item_id' => 'TT-PUN-1'], critical()))->toBeApiError(422, 'TB-09')
        ->and($this->getJson('/api/v1/reservations/RES-2026-000361/in-trip-offers')->json('data.0.code'))->toBe($offer['code']);
});

it('cancela una oferta no pagada y anula su link; una cancelada no se vuelve a cancelar', function () {
    $offer = $this->postJson('/api/v1/reservations/RES-2026-000361/in-trip-offers', ['kind' => 'transport', 'item_id' => 'TR-PUN-CUS-T'], critical())->assertCreated()->json('data');

    $cancelled = $this->postJson("/api/v1/reservations/RES-2026-000361/in-trip-offers/{$offer['code']}/cancel", [], critical())->assertOk()->json('data');

    expect($cancelled['status'])->toBe('cancelada')
        ->and($cancelled['payment_link']['status'])->toBe('anulado')
        ->and($this->postJson("/api/v1/reservations/RES-2026-000361/in-trip-offers/{$offer['code']}/cancel", [], critical()))->toBeApiError(409, 'TB-10')
        ->and(collect($this->getJson('/api/v1/reservations/RES-2026-000361/in-trip-offers')->json('meta.available.items'))->pluck('item_id')->all())->toContain('TR-PUN-CUS-T');
});

it('TB-09: con menos de 12 horas al inicio del tramo la oferta se rechaza con 422', function () {
    Carbon::setTestNow(Carbon::parse('2026-09-30 20:00:00', 'America/Lima'));
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-30 20:00:00', 'America/Lima'));

    expect($this->postJson('/api/v1/reservations/RES-2026-000361/in-trip-offers', ['kind' => 'tour', 'item_id' => 'TT-PUN-1'], critical()))->toBeApiError(422, 'TB-09');
});

it('al pagarse el link la oferta pasa a pagada y confirmada, y crea el ítem del viaje con su servicio de reserva', function () {
    $offer = $this->postJson('/api/v1/reservations/RES-2026-000361/in-trip-offers', ['kind' => 'tour', 'item_id' => 'TT-CUS-2'], critical())->assertCreated()->json('data');
    $total = (string) withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', TRAMOS_RES)->value('total_amount'));

    withinTenant(tenantA(), fn () => app(PaymentLinks::class)->settle($offer['payment_link']['code'], 'card', 'txn-tramos-1', null));
    [$status, $item, $receivable, $after] = withinTenant(tenantA(), fn () => [
        DB::table('booking_in_trip_offers')->where('id', $offer['id'])->value('status'),
        DB::table('booking_trip_items')->where('id', DB::table('booking_in_trip_offers')->where('id', $offer['id'])->value('trip_item_id'))->first(),
        DB::table('fin_receivables')->where('id', DB::table('fin_payment_links')->where('code', $offer['payment_link']['code'])->value('receivable_id'))->first(),
        (string) DB::table('booking_reservations')->where('code', TRAMOS_RES)->value('total_amount'),
    ]);

    expect($status)->toBe('confirmada')
        ->and($receivable->kind)->toBe('cargo')
        ->and($receivable->status)->toBe('pagada')
        ->and(bcsub($after, $total, 2))->toBe('120.00')
        ->and($item->sold_in_trip)->toBeTrue()
        ->and((string) $item->amount)->toBe('120.00')
        ->and($item->reservation_service_id)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/reservations/RES-2026-000361/trip')->json('data.items'))->pluck('code')->all())->toContain('TT-CUS-2');
});

it('el job vence las ofertas cuyo plazo pasó', function () {
    $offer = $this->postJson('/api/v1/reservations/RES-2026-000361/in-trip-offers', ['kind' => 'tour', 'item_id' => 'TT-PUN-1'], critical())->assertCreated()->json('data');
    Carbon::setTestNow(Carbon::parse('2026-10-01 00:00:00', 'America/Lima'));

    $expired = withinTenant(tenantA(), fn () => app(InTripOffers::class)->expire());

    expect($expired)->toBeGreaterThanOrEqual(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_in_trip_offers')->where('id', $offer['id'])->value('status')))->toBe('vencida');
});

it('el titular ve en su portal lo que puede agregar en ruta y lo compra con link de pago', function () {
    actingAsSeed('U14');

    $available = $this->getJson('/api/v1/portal/client/reservations/RES-2026-000361/in-trip')->assertOk()->json('data');
    $bought = $this->postJson('/api/v1/portal/client/reservations/RES-2026-000361/in-trip', ['kind' => 'tour', 'item_id' => 'TT-PUN-1'], critical())->assertOk()->json('data');

    expect($available['enabled'])->toBeTrue()
        ->and(collect($available['items'])->pluck('item_id')->all())->toContain('TT-PUN-1')
        ->and($bought['offer']['channel'])->toBe('portal')
        ->and($bought['offer']['payment_link']['url'])->toContain('/pagar/')
        ->and(collect($bought['available']['items'])->pluck('item_id')->all())->not->toContain('TT-PUN-1')
        ->and($this->getJson('/api/v1/portal/client/reservations/RES-2026-000348/in-trip'))->toBeApiError(404);
});

it('sin reservations.modify no se crean ofertas y el 403 dice qué permiso falta', function () {
    actingAsSeed('U07');
    $response = $this->postJson('/api/v1/reservations/RES-2026-000361/in-trip-offers', ['kind' => 'tour', 'item_id' => 'TT-PUN-1'], critical());

    expect($response)->toBeApiError(403)
        ->and($response->json('required_permissions'))->not->toBeEmpty();
});
