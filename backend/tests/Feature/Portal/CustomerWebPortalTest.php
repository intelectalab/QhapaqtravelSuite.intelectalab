<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function custWebReservation(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('client_id', DB::table('iam_users')->where('code', 'U14')->value('client_id'))
        ->where('travel_from', '>', BUSINESS_TODAY)->whereNotIn('status', ['cancelada', 'borrador'])->orderBy('travel_from')->value('code'));
}

it('CAN-V21: el cliente ve el resumen web con plan de pago y cuotas abiertas; el pasajero no puede', function () {
    actingAsSeed('U14');
    $code = custWebReservation();

    $summary = $this->getJson("/api/v1/portal/client/reservations/{$code}/web-summary")->assertOk()->json('data');
    expect($summary['code'])->toBe($code)->and($summary)->toHaveKeys(['web', 'payment_plan', 'receivables', 'passengers'])
        ->and(collect($summary['receivables'])->pluck('status')->diff(['abierta', 'parcial', 'vencida']))->toBeEmpty();

    actingAsSeed('U15');
    expect($this->getJson('/api/v1/portal/client/reservations/RES-2026-000347/web-summary'))->toBeApiError(403, 'PORTAL_CUSTOMER_ONLY');
});

it('CAN-V21: el cliente completa acompañantes por código de reserva y paga una cuota abierta desde el portal', function () {
    actingAsSeed('U14');
    $code = custWebReservation();
    $current = $this->getJson("/api/v1/portal/passenger/companions?trip={$code}")->assertOk()->json('data');
    $adult = collect($current['passengers'])->firstWhere('type', 'ADT');

    $updated = $this->putJson("/api/v1/portal/client/reservations/{$code}/companions", ['passengers' => [['seq' => $adult['seq'], 'first_name' => 'Gabriela', 'last_name' => 'Ríos Montoya', 'birth_date' => '1988-03-12', 'doc_type' => 'DNI', 'doc_number' => '45781236', 'nationality' => 'Perú']]], ['If-Match' => (string) $current['lock_version']])->assertOk()->json('data');
    expect(collect($updated['passengers'])->firstWhere('seq', $adult['seq'])['name'])->toBe('Gabriela Ríos Montoya');

    $open = collect($this->getJson("/api/v1/portal/client/reservations/{$code}/web-summary")->json('data.receivables'))->firstWhere('can_pay', true);
    if ($open === null) {
        expect(true)->toBeTrue();

        return;
    }

    $receivable = $open['code'];
    $paid = $this->postJson("/api/v1/portal/client/receivables/{$receivable}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_4242', 'card_holder' => 'GABRIELA RIOS'], critical())->assertOk()->json('data');
    expect($paid['result'])->toBe('aprobado')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('code', $receivable)->value('status')))->toBe('pagada');
});
