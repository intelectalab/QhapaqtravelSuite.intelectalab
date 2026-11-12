<?php

use App\Domain\Iam\Models\User;
use App\Domain\Site\Actions\SiteAccount;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function acctSlug(string $code): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->value('slug'));
}

function acctDate(string $slug, string $from): string
{
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable'] && $day['date'] >= $from) {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException("Sin fecha vendible para {$slug}");
}

function acctOrder(string $code, string $email, array $payment): array
{
    $slug = acctSlug($code);
    $token = (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => acctDate($slug, '2026-10-25'), 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');

    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Rosa Quispe Huamán', 'email' => $email, 'phone' => '+51 955 100 200', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '45879632', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'terms' => true, 'privacy' => true, ...$payment,
    ], siteOf(extra: critical()))->assertCreated()->json('data');
}

function acctRegister(string $email, array $extra = []): TestResponse
{
    return test()->postJson('/api/v1/public/auth/register', [
        'name' => 'Rosa Quispe Huamán', 'email' => $email, 'phone' => '+51 955 100 200', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '45879632',
        'password' => 'viaje2026', 'password_confirmation' => 'viaje2026', 'accept' => true, ...$extra,
    ], siteOf());
}

function acctAudit(array $where): bool
{
    return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function acctAs(string $token): array
{
    return siteOf(extra: ['Authorization' => "Bearer {$token}"]);
}

it('SIT-BR-21: registro crea cliente y usuario customer, no duplica el correo y el ingreso fusiona la lista de deseos', function () {
    $slug = acctSlug('CUS-HUM-FD');
    $session = acctRegister('rosa.cuenta@viajes.pe', ['newsletter' => true])->assertCreated()->json('data');

    $user = withinTenant(tenantA(), fn () => User::query()->where('email', 'rosa.cuenta@viajes.pe')->first());
    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $user->client_id)->first());

    expect($session['token'])->toContain('|')->and($session['verified'])->toBeFalse()
        ->and(withinTenant(tenantA(), fn () => $user->primaryRole()?->name))->toBe('customer')
        ->and($client->tags)->toBe('{Web}')
        ->and(acctAudit(['entity' => 'Cuenta web', 'action' => 'registrar']))->toBeTrue();

    acctRegister('ROSA.cuenta@viajes.pe')->assertStatus(422)->assertJsonValidationErrors(['email']);
    acctRegister('otra@viajes.pe', ['password' => 'corta', 'password_confirmation' => 'corta', 'accept' => false])->assertStatus(422)->assertJsonValidationErrors(['password', 'accept']);

    $this->postJson('/api/v1/public/auth/login', ['email' => 'rosa.cuenta@viajes.pe', 'password' => 'equivocada'], siteOf())->assertStatus(401);
    expect(auditExists(['entity' => 'Cuenta web', 'action' => 'login_fallido']))->toBeTrue();

    $login = $this->postJson('/api/v1/public/auth/login', ['email' => 'rosa.cuenta@viajes.pe', 'password' => 'viaje2026', 'wishlist' => [$slug, 'no-existe']], siteOf())->assertOk()->json('data');
    $wishlist = $this->getJson('/api/v1/public/me/wishlist', acctAs($login['token']))->assertOk()->json('data.items');
    expect(collect($wishlist)->pluck('slug')->all())->toBe([$slug]);

    $second = acctSlug('CUS-PKG-5D4N');
    $this->putJson("/api/v1/public/me/wishlist/{$second}", [], acctAs($login['token']))->assertOk();
    $after = $this->deleteJson("/api/v1/public/me/wishlist/{$slug}", [], acctAs($login['token']))->assertOk()->json('data.items');
    expect(collect($after)->pluck('slug')->all())->toBe([$second]);

    $me = $this->getJson('/api/v1/public/me', acctAs($login['token']))->assertOk()->json('data');
    expect($me['login_email'])->toBe('rosa.cuenta@viajes.pe')->and($me['arco_types'])->toHaveCount(4);

    $updated = $this->patchJson('/api/v1/public/me', ['phone' => '+51 955 100 999', 'city' => 'Arequipa', 'locale' => 'es', 'newsletter' => true], acctAs($login['token']))->assertOk()->json('data');
    expect($updated['city'])->toBe('Arequipa')->and($updated['newsletter'])->toBeTrue();

    $this->postJson('/api/v1/public/auth/logout', [], acctAs($login['token']))->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('personal_access_tokens')->where('id', explode('|', $login['token'])[0])->exists()))->toBeFalse();
});

