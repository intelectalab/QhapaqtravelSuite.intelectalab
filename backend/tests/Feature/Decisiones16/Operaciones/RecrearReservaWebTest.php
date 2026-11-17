<?php

use App\Domain\Site\Support\TransferDeadlines;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
    Storage::fake((string) config('filesystems.default'));
});

function t16opsSlug(string $code): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->value('slug'));
}

function t16opsDates(string $slug, string $from, int $count): array
{
    $dates = [];

    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable'] && $day['date'] >= $from) {
                $dates[] = $day['date'];

                if (count($dates) === $count) {
                    return $dates;
                }
            }
        }
    }

    throw new RuntimeException("Sin fechas vendibles para {$slug}");
}

function t16opsDoc(string $email): string
{
    return '4'.str_pad(substr((string) crc32($email), -7), 7, '0', STR_PAD_LEFT);
}

function t16opsOrder(string $email, string $reference, int $tours = 1): array
{
    $slug = t16opsSlug('CUS-HUM-FD');
    $token = null;

    foreach (t16opsDates($slug, '2026-10-25', $tours) as $date) {
        $request = $token === null ? test() : test()->withCredentials()->withUnencryptedCookie('ah_cart', $token);
        $token = (string) $request->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');
    }

    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Rosa Quispe Huamán', 'email' => $email, 'phone' => '+51 955 100 200', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => t16opsDoc($email), 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'terms' => true, 'privacy' => true, 'pay_mode' => 'total', 'method' => 'transferencia', 'operation_ref' => $reference,
    ], siteOf(extra: critical()))->assertCreated()->json('data');
}

function t16opsRejected(string $reference): object
{
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', $reference)->orderBy('created_at')->first());
    actingAsSeed('U07');
    test()->postJson("/api/v1/finance/payments/{$payment->code}/reject", ['reason' => 'No aparece en el banco'], critical((int) $payment->lock_version))->assertOk();

    return $payment;
}

function t16opsAudit(array $where): bool
{
    return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('duda 7: «Recrear la reserva» deja la cancelada como está y crea una nueva confirmada con los mismos datos, cupos y pago', function () {
    $order = t16opsOrder('recrear.uno@viajes.pe', 'TR-516001');
    $payment = t16opsRejected('TR-516001');
    $old = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('id', $payment->reservation_id)->first());
    $orderRow = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->first());
    $hold = withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $orderRow->id)->first(['departure_id', 'quantity', 'status']));
    $sold = (int) withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $hold->departure_id)->value('sold'));
    expect($old->status)->toBe('cancelada')->and($hold->status)->toBe('liberada');

    $preview = $this->getJson("/api/v1/reservations/{$old->code}/web-recreation")->assertOk()->json('data');
    expect($preview['eligible'])->toBeTrue()->and($preview['seats_available'])->toBeTrue()->and($preview['outcome'])->toBe('confirmada');

    $created = $this->postJson("/api/v1/reservations/{$old->code}/web-recreation", ['note' => 'El banco lo acreditó tarde'])->assertCreated()->json('data');
    $new = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', $created['reservation'])->first());

    expect($created['replaces'])->toBe($old->code)
        ->and($new->code)->not->toBe($old->code)
        ->and((string) $new->replaces_reservation_id)->toBe((string) $old->id)
        ->and($new->status)->toBeIn(['confirmada', 'pendiente_proveedor'])
        ->and((string) $new->total_amount)->toBe((string) $old->total_amount)
        ->and((string) $new->client_id)->toBe((string) $old->client_id)
        ->and($new->notes)->toContain("Reemplaza a {$old->code}")
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('id', $old->id)->value('status')))->toBe('cancelada')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $new->id)->count()))->toBe(withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $old->id)->count()))
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $new->id)->count()))->toBe(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $old->id)->count()));

    $moved = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('id', $payment->id)->first());
    expect((string) $moved->reservation_id)->toBe((string) $new->id)
        ->and($moved->status)->toBe('aplicado')
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $orderRow->id)->value('status')))->toBe('confirmada')
        ->and((int) withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $hold->departure_id)->value('sold')))->toBe($sold + (int) $hold->quantity)
        ->and(t16opsAudit(['entity' => 'Reserva', 'entity_id' => $new->code, 'action' => 'recrear']))->toBeTrue()
        ->and(t16opsAudit(['entity' => 'Reserva', 'entity_id' => $old->code, 'action' => 'reemplazar']))->toBeTrue()
        ->and(t16opsAudit(['entity' => 'Pago', 'entity_id' => $payment->code, 'action' => 'trasladar']))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'reserva.recreada')->where('channel', 'email')->pluck('recipient_address')->all()))->toContain('recrear.uno@viajes.pe');

    $this->getJson("/api/v1/reservations/{$new->code}")->assertOk()->assertJsonPath('data.replaces', $old->code);
    $this->getJson("/api/v1/reservations/{$old->code}")->assertOk()->assertJsonPath('data.replaced_by', $new->code);

    expect($this->getJson("/api/v1/reservations/{$old->code}/web-recreation")->assertOk()->json('data'))->toMatchArray(['eligible' => false, 'replaced_by' => $new->code])
        ->and($this->postJson("/api/v1/reservations/{$old->code}/web-recreation", []))->toBeApiError(409, 'SIT-RECREATE-01');

    actingAsSeed('U03');
    expect($this->getJson("/api/v1/reservations/{$old->code}/web-recreation"))->toBeApiError(403)
        ->and($this->getJson("/api/v1/reservations/{$old->code}/web-recreation")->json('required_permissions'))->toContain('finance.payments.register');
});

