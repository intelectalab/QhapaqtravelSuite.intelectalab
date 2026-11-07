<?php

use Illuminate\Support\Facades\DB;

function quoteRow(string $code): object
{
    return rowOf('quote_quotes', $code);
}

it('listQuotesVersions y showQuotesVersions devuelven el historial y una versión', function () {
    actingAsSeed('U03');

    $list = $this->getJson('/api/v1/quotes/COT-2026-00189/versions')->assertOk();
    $one = $this->getJson('/api/v1/quotes/COT-2026-00189/versions/1')->assertOk()->json('data');

    expect(collect($list->json('data'))->pluck('number')->all())->toBe([2, 1])
        ->and($list->json('meta.current'))->toBe(2)
        ->and($one['number'])->toBe(1)
        ->and($one['items'])->not->toBeEmpty();
    $this->getJson('/api/v1/quotes/COT-2026-00189/versions/9')->assertNotFound();
});

it('getQuotesVersionsCompare compara por línea y resume la diferencia de total', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/quotes/COT-2026-00189/versions/compare?a=1&b=2')->assertOk()->json('data');

    expect($data['a']['number'])->toBe(1)
        ->and($data['b']['number'])->toBe(2)
        ->and($data['lines'])->not->toBeEmpty()
        ->and($data['summary']['grand_delta'])->toMatch('/^-?\d+\.\d{2}$/')
        ->and(bcsub($data['b']['totals']['grand'], $data['a']['totals']['grand'], 2))->toBe($data['summary']['grand_delta']);
    expect($this->getJson('/api/v1/quotes/COT-2026-00189/versions/compare?a=1&b=1'))->toBeApiError(422);
});

it('replaceQuotesVersions solo edita la versión vigente', function () {
    actingAsSeed('U03');
    $payload = quoteUpdatePayload('COT-2026-00189');

    expect($this->putJson('/api/v1/quotes/COT-2026-00189/versions/1', $payload, critical((int) $payload['lock_version'])))->toBeApiError(409, 'QTE-BR-10');
});

it('quotesDuplicate crea una cotización nueva v1 en borrador a nombre de quien duplica', function () {
    actingAsSeed('U02');
    $source = quoteRow('COT-2026-00186');

    $response = $this->postJson('/api/v1/quotes/COT-2026-00186/duplicate', [], critical(null, idem('dup')))->assertCreated();
    $copy = quoteRow((string) $response->json('data.code'));
    $items = withinTenant(tenantA(), fn () => DB::table('quote_items')->where('quote_version_id', $copy->current_version_id)->count());
    $sourceItems = withinTenant(tenantA(), fn () => DB::table('quote_items')->where('quote_version_id', $source->current_version_id)->count());

    expect($copy->status)->toBe('borrador')
        ->and((int) $copy->current_version_no)->toBe(1)
        ->and($copy->owner_id)->toBe(seedUser('U02')->id)
        ->and($copy->duplicated_from_id)->toBe($source->id)
        ->and($copy->client_id)->toBe($source->client_id)
        ->and($items)->toBe($sourceItems)
        ->and($copy->code)->toMatch('/^COT-2026-\d{5}$/');
});

it('quotesDuplicate exige Idempotency-Key', function () {
    actingAsSeed('U02');

    expect($this->postJson('/api/v1/quotes/COT-2026-00186/duplicate'))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
});

it('quotesReassign cambia el asesor, exige versión y no está disponible para Ventas', function () {
    $u04 = seedUser('U04');
    actingAsSeed('U03');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/reassign', ['owner_id' => $u04->id], critical((int) quoteRow('COT-2026-00189')->lock_version)))->toBeApiError(403);

    actingAsSeed('U02');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/reassign', ['owner_id' => $u04->id], ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    $this->postJson('/api/v1/quotes/COT-2026-00189/reassign', ['owner_id' => $u04->id, 'note' => 'Vacaciones'], critical((int) quoteRow('COT-2026-00189')->lock_version))->assertOk();

    expect(quoteRow('COT-2026-00189')->owner_id)->toBe($u04->id);
});

it('quotesVersionsInternalApproval decide sobre la versión vigente con decision approve|reject', function () {
    actingAsSeed('U02');
    $quote = quoteRow('COT-2026-00189');

    expect($this->postJson('/api/v1/quotes/COT-2026-00189/versions/1/internal-approval', ['decision' => 'approve'], critical((int) $quote->lock_version)))->toBeApiError(409, 'QTE-BR-15');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/versions/2/internal-approval', ['decision' => 'reject'], critical((int) $quote->lock_version)))->toBeApiError(422, 'QTE-BR-15');
    $this->postJson('/api/v1/quotes/COT-2026-00189/versions/2/internal-approval', ['decision' => 'approve', 'note' => 'Margen aceptado'], critical((int) $quote->lock_version))->assertOk();

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/quotes/COT-2026-00189')->json('data.internal.status'))->toBe('aprobada');
});

it('getQuotesActivity devuelve la auditoría con cursor y respeta la cartera', function () {
    actingAsSeed('U02');
    $this->postJson('/api/v1/quotes/COT-2026-00189/versions/2/internal-approval', ['decision' => 'approve', 'note' => 'Margen aceptado'], critical((int) quoteRow('COT-2026-00189')->lock_version))->assertOk();
    $page = $this->getJson('/api/v1/quotes/COT-2026-00189/activity?page[size]=2')->assertOk();

    expect(collect($page->json('data'))->pluck('action'))->toContain('aprobar_interna')
        ->and($page->json('meta'))->toHaveKey('next_cursor');

    actingAsSeed('U04');
    expect($this->getJson('/api/v1/quotes/COT-2026-00189/activity'))->toBeApiError(403, 'SEC-BR-09');
});

it('las transiciones del ciclo pasan por la máquina de estados: una cotización rechazada no se envía', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00188')->update(['status' => 'rechazada', 'rejected_at' => now(), 'rejected_reason' => 'Prueba']));

    expect($this->postJson('/api/v1/quotes/COT-2026-00188/send', sendBody(), critical((int) quoteRow('COT-2026-00188')->lock_version)))->toBeApiError(409, 'QTE-BR-23');
});
