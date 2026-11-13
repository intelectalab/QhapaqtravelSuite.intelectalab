<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

require_once __DIR__.'/SeguimientoHelpers.php';

beforeEach(fn () => segCleanSlate());

function segSignupBody(array $overrides = []): array
{
    return [...[
        'plan' => 'starter',
        'cycle' => 'prueba',
        'admin_name' => 'Lucía Quispe',
        'email' => 'lucia@andesnuevos.pe',
        'password' => 'Machu-Picchu-2026',
        'commercial_name' => 'Andes Nuevos',
        'ruc' => segRuc('2060777111'),
        'city' => 'Cusco',
        'business_type' => 'Operador turístico',
        'doc_type' => 'factura',
        'accept_terms' => true,
        'terms_version' => 'TYC-2026.1',
        'marketing_consent' => true,
        'utm' => ['source' => 'google', 'campaign' => 'agencias-cusco'],
    ], ...$overrides];
}

function segWelcomeCoupon(): void
{
    DB::connection('pgsql_platform')->table('coupons')->insert(['id' => (string) Str::uuid7(), 'code' => 'KIPUTURISMO2026', 'type' => 'percent', 'value' => 10, 'duration_cycles' => 1, 'plan_ids' => '{}', 'max_redemptions' => 100, 'redeemed_count' => 0, 'status' => 'active']);
}

function segSignup(array $overrides = []): array
{
    return test()->postJson('/api/v1/public/signups', segSignupBody($overrides), critical())->assertCreated()->json('data');
}

it('LND-01: los planes públicos traen precios, tipo de cambio e indican que Enterprise no tiene alta directa', function () {
    $data = $this->getJson('/api/v1/public/plans')->assertOk()->json('data');
    $plans = collect($data['plans'])->keyBy('code');

    expect($plans['starter']['price_month'])->toEqual(490)
        ->and($plans['starter']['self_service'])->toBeTrue()
        ->and($plans['enterprise']['self_service'])->toBeFalse()
        ->and($plans['starter']['annual_months_paid'])->toBe(10)
        ->and($data['fx']['currency'])->toBe('USD')
        ->and($data['igv_pct'])->toEqual(18)
        ->and($data['trial']['card_required'])->toBeFalse();
});

it('LND-02 y LND-07: el cupón del 10 % en Starter anual da S/ 5,203.80', function () {
    segWelcomeCoupon();

    $totals = $this->postJson('/api/v1/public/coupons/validate', ['coupon' => 'kiputurismo2026', 'plan' => 'starter', 'cycle' => 'anual'])->assertOk()->json('data.totals');

    expect($totals['subtotal'])->toBe('4900.00')
        ->and($totals['discount'])->toBe('490.00')
        ->and($totals['igv'])->toBe('793.80')
        ->and($totals['total'])->toBe('5203.80');
    expect($this->postJson('/api/v1/public/coupons/validate', ['coupon' => 'NOEXISTE', 'plan' => 'starter', 'cycle' => 'anual']))->toBeApiError(422, 'COUPON_INVALID');
    expect($this->postJson('/api/v1/public/coupons/validate', ['coupon' => 'LANZAMIENTO', 'plan' => 'starter', 'cycle' => 'mensual']))->toBeApiError(422, 'COUPON_INVALID');
});

it('LND-04: el RUC se consulta en el padrón (adaptador simulado) y rechaza formatos inválidos o contribuyentes de baja', function () {
    $ok = $this->getJson('/api/v1/public/ruc/'.segRuc('2060777111'))->assertOk()->json('data');
    expect($ok['active'])->toBeTrue()->and($ok['legal_name'])->not->toBeEmpty();

    expect($this->getJson('/api/v1/public/ruc/2060'))->toBeApiError(422, 'RUC_INVALID');
    expect($this->getJson('/api/v1/public/ruc/'.segRuc('2060777000')))->toBeApiError(422, 'RUC_INVALID');
});

