<?php

use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('el detalle de la cotización trae seguimiento, aprobación interna, actividades, itinerario y datos por versión', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/quotes/COT-2026-00190')->assertOk()->json('data');

    expect($data)->toHaveKeys(['approval', 'internal_detail', 'timeline', 'activities', 'itinerary', 'approval_rules'])
        ->and($data['approval_rules'])->toBe(['discount_limit' => '5', 'margin_floor' => '15', 'max_discount' => '10'])
        ->and($data['versions'][0])->toHaveKeys(['conditions', 'markup_pct', 'fx_rate', 'frozen_at', 'internal_status', 'item_count', 'seasons'])
        ->and($data['itinerary'])->toBeArray();
});

it('createQuotesViews registra la vista manual y aparece en la línea de tiempo', function () {
    freezeBusinessToday();
    actingAsSeed('U01');

    $this->postJson('/api/v1/quotes/COT-2026-00190/views', ['note' => 'El cliente confirmó por teléfono que la revisó'])->assertCreated();

    $timeline = collect($this->getJson('/api/v1/quotes/COT-2026-00190')->json('data.timeline'));
    $actions = collect($this->getJson('/api/v1/quotes/COT-2026-00190/activity')->json('data'))->pluck('action');

    expect($timeline->where('kind', 'vista')->where('channel', 'Registro manual')->count())->toBe(1)
        ->and($timeline->pluck('kind'))->toContain('envio')
        ->and($actions)->toContain('registrar_vista');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/views'))->toBeApiError(409, 'QTE-BR-16');
});

it('createQuotesViews respeta la cartera y el permiso de envío', function () {
    freezeBusinessToday();
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/quotes/COT-2026-00190/views'))->toBeApiError(403);
});