it('duda 7: sin cupos la reserva nueva queda pendiente de disponibilidad con el pago validado', function () {
    $order = t16opsOrder('recrear.dos@viajes.pe', 'TR-516002');
    $payment = t16opsRejected('TR-516002');
    $orderId = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->value('id'));
    $departure = withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $orderId)->value('departure_id'));
    withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $departure)->update(['sold' => DB::raw('capacity')]));
    $code = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('id', $payment->reservation_id)->value('code'));

    $preview = $this->getJson("/api/v1/reservations/{$code}/web-recreation")->assertOk()->json('data');
    expect($preview['seats_available'])->toBeFalse()->and($preview['outcome'])->toBe('pendiente_disponibilidad');

    $created = $this->postJson("/api/v1/reservations/{$code}/web-recreation", [])->assertCreated()->json('data');

    expect($created['status'])->toBe('pendiente_disponibilidad')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', $code)->value('status')))->toBe('cancelada')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('id', $payment->id)->value('status')))->toBeIn(['confirmado', 'aplicado'])
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $orderId)->value('status')))->toBe('liberada')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', DB::table('booking_reservations')->where('code', $created['reservation'])->value('id'))->pluck('status')->unique()->all()))->toBe(['pendiente']);
});

it('duda 7: el correo con datos bancarios y Mi cuenta muestran el monto de cada tour', function () {
    $order = t16opsOrder('recrear.tres@viajes.pe', 'TR-516003', 2);

    $email = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', TransferDeadlines::EVENT_PENDING)->where('recipient_address', 'recrear.tres@viajes.pe')->first());
    $codes = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereIn('ecom_order_id', DB::table('channel_ecom_orders')->where('code', $order['code'])->select('id'))->orderBy('code')->pluck('code')->all());
    expect($codes)->toHaveCount(2)
        ->and($email->body_rendered)->toContain('Monto de cada tour')->toContain($codes[0])->toContain($codes[1])->toContain(TransferDeadlines::SPLIT_HINT);

    $token = $this->postJson('/api/v1/public/auth/register', [
        'name' => 'Rosa Quispe Huamán', 'email' => 'recrear.tres@viajes.pe', 'phone' => '+51 955 100 200', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => t16opsDoc('recrear.tres@viajes.pe'),
        'password' => 'viaje2026', 'password_confirmation' => 'viaje2026', 'accept' => true,
    ], siteOf())->assertCreated()->json('data.token');
    $account = siteOf(extra: ['Authorization' => "Bearer {$token}"]);
    expect($this->getJson('/api/v1/public/me/receivables?status=open', $account)->assertOk()->json('data.by_tour'))->toBe([]);

    withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'TR-516003')->update(['status' => 'rechazado', 'reject_reason' => 'Operación no encontrada']));
    $mine = $this->getJson('/api/v1/public/me/receivables?status=open', $account)->assertOk()->json('data');
    expect(collect($mine['by_tour'])->pluck('code')->sort()->values()->all())->toBe($codes)
        ->and($mine['by_tour'][0]['amounts'][0]['amount'])->not->toBe('0.00')
        ->and($mine['split_hint'])->toBe(TransferDeadlines::SPLIT_HINT);

    $single = t16opsOrder('recrear.cuatro@viajes.pe', 'TR-516004');
    $email = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', TransferDeadlines::EVENT_PENDING)->where('recipient_address', 'recrear.cuatro@viajes.pe')->value('body_rendered'));
    expect($email)->not->toContain('Monto de cada tour')->and($single['code'])->not->toBe($order['code']);
});
