<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function portalClientQuote(string $status): string
{
    return (string) withinTenant(tenantA(), function () use ($status): string {
        $client = DB::table('iam_users')->where('code', 'U14')->value('client_id');
        $quote = DB::table('quote_quotes')->where('client_id', $client)->whereNull('deleted_at')->orderBy('code')->first(['id', 'code']);
        DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => $status, 'valid_until' => '2026-12-31']);

        return $quote->code;
    });
}

it('PCL-BR-08: el cliente ve sus documentos, su historial de pagos y sus notificaciones', function () {
    actingAsSeed('U14');

    $documents = $this->getJson('/api/v1/portal/client/documents')->assertOk()->json('data.items');
    $payments = $this->getJson('/api/v1/portal/client/payments')->assertOk()->json('data.items');
    $notifications = $this->getJson('/api/v1/portal/client/notifications')->assertOk()->json('data.items');

    expect($documents)->toBeArray()->and($payments)->not->toBeEmpty()->and($payments[0])->toHaveKeys(['code', 'method', 'amount', 'status'])->and($notifications)->toBeArray();

    actingAsSeed('U15');
    expect($this->getJson('/api/v1/portal/client/payments'))->toBeApiError(403, 'PORTAL_CUSTOMER_ONLY');
});

it('PCL-BR-06: abrir una propuesta enviada la marca vista y pedir cambios crea un ticket sin cambiar su estado', function () {
    actingAsSeed('U14');
    $code = portalClientQuote('enviada');

    $this->postJson("/api/v1/portal/client/quotes/{$code}/view", [])->assertOk()->assertJsonPath('data.status', 'vista');
    $this->postJson("/api/v1/portal/client/quotes/{$code}/view", [])->assertOk()->assertJsonPath('data.status', 'vista');

    $this->postJson("/api/v1/portal/client/quotes/{$code}/update-request", ['message' => ''])->assertStatus(422)->assertJsonValidationErrors(['message']);
    $done = $this->postJson("/api/v1/portal/client/quotes/{$code}/update-request", ['message' => 'Queremos cambiar el hotel en Cusco por uno más céntrico.'])->assertOk()->json('data');

    expect($done['status'])->toBe('vista')
        ->and(withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', $code)->value('status')))->toBe('vista')
        ->and(withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', $done['ticket'])->value('subject')))->toContain($code);

    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', $code)->update(['status' => 'vencida']));
    $expired = $this->postJson("/api/v1/portal/client/quotes/{$code}/update-request", ['message' => 'Necesitamos la propuesta con fechas nuevas.'])->assertOk()->json('data');
    expect($expired['status'])->toBe('vencida')
        ->and(withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', $expired['ticket'])->value('subject')))->toStartWith('Actualizar la propuesta');

    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', $code)->update(['status' => 'aprobada']));
    expect($this->postJson("/api/v1/portal/client/quotes/{$code}/update-request", ['message' => 'Otro cambio más para el viaje.']))->toBeApiError(409, 'PCL-BR-11');
});

it('RVW: las rutas del contrato del pasajero para calificar responden igual que las del portal', function () {
    actingAsSeed('U15');

    $eligibility = $this->getJson('/api/v1/passenger/reviews/eligibility')->assertOk()->json('data');
    $portal = $this->getJson('/api/v1/portal/passenger/reviews')->assertOk()->json('data');
    expect($eligibility)->toBe($portal);

    $this->postJson('/api/v1/passenger/reviews', ['stars' => 9], critical())->assertStatus(422);
});
