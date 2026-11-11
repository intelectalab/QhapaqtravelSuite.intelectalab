<?php

use Illuminate\Support\Facades\DB;

it('la ficha avisa que la solicitud de anulación fue rechazada, con quién, cuándo y la nota', function () {
    lockSeededBookings();
    $request = withinTenant(tenantA(), fn () => DB::table('booking_cancel_requests')->where('reservation_id', reservationRow('RES-2026-000349')->id)->where('status', 'pendiente')->first());
    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/RES-2026-000349/cancel-requests/{$request->id}/reject", ['note' => 'El cliente confirmó que viaja'])->assertOk();

    $data = $this->getJson('/api/v1/reservations/RES-2026-000349')->assertOk()->json('data');

    expect($data['cancel_request'])->toBeNull()
        ->and($data['cancel_rejected']['decision_note'])->toBe('El cliente confirmó que viaja')
        ->and($data['cancel_rejected']['decided_by'])->toBe(seedUser('U02')->name)
        ->and($data['cancel_rejected']['decided_at'])->not->toBeNull()
        ->and($data)->toHaveKey('rescheduled_at');
});

it('los servicios traen la salida asociada y el historial la IP y la correlación', function () {
    $quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U03');
    $code = $this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version, idem('conv')))->assertCreated()->json('data.code');

    $services = collect($this->getJson("/api/v1/reservations/{$code}")->assertOk()->json('data.services'));
    $history = collect($this->getJson("/api/v1/reservations/{$code}/history")->assertOk()->json('data'));

    expect($services->pluck('departure')->filter()->first())->toStartWith('SAL-')
        ->and($history->first())->toHaveKeys(['ip', 'correlation']);
});

it('la reserva directa muestra en la ficha del producto el mínimo de pasajeros y la edad mínima', function () {
    actingAsSeed('U01');

    $product = collect($this->getJson('/api/v1/reservations/form-options')->assertOk()->json('data.products'))->first();

    expect($product)->toHaveKeys(['min_pax', 'max_pax', 'min_age'])
        ->and($product['min_pax'])->toBeGreaterThanOrEqual(1);
});
