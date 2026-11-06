<?php

use Illuminate\Support\Facades\DB;

function sendBody(): array
{
    return ['channels' => ['email'], 'channel' => 'Email', 'recipient' => 'cliente@example.com', 'message' => 'Propuesta de viaje'];
}

function setCurrentVersion(string $code, array $values): object
{
    withinTenant(tenantA(), function () use ($code, $values) {
        $versionId = DB::table('quote_quotes')->where('code', $code)->value('current_version_id');
        DB::table('quote_versions')->where('id', $versionId)->update($values);
    });

    return rowOf('quote_quotes', $code);
}

function quoteStatus(string $code): string
{
    return (string) rowOf('quote_quotes', $code)->status;
}

function quoteUpdatePayload(string $code): array
{
    $detail = test()->getJson("/api/v1/quotes/{$code}")->assertOk()->json('data');
    $version = collect($detail['versions'])->sortByDesc('number')->first();

    return [
        'client_code' => $detail['client']['code'],
        'title' => $detail['title'].' (ajuste)',
        'travel_from' => $detail['travel_from'],
        'travel_to' => $detail['travel_to'],
        'valid_until' => $detail['valid_until'],
        'currency' => $detail['currency'],
        'pax_adt' => $detail['pax']['adt'],
        'pax_chd' => $detail['pax']['chd'],
        'pax_inf' => $detail['pax']['inf'],
        'discount_pct' => $version['discount_pct'],
        'tax_pct' => $version['tax_pct'],
        'items' => collect($version['items'])->map(fn (array $item) => [
            'product_code' => $item['product']['code'],
            'date' => $item['date'],
            'qty' => $item['qty'],
            'pax' => $item['pax'],
            'segment' => $item['segment'],
            'unit_price' => $item['unit_price'],
        ])->all(),
        'lock_version' => $detail['lock_version'],
    ];
}

it('QTE-BR-12: no se envía con la aprobación interna pendiente', function () {
    actingAsSeed('U04');
    $quote = setCurrentVersion('COT-2026-00185', ['discount_pct' => 12]);

    $this->postJson('/api/v1/quotes/COT-2026-00185/internal-approval-requests', ['note' => 'Descuento por grupo grande'], critical())->assertSuccessful();

    expect($this->postJson('/api/v1/quotes/COT-2026-00185/send', sendBody(), critical((int) rowOf('quote_quotes', 'COT-2026-00185')->lock_version)))
        ->toBeApiError(409, 'QTE-BR-12');
    expect(quoteStatus('COT-2026-00185'))->toBe('borrador');
});

it('T-Q07: margen menor a 15 % bloquea el envío hasta que Gerencia aprueba', function () {
    actingAsSeed('U03');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/send', sendBody(), critical((int) rowOf('quote_quotes', 'COT-2026-00189')->lock_version)))
        ->toBeApiError(409, 'QTE-BR-12');
    expect($this->getJson('/api/v1/quotes/COT-2026-00189')->assertOk()->json('data.internal'))->toMatchArray(['required' => true, 'status' => 'pendiente']);

    actingAsSeed('U02');
    $this->postJson('/api/v1/quotes/COT-2026-00189/internal-approval', ['approve' => true, 'note' => 'Aprobado'], critical())->assertSuccessful();

    actingAsSeed('U03');
    $this->postJson('/api/v1/quotes/COT-2026-00189/send', sendBody(), critical((int) rowOf('quote_quotes', 'COT-2026-00189')->lock_version))->assertSuccessful();

    expect(quoteStatus('COT-2026-00189'))->toBe('enviada');
});

it('QTE-BR-10: editar el borrador anula la aprobación interna y vuelve a bloquear el envío', function () {
    actingAsSeed('U02');
    $this->postJson('/api/v1/quotes/COT-2026-00189/internal-approval', ['approve' => true, 'note' => 'Aprobado'], critical())->assertSuccessful();

    actingAsSeed('U03');
    $payload = quoteUpdatePayload('COT-2026-00189');
    $this->putJson('/api/v1/quotes/COT-2026-00189', $payload, critical((int) $payload['lock_version']))->assertSuccessful();

    expect($this->getJson('/api/v1/quotes/COT-2026-00189')->assertOk()->json('data.internal.status'))->not->toBe('aprobada');
    expect($this->postJson('/api/v1/quotes/COT-2026-00189/send', sendBody(), critical((int) rowOf('quote_quotes', 'COT-2026-00189')->lock_version)))
        ->toBeApiError(409, 'QTE-BR-12');
});

it('QTE-BR-13: no se registra la aprobación del cliente con la aprobación interna pendiente', function () {
    setCurrentVersion('COT-2026-00188', ['discount_pct' => 12]);
    actingAsSeed('U03');

    $response = $this->postJson('/api/v1/quotes/COT-2026-00188/approve', ['approved_by_name' => 'Gabriela Ríos', 'channel' => 'email'], critical((int) rowOf('quote_quotes', 'COT-2026-00188')->lock_version));

    expect($response)->toBeApiError(409, 'QTE-BR-13');
    expect(quoteStatus('COT-2026-00188'))->toBe('enviada');
});