it('LND-08: la prueba de 14 días sin tarjeta crea la agencia, su administrador y la suscripción en prueba', function () {
    $signup = segSignup();
    expect($signup['state'])->toBe('prueba')->and($signup['totals']['total'])->toBe('0.00');

    $db = DB::connection('pgsql_platform');
    $tenant = $db->table('tenants')->where('code', $signup['tenant'])->first();
    expect($tenant->status)->toBe('prueba')->and($tenant->subdomain)->toBe('andes-nuevos');
    expect($db->table('subscriptions')->where('tenant_id', $tenant->id)->value('status'))->toBe('trialing');
    $admin = $db->table('iam_users')->where('tenant_id', $tenant->id)->where('email', 'lucia@andesnuevos.pe')->first();
    expect($admin->status)->toBe('activo')->and(Hash::check('Machu-Picchu-2026', (string) $admin->password))->toBeTrue();
    expect(segAudited(['entity' => 'Alta landing', 'entity_id' => $signup['tenant'], 'action' => 'alta_prueba'], true))->toBeTrue();

    $welcome = $this->getJson('/api/v1/public/signups/'.$signup['token'])->assertOk()->json('data');
    expect($welcome['state'])->toBe('prueba')->and($welcome['steps'])->toHaveCount(5)->and($welcome['trial_ends_at'])->not->toBeNull();
    $this->getJson('/api/v1/public/signups/'.$signup['tenant'].'.token-falso')->assertNotFound();

    expect($this->postJson('/api/v1/public/signups', segSignupBody(['email' => 'otra@andesnuevos.pe', 'ruc' => segRuc('2060777222'), 'commercial_name' => 'Otra agencia']), critical()))->toBeApiError(422, 'TRIAL_ALREADY_USED');
});

it('LND-03, LND-04 y LND-08: correo de otra agencia, RUC usado y Enterprise se rechazan', function () {
    $taken = DB::connection('pgsql_platform')->table('iam_users')->whereNull('deleted_at')->value('email');
    $usedRuc = trim((string) DB::connection('pgsql_platform')->table('tenants')->value('ruc'));

    expect($this->postJson('/api/v1/public/signups', segSignupBody(['email' => $taken]), critical()))->toBeApiError(409, 'SIGNUP_EMAIL_TAKEN');
    expect($this->postJson('/api/v1/public/signups', segSignupBody(['ruc' => $usedRuc]), critical()))->toBeApiError(422, 'TRIAL_ALREADY_USED');
    expect($this->postJson('/api/v1/public/signups', segSignupBody(['ruc' => segRuc('2060777000')]), critical()))->toBeApiError(422, 'RUC_INVALID');
    expect($this->postJson('/api/v1/public/signups', segSignupBody(['plan' => 'enterprise', 'cycle' => 'mensual']), critical()))->toBeApiError(422, 'PLAN_NOT_SELF_SERVICE');
    expect($this->postJson('/api/v1/public/signups', segSignupBody(['password' => '1234567890']), critical()))->toBeApiError(422);
});

it('LND-02: si el total enviado no coincide con el recalculado responde 422 SIGNUP_TOTAL_CHANGED', function () {
    segWelcomeCoupon();

    $response = $this->postJson('/api/v1/public/signups', segSignupBody(['cycle' => 'anual', 'coupon' => 'KIPUTURISMO2026', 'expected_total' => '4900.00']), critical());
    expect($response)->toBeApiError(422, 'SIGNUP_TOTAL_CHANGED');
    expect($response->json('details.totals.total'))->toBe('5203.80');
});

