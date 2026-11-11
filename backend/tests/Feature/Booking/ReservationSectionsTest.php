<?php

use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('la reserva 360 trae pagos, comprobantes, operación, cambios y políticas', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/reservations/RES-2026-000344')->assertOk()->json('data');

    expect($data)->toHaveKeys(['created_at', 'snapshot_label', 'policies', 'change_log', 'operation', 'counts', 'payments', 'invoices'])
        ->and($data['payments'])->not->toBeEmpty()
        ->and($data['payments'][0])->toHaveKeys(['code', 'paid_on', 'method', 'amount', 'status', 'receivable_code'])
        ->and($data['invoices'])->not->toBeEmpty()
        ->and($data['policies']['source'])->toBeIn(['snapshot', 'product', 'none'])
        ->and($data['counts'])->toHaveKeys(['web', 'feedback', 'unread_feedback']);
});

it('Operaciones ve la orden pero no los pagos ni los comprobantes', function () {
    actingAsSeed('U05');

    $data = $this->getJson('/api/v1/reservations/RES-2026-000344')->assertOk()->json('data');

    expect($data)->not->toHaveKey('payments')
        ->and($data)->not->toHaveKey('invoices');
});

it('lista los comentarios y los mensajes del pasajero de la reserva', function () {
    actingAsSeed('U01');

    $feedback = $this->getJson('/api/v1/reservations/RES-2026-000350/pax-feedback')->assertOk()->json('data');
    $messages = $this->getJson('/api/v1/reservations/RES-2026-000350/pax-messages')->assertOk()->json('data');

    expect($feedback)->not->toBeEmpty()
        ->and($feedback[0])->toHaveKeys(['code', 'type', 'status', 'text', 'reply'])
        ->and($messages)->toBeArray();
    $this->getJson('/api/v1/reservations/RES-2026-000350/web-snapshot')->assertOk()->assertJsonStructure(['data']);
});

it('las secciones respetan la cartera del asesor', function () {
    actingAsSeed('U04');

    expect($this->getJson('/api/v1/reservations/RES-2026-000349/pax-feedback'))->toBeApiError(403, 'SEC-BR-09');
});
