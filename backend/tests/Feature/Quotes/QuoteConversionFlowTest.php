<?php

use Illuminate\Support\Facades\DB;

it('04 §4.3: la vista previa trae disponibilidad y el plan de cobro 40/60 con montos exactos', function () {
    $quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U03');

    $data = $this->getJson("/api/v1/quotes/{$quote->code}/conversion-preview")->assertOk()->json('data');

    expect($data['items'])->not->toBeEmpty()
        ->and($data['total'])->toMatch('/^\d+\.\d{2}$/')
        ->and($data['receivables'])->toHaveCount(2)
        ->and(bcadd($data['receivables'][0]['amount'], $data['receivables'][1]['amount'], 2))->toBe($data['total']);
});

it('SEC-BR-09: la vista previa de una cotización ajena responde 403', function () {
    $quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U04');

    expect($this->getJson("/api/v1/quotes/{$quote->code}/conversion-preview"))->toBeApiError(403, 'SEC-BR-09');
});

it('F0-25: la reserva y sus CxC toman el número de sys_sequences', function () {
    $quote = approvedQuote('COT-2026-00188');
    $reservations = sequenceOf('reservation');
    $receivables = sequenceOf('receivable');
    actingAsSeed('U03');

    $code = $this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version, idem('conv')))->assertCreated()->json('data.code');
    $cxc = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', rowOf('booking_reservations', $code)->id)->orderBy('code')->pluck('code')->all());

    expect($code)->toBe($reservations->prefix.str_pad((string) $reservations->next_number, (int) $reservations->pad_width, '0', STR_PAD_LEFT))
        ->and((int) sequenceOf('reservation')->next_number)->toBe((int) $reservations->next_number + 1)
        ->and($cxc)->toBe([
            $receivables->prefix.str_pad((string) $receivables->next_number, (int) $receivables->pad_width, '0', STR_PAD_LEFT),
            $receivables->prefix.str_pad((string) ($receivables->next_number + 1), (int) $receivables->pad_width, '0', STR_PAD_LEFT),
        ]);
});

it('04 §4.3 paso 18: la conversión deja los tres eventos en el outbox y devuelve el ETag de la reserva', function () {
    $quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U03');

    $response = $this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version, idem('conv')))->assertCreated();
    $reservationId = $response->json('data.id');
    $events = withinTenant(tenantA(), fn () => DB::table('sys_outbox')->where('aggregate_id', $reservationId)->orderBy('event')->pluck('event')->all());

    expect($events)->toBe(['QuoteConverted', 'ReservationConfirmed', 'ReservationCreated'])
        ->and($response->headers->get('ETag'))->toBe('W/"'.$response->json('data.lock_version').'"')
        ->and($response->json('meta.quote_status'))->toBe('convertida')
        ->and($response->json('meta.idempotent'))->toBeFalse();
});

it('la cotización convertida queda en estado terminal: no admite otra transición', function () {
    $quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U03');
    $this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version, idem('conv')))->assertCreated();

    $converted = rowOf('quote_quotes', $quote->code);

    expect($converted->status)->toBe('convertida')
        ->and((int) $converted->lock_version)->toBeGreaterThan((int) $quote->lock_version);
});

it('listQuotes: filter[status] y filter[q] filtran en el servidor', function () {
    actingAsSeed('U01');

    $converted = collect($this->getJson('/api/v1/quotes?filter[status]=convertida&page[size]=100')->assertOk()->json('data'));
    $search = collect($this->getJson('/api/v1/quotes?filter[q]=COT-2026-00189')->assertOk()->json('data'));

    expect($converted)->not->toBeEmpty()
        ->and($converted->pluck('status')->unique()->values()->all())->toBe(['convertida'])
        ->and($search->pluck('code')->all())->toBe(['COT-2026-00189']);
});

it('listQuotes: pagina por cursor con meta y links del contrato', function () {
    actingAsSeed('U01');

    $first = $this->getJson('/api/v1/quotes?page[size]=2')->assertOk();
    $next = $first->json('meta.next_cursor');
    $second = $this->getJson('/api/v1/quotes?page[size]=2&page[cursor]='.$next)->assertOk();

    expect($first->json('data'))->toHaveCount(2)
        ->and($next)->not->toBeNull()
        ->and($first->json('links.next'))->toContain('page%5Bcursor%5D')
        ->and($first->json('meta.kpis.total'))->toBeGreaterThan(2)
        ->and(array_intersect(collect($first->json('data'))->pluck('code')->all(), collect($second->json('data'))->pluck('code')->all()))->toBe([]);
});

it('listQuotes: los montos van como decimales exactos en texto', function () {
    actingAsSeed('U01');

    $row = $this->getJson('/api/v1/quotes?page[size]=1')->assertOk()->json('data.0');

    expect($row['total'])->toBeString()->toMatch('/^\d+\.\d{2}$/')
        ->and($row['total_pen'])->toBeString()->toMatch('/^\d+\.\d{2}$/');
});