it('alta pagada: la tarjeta rechazada responde 402 y la aprobada activa la agencia, paga la factura y canjea el cupón', function () {
    segWelcomeCoupon();
    $signup = segSignup(['cycle' => 'anual', 'coupon' => 'KIPUTURISMO2026', 'expected_total' => '5203.80']);
    expect($signup['state'])->toBe('pago_pendiente');
    $db = DB::connection('pgsql_platform');
    expect($db->table('tenants')->where('code', $signup['tenant'])->value('status'))->toBe('suspendido');

    $declined = $this->postJson("/api/v1/public/signups/{$signup['token']}/checkout", ['method' => 'tarjeta', 'card_token' => 'tok_51_4242'], critical());
    expect($declined)->toBeApiError(402, 'PAYMENT_DECLINED');
    expect($this->getJson("/api/v1/public/signups/{$signup['token']}")->json('data.state'))->toBe('fallida');

    $paid = $this->postJson("/api/v1/public/signups/{$signup['token']}/checkout", ['method' => 'tarjeta', 'card_token' => 'tok_ok_4242', 'expected_total' => '5203.80'], critical())->assertOk()->json('data');
    expect($paid['state'])->toBe('pagada')->and($paid['total'])->toBe('5203.80');

    $tenant = $db->table('tenants')->where('code', $signup['tenant'])->first();
    expect($tenant->status)->toBe('activo');
    $subscription = $db->table('subscriptions')->where('tenant_id', $tenant->id)->first();
    expect($subscription->status)->toBe('active')->and($subscription->cycle)->toBe('annual');
    $invoice = $db->table('platform_invoices')->where('tenant_id', $tenant->id)->where('status', 'paid')->first();
    expect((string) $invoice->total)->toBe('5203.80');
    expect($db->table('coupons')->where('code', 'KIPUTURISMO2026')->value('redeemed_count'))->toBe(1);
    expect($db->table('coupon_redemptions')->where('tenant_id', $tenant->id)->exists())->toBeTrue();

    $welcome = $this->getJson("/api/v1/public/signups/{$signup['token']}")->assertOk()->json('data');
    expect($welcome['state'])->toBe('pagada')->and($welcome['invoice']['status'])->toBe('paid');
    $this->postJson("/api/v1/public/signups/{$signup['token']}/checkout", ['method' => 'tarjeta', 'card_token' => 'tok_ok_4242'], critical())->assertOk()->assertJsonPath('data.replayed', true);
    expect(segAudited(['entity' => 'Alta landing', 'entity_id' => $signup['tenant'], 'action' => 'alta_pagada'], true))->toBeTrue();
});

it('LND-06: Yape sin código de aprobación deja el alta en pago pendiente con QR de 10 minutos', function () {
    $signup = segSignup(['cycle' => 'mensual']);

    $pending = $this->postJson("/api/v1/public/signups/{$signup['token']}/checkout", ['method' => 'yape', 'phone' => '987654321'], critical())->assertStatus(202)->json('data');
    expect($pending['state'])->toBe('pago_pendiente')->and($pending['payment']['qr'])->not->toBeEmpty();

    $status = $this->getJson("/api/v1/public/signups/{$signup['token']}")->assertOk()->json('data');
    expect($status['poll_seconds'])->toBe(3)->and($status['payment']['expired'])->toBeFalse();

    $this->postJson("/api/v1/public/signups/{$signup['token']}/checkout", ['method' => 'yape', 'phone' => '987654321', 'approval_code' => '123456'], critical())->assertOk()->assertJsonPath('data.state', 'pagada');
});

it('registra leads comerciales de la landing y no duplica el mismo correo en 24 horas', function () {
    $body = ['full_name' => 'Rosa Mamani', 'email' => 'rosa@viajesaltiplano.pe', 'company' => 'Viajes Altiplano', 'business_type' => 'Agencia de viajes minorista', 'team_size' => '6-15', 'intent' => 'demo', 'source' => 'chatbot', 'transcript' => 'Kipu: ¿En qué te ayudo? Rosa: Quiero una demo.', 'consent' => true];

    $first = $this->postJson('/api/v1/public/sales-leads', $body, critical())->assertCreated()->json('data');
    $this->postJson('/api/v1/public/sales-leads', $body, critical())->assertOk()->assertJsonPath('data.repeated', true);
    expect(DB::connection('pgsql_platform')->table('platform_demo_requests')->where('code', $first['code'])->value('source'))->toBe('landing_chatbot');
    expect($this->postJson('/api/v1/public/sales-leads', [...$body, 'consent' => false], critical()))->toBeApiError(422);
});

it('el Super Admin ve las altas de la landing con su estado, origen y embudo', function () {
    segSignup();

    actingAsPlatform();
    $data = $this->getJson('/api/v1/platform/signups')->assertOk()->json('data');
    $row = collect($data['rows'])->firstWhere('agency', 'Andes Nuevos');

    expect($row['state'])->toBe('prueba')
        ->and($row['source'])->toBe('google')
        ->and($row['campaign'])->toBe('agencias-cusco')
        ->and($data['kpis']['trials'])->toBeGreaterThanOrEqual(1)
        ->and($data['funnel'])->toHaveCount(4);
});
