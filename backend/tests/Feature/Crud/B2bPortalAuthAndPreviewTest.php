<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

it('PROC-062: el usuario B2B ingresa y sale por las rutas del portal; el personal interno no entra por ahí', function () {
    $session = $this->postJson('/api/v1/b2b/auth/login', ['email' => 'reservas@wayraviajes.pe', 'password' => (string) config('demo.password')])->assertOk()->json('data');
    expect($session['home'])->toBe('/agencia')->and($session['token'])->toContain('|');

    $this->getJson('/api/v1/b2b/me', ['Authorization' => "Bearer {$session['token']}"])->assertOk();
    $this->postJson('/api/v1/b2b/auth/logout', [], ['Authorization' => "Bearer {$session['token']}"])->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('personal_access_tokens')->where('id', explode('|', $session['token'])[0])->exists()))->toBeFalse();

    $staff = (string) withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U03')->value('email'));
    $this->postJson('/api/v1/b2b/auth/login', ['email' => $staff, 'password' => (string) config('demo.password')])->assertStatus(401);
    $this->postJson('/api/v1/b2b/auth/login', ['email' => 'reservas@wayraviajes.pe', 'password' => 'equivocada1'])->assertStatus(401);
});

it('B2B-BR-06: las salidas del producto en el portal marcan las que están fuera de la anticipación mínima', function () {
    actingAsSeed('U13');
    $code = collect($this->getJson('/api/v1/b2b/catalog')->assertOk()->json('data.products'))->first(fn (array $p): bool => $p['departures'] !== [])['code'] ?? collect($this->getJson('/api/v1/b2b/catalog')->json('data.products'))->first()['code'] ?? null;

    if ($code === null) {
        $this->markTestSkipped('La agencia de la demo no tiene productos B2B autorizados.');
    }

    $data = $this->getJson("/api/v1/b2b/catalog/{$code}/departures")->assertOk()->json('data');
    expect($data)->toHaveKeys(['advance_days', 'earliest', 'items'])
        ->and(collect($data['items'])->every(fn (array $d): bool => $d['outside_advance'] === ($d['date'] < $data['earliest'])))->toBeTrue();
});

it('PCL-BR-10: la previsualización del portal lista clientes y muestra sus secciones en solo lectura dentro de la cartera', function () {
    actingAsSeed('U01');
    $clients = $this->getJson('/api/v1/channels/portal-preview/clients')->assertOk()->json('data');
    expect($clients)->not->toBeEmpty();
    $code = $clients[0]['code'];

    $section = $this->getJson("/api/v1/channels/portal-preview/clients/{$code}/reservations")->assertOk()->json('data');
    expect($section['read_only'])->toBeTrue()->and($section['client']['code'])->toBe($code)->and($section['items'])->toBeArray();
    expect($this->getJson("/api/v1/channels/portal-preview/clients/{$code}/secretos"))->toBeApiError(404);

    actingAsSeed('U03');
    $own = collect($this->getJson('/api/v1/channels/portal-preview/clients')->assertOk()->json('data'))->pluck('code')->all();
    $foreign = collect($clients)->pluck('code')->first(fn (string $client): bool => ! in_array($client, $own, true));
    if ($foreign !== null) {
        expect($this->getJson("/api/v1/channels/portal-preview/clients/{$foreign}/home"))->toBeApiError(403, 'PCL-BR-10');
    }
});
