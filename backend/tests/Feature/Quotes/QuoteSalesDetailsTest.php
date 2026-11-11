<?php

use Illuminate\Support\Facades\DB;

it('03 §11: registrar la negociación con «nueva versión» deja la cotización en borrador y anota la versión creada', function () {
    $quote = rowOf('quote_quotes', 'COT-2026-00188');
    actingAsSeed('U03');

    $this->postJson('/api/v1/quotes/COT-2026-00188/negotiations', ['channel' => 'Llamada', 'note' => 'Pide hotel 4 estrellas', 'new_version' => true, 'lock_version' => (int) $quote->lock_version])->assertOk();
    $after = rowOf('quote_quotes', 'COT-2026-00188');
    $negotiation = withinTenant(tenantA(), fn () => DB::table('quote_negotiations')->where('quote_id', $quote->id)->orderByDesc('recorded_at')->orderByDesc('created_at')->first());

    expect($after->status)->toBe('borrador')
        ->and((int) $after->current_version_no)->toBe((int) $quote->current_version_no + 1)
        ->and((int) $negotiation->created_version_no)->toBe((int) $after->current_version_no)
        ->and($negotiation->note)->toBe('Pide hotel 4 estrellas');
});

it('03 §11: sin la casilla la negociación no crea versión', function () {
    $quote = rowOf('quote_quotes', 'COT-2026-00188');
    actingAsSeed('U03');

    $this->postJson('/api/v1/quotes/COT-2026-00188/negotiations', ['channel' => 'WhatsApp', 'note' => 'Quiere bajar el total', 'new_version' => false, 'lock_version' => (int) $quote->lock_version])->assertOk();

    expect(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('negociacion')
        ->and((int) rowOf('quote_quotes', 'COT-2026-00188')->current_version_no)->toBe((int) $quote->current_version_no);
});

it('la lista busca por oportunidad y la ficha trae la etapa de la oportunidad', function () {
    actingAsSeed('U01');
    $detail = $this->getJson('/api/v1/quotes/COT-2026-00188')->assertOk()->json('data');
    $opportunity = $detail['opportunity'];

    $found = collect($this->getJson('/api/v1/quotes?filter[q]='.urlencode($opportunity['code']))->assertOk()->json('data'))->pluck('code');

    expect($opportunity['stage'])->toBeString()->not->toBeEmpty()
        ->and($found)->toContain('COT-2026-00188')
        ->and(collect($this->getJson('/api/v1/quotes?page[size]=100')->json('data'))->firstWhere('code', 'COT-2026-00188')['opportunity']['code'])->toBe($opportunity['code']);
});

it('PROC-063: la actividad de la cotización muestra la IP y la correlación de cada evento', function () {
    $quote = rowOf('quote_quotes', 'COT-2026-00188');
    actingAsSeed('U03');
    $this->postJson('/api/v1/quotes/COT-2026-00188/negotiations', ['channel' => 'Email', 'note' => 'Consulta por fechas', 'lock_version' => (int) $quote->lock_version])->assertOk();

    $event = collect($this->getJson('/api/v1/quotes/COT-2026-00188/activity')->assertOk()->json('data'))->firstWhere('action', 'negociacion');

    expect($event)->toHaveKeys(['ip', 'correlation'])
        ->and($event['ip'])->not->toBeNull();
});
