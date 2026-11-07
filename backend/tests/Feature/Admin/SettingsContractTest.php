<?php

use Illuminate\Support\Facades\DB;

function settingsVersion(string $section): int
{
    return (int) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', $section)->value('lock_version'));
}

it('GET settings devuelve todas las secciones con su lock_version', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/settings')->assertOk()->json('data');

    expect($data['sections'])->toHaveKeys(['general', 'currency', 'policies', 'operations', 'channels'])
        ->and($data['sections']['policies'])->toHaveKey('lock_version');
});

it('PATCH settings/{section} guarda solo lo cambiado y respeta If-Match', function () {
    actingAsSeed('U01');
    $policies = $this->getJson('/api/v1/settings')->json('data.sections.policies.values');
    $version = settingsVersion('policies');
    $body = [...$policies, 'quote_validity_days' => ((int) $policies['quote_validity_days']) === 15 ? 20 : 15];

    expect($this->patchJson('/api/v1/settings/policies', $body, ['If-Match' => (string) ($version + 5)]))->toBeApiError(409, 'STALE_VERSION');

    $response = $this->patchJson('/api/v1/settings/policies', $body, ['If-Match' => (string) $version])->assertOk();
    expect($response->json('data.changed'))->toBe(['quote_validity_days'])
        ->and($response->json('data.lock_version'))->toBeGreaterThan($version);
    expect($this->patchJson('/api/v1/settings/policies', $body, ['If-Match' => (string) settingsVersion('policies')]))->toBeApiError(422, 'CFG-BR-01');
});

it('T-16: la moneda base no cambia si ya hay reservas o pagos', function () {
    actingAsSeed('U01');
    $currency = $this->getJson('/api/v1/settings')->json('data.sections.currency.values');

    expect($this->patchJson('/api/v1/settings/currency', [...$currency, 'base_currency' => ($currency['base_currency'] ?? 'PEN') === 'PEN' ? 'USD' : 'PEN'], ['If-Match' => (string) settingsVersion('currency')]))->toBeApiError(409, 'CFG-BR-05');
});

it('settings/sequences lista las series con el próximo documento', function () {
    actingAsSeed('U01');

    $response = $this->getJson('/api/v1/settings/sequences?page[size]=2')->assertOk();

    expect($response->json('data'))->toHaveCount(2)
        ->and($response->json('data.0'))->toHaveKeys(['id', 'doc_type', 'prefix', 'next_number', 'next_document'])
        ->and($response->json('meta.next_cursor'))->not->toBeNull();
    $this->getJson('/api/v1/settings/sequences?page[cursor]='.$response->json('meta.next_cursor').'&page[size]=2')->assertOk()->assertJsonCount(2, 'data');
});

it('T-15: PATCH settings/sequences en lote solo avanza el correlativo', function () {
    actingAsSeed('U01');
    $quote = withinTenant(tenantA(), fn () => DB::table('sys_sequences')->where('doc_type', 'quote')->where('series', 'default')->first());

    expect($this->patchJson('/api/v1/settings/sequences', ['sequences' => [['doc_type' => 'quote', 'prefix' => $quote->prefix, 'next_number' => $quote->next_number - 1]]]))->toBeApiError(422, 'CFG-BR-07');

    $this->patchJson('/api/v1/settings/sequences', ['sequences' => [['doc_type' => 'quote', 'prefix' => $quote->prefix, 'next_number' => $quote->next_number + 10]]])
        ->assertOk()->assertJsonPath('meta.changed', ['quote']);
    expect((int) withinTenant(tenantA(), fn () => DB::table('sys_sequences')->where('doc_type', 'quote')->where('series', 'default')->value('next_number')))->toBe($quote->next_number + 10);
});

it('POST settings/sequences agrega una serie nueva solo para tipos permitidos', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/settings/sequences', ['doc_type' => 'credit_note', 'prefix' => 'FC01-', 'next_number' => 1])->assertCreated()->assertJsonPath('data.label', 'Nota de crédito');
    expect($this->postJson('/api/v1/settings/sequences', ['doc_type' => 'credit_note', 'prefix' => 'FC02-']))->toBeApiError(409, 'CFG-BR-08');
    expect($this->postJson('/api/v1/settings/sequences', ['doc_type' => 'quote', 'prefix' => 'COTX-']))->toBeApiError(422, 'CFG-BR-08');
});

it('settings/fx-rates lo ven configuración y tesorería; ventas no', function () {
    actingAsSeed('U07');
    $data = $this->getJson('/api/v1/settings/fx-rates')->assertOk()->json('data');

    expect($data)->not->toBeEmpty()
        ->and($data[0])->toHaveKeys(['rate_date', 'from_currency', 'to_currency', 'rate', 'source']);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/settings/fx-rates'))->toBeApiError(403);
});

it('las rutas de configuración exigen admin.settings.manage', function (string $method, string $uri) {
    actingAsSeed('U02');

    $response = $this->json($method, $uri);
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('admin.settings.manage');
})->with([
    ['GET', '/api/v1/settings'],
    ['GET', '/api/v1/settings/sequences'],
    ['POST', '/api/v1/settings/sequences'],
    ['PATCH', '/api/v1/settings/sequences'],
]);