it('H-04: el cliente no aprueba desde el portal mientras la aprobación interna está pendiente', function () {
    requireRoute('POST', '/api/v1/portal/client/quotes/COT-2026-00188/approve');
    $customer = seedUser('U14');
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00188')->update(['client_id' => $customer->client_id]));
    setCurrentVersion('COT-2026-00188', ['discount_pct' => 12]);
    actingAsSeed('U14');

    $response = $this->postJson('/api/v1/portal/client/quotes/COT-2026-00188/approve', [
        'approver_name' => 'Gabriela Ríos Montoya', 'accept_terms' => true, 'name' => 'Gabriela Ríos Montoya', 'accept' => true,
    ], critical((int) rowOf('quote_quotes', 'COT-2026-00188')->lock_version));

    expect($response)->toBeApiError(409);
    expect($response->json('code'))->toBeIn(['QTE-BR-13', 'H-04']);
});

it('H-04 en la ruta actual del portal: el cliente no aprueba con la aprobación interna pendiente', function () {
    $customer = seedUser('U14');
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00188')->update(['client_id' => $customer->client_id]));
    setCurrentVersion('COT-2026-00188', ['discount_pct' => 12]);
    actingAsSeed('U14');

    $response = $this->postJson('/api/v1/portal/quotes/COT-2026-00188/approve', ['name' => 'Gabriela Ríos Montoya', 'accept' => true], critical((int) rowOf('quote_quotes', 'COT-2026-00188')->lock_version));

    expect($response)->toBeApiError(409);
    expect($response->json('code'))->toBeIn(['QTE-BR-13', 'H-04']);
    expect(quoteStatus('COT-2026-00188'))->toBe('enviada');
});

it('QTE-BR-16: no se aprueba una cotización vencida', function (string $code) {
    actingAsSeed('U02');

    expect($this->postJson("/api/v1/quotes/{$code}/approve", ['approved_by_name' => 'X', 'channel' => 'email'], critical((int) rowOf('quote_quotes', $code)->lock_version)))
        ->toBeApiError(409, 'QTE-BR-16');
})->with([
    'estado vencida' => 'COT-2026-00182',
    'enviada con validez pasada' => function () {
        withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00188')->update(['valid_until' => '2026-09-28']));

        return 'COT-2026-00188';
    },
]);

it('QTE-BR-17: rechazar exige motivo y registra el estado', function () {
    actingAsSeed('U04');
    $lock = (int) rowOf('quote_quotes', 'COT-2026-00190')->lock_version;

    $this->postJson('/api/v1/quotes/COT-2026-00190/reject', [], critical($lock))->assertUnprocessable()->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/quotes/COT-2026-00190/reject', ['reason' => 'Presupuesto'], critical($lock))->assertSuccessful();

    expect(quoteStatus('COT-2026-00190'))->toBe('rechazada');
});

it('If-Match desactualizado responde 409 STALE_VERSION y no cambia el estado', function () {
    actingAsSeed('U04');
    $lock = (int) rowOf('quote_quotes', 'COT-2026-00190')->lock_version;

    expect($this->postJson('/api/v1/quotes/COT-2026-00190/reject', ['reason' => 'Presupuesto'], critical($lock - 1)))
        ->toBeApiError(409, 'STALE_VERSION');
    expect(quoteStatus('COT-2026-00190'))->toBe('vista');
});

it('rechaza por API las transiciones fuera del grafo de 03 §4.1', function (string $user, string $code, string $action, array $body, string $rule) {
    actingAsSeed($user);

    expect($this->postJson("/api/v1/quotes/{$code}/{$action}", $body, critical((int) rowOf('quote_quotes', $code)->lock_version)))
        ->toBeApiError(409, $rule);
})->with([
    'aprobar un borrador' => ['U01', 'COT-2026-00189', 'approve', ['approved_by_name' => 'X', 'channel' => 'email'], 'QTE-BR-21'],
    'rechazar un borrador' => ['U01', 'COT-2026-00189', 'reject', ['reason' => 'Sin interés'], 'QTE-BR-17'],
    'aprobar una rechazada' => ['U01', 'COT-2026-00184', 'approve', ['approved_by_name' => 'X', 'channel' => 'email'], 'QTE-BR-21'],
    'nueva versión de una convertida' => ['U01', 'COT-2026-00183', 'versions', [], 'QTE-BR-18'],
    'enviar una convertida' => ['U01', 'COT-2026-00183', 'send', sendBody(), 'QTE-BR-23'],
]);

it('JOB-02 vence cotizaciones con validez pasada y audita como Sistema', function () {})->todo('Fase B: no existe App\Domain\Quotes\Jobs\ExpireQuotes (JOB-02, 03 §4.1). Hoy el estado vencida solo se calcula al leer.');
