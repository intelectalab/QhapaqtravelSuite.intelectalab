<?php

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

function otaConvSetup(int $free = 2): array
{
    return withinTenant(tenantA(), function () use ($free) {
        $admin = (string) DB::table('iam_users')->where('code', 'U01')->value('id');
        $connection = (string) DB::table('channel_ota_connections')->insertGetId([
            'code' => 'OTA-CONV-01',
            'ota' => 'viator',
            'name' => 'Viator conversión',
            'account_ref' => 'P-0002',
            'webhook_secret_encrypted' => Crypt::encryptString('secreto-conversion'),
            'commission_pct' => '20.00',
            'status' => 'conectado',
            'created_by' => $admin,
            'updated_by' => $admin,
        ]);
        $product = DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->first(['id']);
        DB::table('channel_ota_product_mappings')->insert(['connection_id' => $connection, 'product_id' => $product->id, 'ota_product_ref' => 'HUM-1', 'status' => 'activo']);
        $departure = DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', '>', BUSINESS_TODAY)
            ->whereNotIn('status', ['cerrada', 'cancelada'])->orderBy('departure_date')->orderBy('departure_time')->first(['id', 'departure_date', 'sold']);
        DB::table('catalog_product_departures')->where('id', $departure->id)->update(['capacity' => (int) $departure->sold + $free, 'status' => 'abierta']);
        DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', $departure->departure_date)->where('id', '<>', $departure->id)->update(['status' => 'cerrada']);

        return ['connection' => $connection, 'departure' => (string) $departure->id, 'date' => (string) $departure->departure_date, 'sold' => (int) $departure->sold];
    });
}

function otaConvEvent(string $ref, string $date, array $booking = [], string $event = 'booking.created'): array
{
    return ['event' => $event, 'tenant_id' => (string) tenantA()->getKey(), 'connection' => 'OTA-CONV-01', 'booking' => ['ref' => $ref, 'product_ref' => 'HUM-1', 'travel_date' => $date, 'pax' => 2, 'gross_amount' => '300.00', 'net_amount' => '240.00', 'currency' => 'USD', ...$booking]];
}

function otaConvPost(array $event): TestResponse
{
    $raw = json_encode($event);

    return test()->call('POST', '/api/v1/webhooks/ota/viator', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_OTA_SIGNATURE' => hash_hmac('sha256', $raw, 'secreto-conversion')], $raw);
}

function otaConvBooking(string $ref): object
{
    return withinTenant(tenantA(), fn () => DB::table('channel_ota_bookings')->where('ota_booking_ref', $ref)->first());
}

function otaConvCustomer(string $doc): array
{
    return ['name' => 'Emma Larsen', 'email' => "emma.{$doc}@example.com", 'phone' => '+45 2012 3456', 'country' => 'Dinamarca', 'doc_type' => 'PASAPORTE', 'doc_number' => $doc];
}

it('SC-09/SC-10: el webhook convierte la reserva con cupo por el neto de la OTA y un reenvío no la duplica', function () {
    $setup = otaConvSetup();
    $event = otaConvEvent('VIA-CONV-1', $setup['date'], ['customer' => otaConvCustomer('DK1234567')]);

    $response = otaConvPost($event)->assertOk()->assertJsonPath('data.status', 'confirmada');
    $code = $response->json('data.reservation');
    expect($code)->not->toBeNull();

    $reservation = rowOf('booking_reservations', $code);
    expect($reservation->status)->toBe('confirmada')
        ->and($reservation->channel)->toBe('B2B')
        ->and($reservation->currency)->toBe('USD')
        ->and((string) $reservation->total_amount)->toBe('240.00')
        ->and(json_decode((string) $reservation->catalog_snapshot, true)['ota'])->toMatchArray(['booking_ref' => 'VIA-CONV-1', 'gross_amount' => '300.00', 'commission_amount' => '60.00', 'net_amount' => '240.00']);

    $booking = otaConvBooking('VIA-CONV-1');
    expect($booking->status)->toBe('confirmada')
        ->and((string) $booking->reservation_id)->toBe((string) $reservation->id)
        ->and((int) rowOf('catalog_product_departures', $setup['departure'], column: 'id')->sold)->toBe($setup['sold'] + 2);

    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $reservation->client_id)->first(['doc_number', 'tags']));
    expect($client->doc_number)->toBe('DK1234567')->and($client->tags)->toContain('OTA');
    expect(withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', $reservation->id)->sum('amount')))->toEqual('240.00');

    otaConvPost($event)->assertOk()->assertJsonPath('data.result', 'duplicado');
    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereRaw("catalog_snapshot->'ota'->>'booking_ref' = ?", ['VIA-CONV-1'])->count()))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Reserva OTA', 'entity_id' => 'OTA-CONV-01/VIA-CONV-1', 'action' => 'convertir'])->exists()))->toBeTrue();
});

it('SC-09: dos reservas por el último cupo dejan una confirmada y la otra rechazada con el motivo', function () {
    $setup = otaConvSetup(1);

    otaConvPost(otaConvEvent('VIA-CUPO-1', $setup['date'], ['pax' => 1, 'customer' => otaConvCustomer('DK7000001')]))->assertOk()->assertJsonPath('data.status', 'confirmada');
    $second = otaConvPost(otaConvEvent('VIA-CUPO-2', $setup['date'], ['pax' => 1, 'customer' => otaConvCustomer('DK7000002')]))->assertOk()->assertJsonPath('data.status', 'rechazada');

    expect($second->json('data.reason'))->toContain('cupos')
        ->and(otaConvBooking('VIA-CUPO-2')->reservation_id)->toBeNull()
        ->and((int) rowOf('catalog_product_departures', $setup['departure'], column: 'id')->sold)->toBe($setup['sold'] + 1);
});

