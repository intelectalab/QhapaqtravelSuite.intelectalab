<?php

use Illuminate\Support\Facades\DB;

function fillDepartureOf(string $quoteCode, int $line): object
{
    lockCatalogProducts();

    return withinTenant(tenantA(), function () use ($quoteCode, $line) {
        $item = DB::table('quote_quotes as q')->join('quote_items as i', 'i.quote_version_id', '=', 'q.current_version_id')->where('q.code', $quoteCode)->where('i.line_no', $line)->first(['i.product_id', 'i.service_date']);
        DB::table('catalog_product_departures')->where('product_id', $item->product_id)->where('departure_date', $item->service_date)->update(['sold' => DB::raw('capacity')]);

        return $item;
    });
}

it('PROC-025: la vista previa muestra las 9 precondiciones y la disponibilidad por ítem', function () {
    $quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U03');

    $data = $this->getJson("/api/v1/quotes/{$quote->code}/conversion-preview")->assertOk()->json('data');
    $items = collect($data['items'])->keyBy('line');

    expect(array_column($data['checks'], 'key'))->toBe(['approved', 'version', 'services', 'passengers', 'dates', 'prices', 'currency', 'conditions', 'client'])
        ->and(collect($data['checks'])->every(fn (array $check): bool => $check['ok']))->toBeTrue()
        ->and($data['ready'])->toBeTrue()
        ->and($data['blocked'])->toBeFalse()
        ->and($data['can_convert'])->toBeTrue()
        ->and($data['version'])->toBe((int) $quote->current_version_no)
        ->and($items[1]['status'])->toBe('proveedor')
        ->and($items[2]['status'])->toBe('disponible')
        ->and($items[2]['departure'])->toStartWith('SAL-')
        ->and($items[2]['alternatives'])->toBe([]);
});

it('RT-4: sin cupo la vista previa bloquea y ofrece salidas alternativas con cupo', function () {
    $quote = approvedQuote('COT-2026-00188');
    $item = fillDepartureOf($quote->code, 2);
    actingAsSeed('U03');

    $data = $this->getJson("/api/v1/quotes/{$quote->code}/conversion-preview")->assertOk()->json('data');
    $blocked = collect($data['items'])->firstWhere('line', 2);

    expect($data['blocked'])->toBeTrue()
        ->and($data['can_convert'])->toBeFalse()
        ->and($blocked['status'])->toBe('bloqueado')
        ->and($blocked['alternatives'])->not->toBeEmpty()
        ->and(collect($blocked['alternatives'])->pluck('date'))->not->toContain($item->service_date)
        ->and(collect($blocked['alternatives'])->every(fn (array $row): bool => $row['free'] >= 2))->toBeTrue();
});

it('QTE-BR-18: «Crear versión con fecha alternativa» mueve la línea, deja la versión en borrador y pide nueva aprobación', function () {
    $quote = approvedQuote('COT-2026-00188');
    fillDepartureOf($quote->code, 2);
    actingAsSeed('U03');
    $alternative = collect($this->getJson("/api/v1/quotes/{$quote->code}/conversion-preview")->json('data.items'))->firstWhere('line', 2)['alternatives'][0]['date'];

    $version = $this->postJson("/api/v1/quotes/{$quote->code}/versions", ['dates' => [['line' => 2, 'date' => $alternative]], 'lock_version' => (int) $quote->lock_version])->assertOk()->json('data.version');
    $after = rowOf('quote_quotes', $quote->code);
    $line = withinTenant(tenantA(), fn () => DB::table('quote_items')->where('quote_version_id', $after->current_version_id)->where('line_no', 2)->first());
    $audit = withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Cotización')->where('entity_id', $quote->code)->where('action', 'editar_version')->latest('occurred_at')->value('after_value'));

    expect($version)->toBe((int) $quote->current_version_no + 1)
        ->and($after->status)->toBe('borrador')
        ->and($after->approved_at)->toBeNull()
        ->and((string) $line->service_date)->toBe($alternative)
        ->and((string) $after->travel_to >= $alternative)->toBeTrue()
        ->and($audit)->toContain('fecha alternativa');

    expect($this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $after->lock_version, idem('conv'))))->toBeApiError(409, 'RT-3');
});

it('QTE-BR-06: la fecha alternativa no puede ser pasada ni de una línea que no existe', function () {
    $quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U03');

    expect($this->postJson("/api/v1/quotes/{$quote->code}/versions", ['dates' => [['line' => 2, 'date' => '2026-01-10']], 'lock_version' => (int) $quote->lock_version]))->toBeApiError(422, 'QTE-BR-06')
        ->and($this->postJson("/api/v1/quotes/{$quote->code}/versions", ['dates' => [['line' => 9, 'date' => '2026-12-01']], 'lock_version' => (int) $quote->lock_version]))->toBeApiError(422, 'QTE-BR-06')
        ->and((int) rowOf('quote_quotes', $quote->code)->current_version_no)->toBe((int) $quote->current_version_no);
});

it('RT-3: un cliente dado de baja deja la precondición en rojo y la conversión se rechaza', function () {
    $quote = approvedQuote('COT-2026-00188');
    withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $quote->client_id)->update(['deleted_at' => now()]));
    actingAsSeed('U03');

    $data = $this->getJson("/api/v1/quotes/{$quote->code}/conversion-preview")->assertOk()->json('data');

    expect(collect($data['checks'])->firstWhere('key', 'client')['ok'])->toBeFalse()
        ->and($data['can_convert'])->toBeFalse()
        ->and($this->postJson("/api/v1/quotes/{$quote->code}/convert", [], critical((int) $quote->lock_version, idem('conv'))))->toBeApiError(422, 'RT-3');
});