it('SIT-BR-21: el correo se verifica con el enlace firmado y el personal de la agencia no entra por el sitio', function () {
    $token = acctRegister('verifica@viajes.pe')->assertCreated()->json('data.token');
    $user = withinTenant(tenantA(), fn () => User::query()->where('email', 'verifica@viajes.pe')->first());

    $this->postJson('/api/v1/public/auth/email/resend', [], acctAs($token))->assertOk();
    $this->postJson('/api/v1/public/auth/password/forgot', ['email' => 'verifica@viajes.pe'], siteOf())->assertOk()->assertJsonStructure(['data' => ['message']]);
    $arco = $this->postJson('/api/v1/public/me/arco-requests', ['type' => 'acceso', 'detail' => 'Quiero una copia de mis datos personales.'], [...acctAs($token), ...critical()])->assertOk()->json('data');
    expect($arco)->toHaveKey('code');

    $this->postJson('/api/v1/public/auth/email/verify', ['email' => 'verifica@viajes.pe', 'token' => str_repeat('a', 64)], siteOf())->assertStatus(422);
    $this->postJson('/api/v1/public/auth/email/verify', ['email' => 'verifica@viajes.pe', 'token' => SiteAccount::verificationToken($user)], siteOf())->assertOk()->assertJsonPath('data.verified', true);
    expect(withinTenant(tenantA(), fn () => User::query()->find($user->id)->email_verified_at))->not->toBeNull();

    $staff = withinTenant(tenantA(), fn () => User::query()->whereNull('client_id')->where('status', 'activo')->value('email'));
    $this->postJson('/api/v1/public/auth/login', ['email' => $staff, 'password' => 'cualquiera1'], siteOf())->assertStatus(401);
});