it('sin datos del cliente queda recibida y se convierte a mano una sola vez eligiendo el cliente', function () {
    $setup = otaConvSetup();
    otaConvPost(otaConvEvent('VIA-MANUAL-1', $setup['date']))->assertOk()->assertJsonPath('data.status', 'recibida');
    $booking = otaConvBooking('VIA-MANUAL-1');
    expect($booking->error)->toContain('Falta identificar al cliente');

    actingAsSeed('U01');
    $listed = collect($this->getJson('/api/v1/channels/ota/bookings?filter[connection]=OTA-CONV-01')->assertOk()->json('data'))->firstWhere('ota_booking_ref', 'VIA-MANUAL-1');
    expect($listed)->toMatchArray(['convertible' => true, 'sale_amount' => '300.00', 'payout_amount' => '240.00', 'commission_amount' => '60.00']);
    expect($this->getJson('/api/v1/channels/ota/connections')->assertOk()->json('data.clients'))->not->toBeEmpty();

    $url = "/api/v1/channels/ota/bookings/{$booking->id}/convert";
    expect($this->postJson($url, []))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
    expect($this->postJson($url, [], critical()))->toBeApiError(422, 'OTA_CLIENT_REQUIRED');

    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->whereNull('deleted_at')->orderBy('code')->value('code'));
    $first = $this->postJson($url, ['client_id' => $client], critical())->assertOk()->assertJsonPath('data.status', 'confirmada')->json('data.reservation');
    $this->postJson($url, ['client_id' => $client], critical())->assertOk()->assertJsonPath('data.reservation', $first);

    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereRaw("catalog_snapshot->'ota'->>'booking_ref' = ?", ['VIA-MANUAL-1'])->count()))->toBe(1)
        ->and(rowOf('booking_reservations', $first)->client_id)->toBe(rowOf('crm_clients', $client)->id)
        ->and(otaConvBooking('VIA-MANUAL-1')->error)->toBeNull();
});

it('sin cupo la conversión manual deja la reserva rechazada con el motivo; otro estado ya no se convierte', function () {
    $setup = otaConvSetup(1);
    otaConvPost(otaConvEvent('VIA-MANUAL-2', $setup['date']))->assertOk()->assertJsonPath('data.status', 'recibida');
    $booking = otaConvBooking('VIA-MANUAL-2');
    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->whereNull('deleted_at')->orderBy('code')->value('code'));

    actingAsSeed('U01');
    $this->postJson("/api/v1/channels/ota/bookings/{$booking->id}/convert", ['client_id' => $client], critical())->assertOk()
        ->assertJsonPath('data.status', 'rechazada')
        ->assertJsonPath('data.reservation', null)
        ->assertJsonPath('data.error', fn (string $error) => str_contains($error, 'cupo'));
    expect(otaConvBooking('VIA-MANUAL-2')->status)->toBe('rechazada');
    expect($this->postJson("/api/v1/channels/ota/bookings/{$booking->id}/convert", ['client_id' => $client], critical()))->toBeApiError(409, 'OTA_BOOKING_LOCKED');
    expect($this->postJson('/api/v1/channels/ota/bookings/no-existe/convert', ['client_id' => $client], critical()))->toBeApiError(404);
});

it('un rol sin el permiso de OTAs recibe 403 con los permisos requeridos', function () {
    $setup = otaConvSetup();
    otaConvPost(otaConvEvent('VIA-ROL-1', $setup['date']))->assertOk();
    $booking = otaConvBooking('VIA-ROL-1');

    actingAsSeed('U04');
    $response = $this->postJson("/api/v1/channels/ota/bookings/{$booking->id}/convert", [], critical());
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('channels.ota.manage');

    actingAsTenantBAdmin();
    expect($this->postJson("/api/v1/channels/ota/bookings/{$booking->id}/convert", [], critical())->status())->toBeIn([403, 404]);
    expect(otaConvBooking('VIA-ROL-1')->status)->toBe('recibida');
});

it('una moneda que no se registra deja la reserva con error y sin reserva creada', function () {
    $setup = otaConvSetup();
    otaConvPost(otaConvEvent('VIA-EUR-1', $setup['date'], ['currency' => 'EUR', 'customer' => otaConvCustomer('DK7000003')]))->assertOk()->assertJsonPath('data.status', 'error');

    expect(otaConvBooking('VIA-EUR-1')->error)->toContain('EUR')
        ->and(otaConvBooking('VIA-EUR-1')->reservation_id)->toBeNull();
});

it('la cancelación de la OTA cancela la reserva creada y libera el cupo', function () {
    $setup = otaConvSetup();
    $event = otaConvEvent('VIA-CANC-1', $setup['date'], ['customer' => otaConvCustomer('DK7000004')]);
    $code = otaConvPost($event)->assertOk()->assertJsonPath('data.status', 'confirmada')->json('data.reservation');

    otaConvPost([...$event, 'event' => 'booking.cancelled'])->assertOk()->assertJsonPath('data.status', 'cancelada');

    expect(rowOf('booking_reservations', $code)->status)->toBe('cancelada')
        ->and(otaConvBooking('VIA-CANC-1')->status)->toBe('cancelada')
        ->and((int) rowOf('catalog_product_departures', $setup['departure'], column: 'id')->sold)->toBe($setup['sold']);
});