it('SIT-BR-20: el comprador web crea su cuenta, ve su reserva y paga el saldo; si hay un pago por validar no puede volver a pagar', function () {
    $order = acctOrder('CUS-PKG-5D4N', 'compra.cuenta@viajes.pe', ['pay_mode' => 'adelanto', 'method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'ROSA Q']);
    $clients = withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('email_norm', 'compra.cuenta@viajes.pe')->count());
    $token = acctRegister('compra.cuenta@viajes.pe')->assertCreated()->json('data.token');

    expect(withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('email_norm', 'compra.cuenta@viajes.pe')->count()))->toBe($clients);

    $reservations = $this->getJson('/api/v1/public/me/reservations', acctAs($token))->assertOk()->json('data.items');
    expect($reservations)->toHaveCount(1)->and($reservations[0]['order'])->toBe($order['code'])->and((float) $reservations[0]['balance'][0]['amount'])->toBeGreaterThan(0);

    $detail = $this->getJson("/api/v1/public/me/reservations/{$reservations[0]['code']}", acctAs($token))->assertOk()->json('data');
    expect($detail['passengers'])->toHaveCount(2)->and(collect($detail['receivables'])->pluck('kind')->sort()->values()->all())->toBe(['adelanto', 'saldo']);

    $open = $this->getJson('/api/v1/public/me/receivables?status=open', acctAs($token))->assertOk()->json('data.items');
    $due = $open[0]['code'];
    expect($open)->toHaveCount(1)->and($open[0]['kind'])->toBe('saldo')->and($open[0]['can_pay'])->toBeTrue();

    $rejected = $this->postJson("/api/v1/public/me/receivables/{$due}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_51_0002', 'card_holder' => 'ROSA Q'], [...acctAs($token), ...critical()])->assertOk()->json('data');
    expect($rejected['result'])->toBe('rechazado');

    $informed = $this->postJson("/api/v1/public/me/receivables/{$due}/payments", ['method' => 'yape', 'operation_ref' => 'YP-552211'], [...acctAs($token), ...critical()])->assertOk()->json('data');
    expect($informed['result'])->toBe('por_validar');
    $waiting = $this->getJson('/api/v1/public/me/receivables?status=open', acctAs($token))->assertOk()->json('data.items.0');
    expect($waiting['can_pay'])->toBeFalse()->and($waiting['pending'])->toBe($open[0]['payable']);
    expect($this->postJson("/api/v1/public/me/receivables/{$due}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'ROSA Q'], [...acctAs($token), ...critical()]))->toBeApiError(409, 'SIT-BR-20');

    withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'YP-552211')->update(['status' => 'rechazado', 'reject_reason' => 'Operación no encontrada']));
    $paid = $this->postJson("/api/v1/public/me/receivables/{$due}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_4444', 'card_holder' => 'ROSA Q'], [...acctAs($token), ...critical()])->assertOk()->json('data');
    $receivable = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('code', $open[0]['code'])->first());

    expect($paid['result'])->toBe('aprobado')
        ->and($receivable->status)->toBe('pagada')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payment_applications')->where('receivable_id', $receivable->id)->count()))->toBe(1)
        ->and($this->getJson('/api/v1/public/me/receivables?status=open', acctAs($token))->json('data.items'))->toBe([])
        ->and(acctAudit(['entity' => 'Cuenta por cobrar', 'entity_id' => $open[0]['code'], 'action' => 'pago_en_linea']))->toBeTrue();
});

it('SIT-BR-19: gestionar mi reserva con correo y código exactos; las consultas fallidas se auditan', function () {
    $order = acctOrder('CUS-HUM-FD', 'consulta@viajes.pe', ['pay_mode' => 'total', 'method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'ROSA Q']);
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')->join('channel_ecom_orders as o', 'o.id', '=', 'r.ecom_order_id')->where('o.code', $order['code'])->value('r.code'));

    $this->postJson('/api/v1/public/orders/lookup', ['email' => 'otra@viajes.pe', 'code' => $order['code']], siteOf())->assertNotFound();
    expect(auditExists(['entity' => 'Pedido web', 'entity_id' => $order['code'], 'action' => 'consulta_fallida']))->toBeTrue();
    $this->postJson('/api/v1/public/orders/lookup', ['email' => 'consulta@viajes.pe', 'code' => 'ABC-1'], siteOf())->assertStatus(422)->assertJsonValidationErrors(['code']);

    $grant = $this->postJson('/api/v1/public/orders/lookup', ['email' => 'CONSULTA@viajes.pe', 'code' => strtolower((string) $reservation)], siteOf())->assertOk()->json('data');
    expect($grant['code'])->toBe($order['code'])->and($grant['token'])->not->toBe($order['token']);

    $this->getJson("/api/v1/public/orders/{$order['code']}", siteOf(extra: ['X-Order-Token' => $grant['token']]))->assertOk()->assertJsonPath('data.code', $order['code']);
    $this->getJson("/api/v1/public/orders/{$order['code']}", siteOf(extra: ['X-Order-Token' => 'g.falso']))->assertNotFound();
});

it('SIT-BR-17: cuando Finanzas valida el Yape del sitio, se aplica a su cuota y la reserva y el pedido quedan confirmados', function () {
    $order = acctOrder('CUS-HUM-FD', 'yape.valida@viajes.pe', ['pay_mode' => 'total', 'method' => 'yape', 'operation_ref' => 'YP-700700']);
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'YP-700700')->first());

    actingAsSeed('U07');
    $this->postJson("/api/v1/finance/payments/{$payment->code}/confirm", [], critical())->assertOk();

    $row = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->first());
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('ecom_order_id', $row->id)->first());

    expect(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('id', $payment->id)->value('status')))->toBe('aplicado')
        ->and($reservation->status)->not->toBe('pendiente_pago')
        ->and($row->status)->toBe('confirmado')
        ->and(acctAudit(['entity' => 'Reserva', 'entity_id' => $reservation->code, 'action' => 'confirmar']))->toBeTrue();
});

it('SIT-BR-17: si Finanzas rechaza el abono del sitio, el pedido se cancela, la reserva también y los cupos vuelven a la salida', function () {
    $order = acctOrder('CUS-HUM-FD', 'yape.rechaza@viajes.pe', ['pay_mode' => 'total', 'method' => 'transferencia', 'operation_ref' => 'TR-800800']);
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'TR-800800')->first());
    $row = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->first());
    $hold = withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $row->id)->first(['departure_id', 'quantity', 'status']));
    $soldBefore = (int) withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $hold->departure_id)->value('sold'));

    actingAsSeed('U07');
    $this->postJson("/api/v1/finance/payments/{$payment->code}/reject", ['reason' => 'No encontramos la operación en el banco'], critical((int) $payment->lock_version))->assertOk();

    $after = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('id', $row->id)->first());
    expect($hold->status)->toBe('confirmada')
        ->and($after->status)->toBe('cancelado')
        ->and($after->cancel_reason)->toContain('No encontramos la operación')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('ecom_order_id', $row->id)->value('status')))->toBe('cancelada')
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $row->id)->value('status')))->toBe('liberada')
        ->and((int) withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $hold->departure_id)->value('sold')))->toBe($soldBefore - (int) $hold->quantity);
});
