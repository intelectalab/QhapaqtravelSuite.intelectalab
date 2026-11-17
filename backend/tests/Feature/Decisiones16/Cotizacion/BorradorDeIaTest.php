<?php

use App\Domain\Quotes\Actions\QuoteAccessTokens;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function o11QuoteIn(array $statuses): object
{
    return withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->whereIn('status', $statuses)->whereNotNull('current_version_id')->orderBy('code')->first(['id', 'code', 'status', 'current_version_no', 'current_version_id', 'valid_until']));
}

function o11Draft(object $test, string $code): string
{
    return (string) $test->postJson('/api/v1/ai/requests', ['kind' => 'quote_draft', 'prompt' => 'Propuesta de 3 días en Cusco para 2 adultos', 'source_type' => 'quote', 'source_code' => $code], critical())
        ->assertStatus(202)->json('data.id');
}

function o11Token(object $quote): string
{
    $plain = 'andes.'.hash('sha256', Str::uuid()->toString());
    withinTenant(tenantA(), function () use ($quote, $plain) {
        DB::table('quote_access_tokens')->where('quote_id', $quote->id)->update(['revoked_at' => now()]);
        DB::table('quote_access_tokens')->insert(['quote_id' => $quote->id, 'token_hash' => QuoteAccessTokens::hash($plain), 'expires_at' => '2027-12-31']);
        DB::table('quote_quotes')->where('id', $quote->id)->update(['valid_until' => '2027-12-31']);
    });

    return $plain;
}

it('O11: en una cotización vista pide confirmar, crea la versión nueva en borrador y el cliente sigue viendo la anterior', function () {
    actingAsSeed('U01');
    $quote = o11QuoteIn(['vista', 'enviada', 'negociacion']);
    $id = o11Draft($this, $quote->code);
    $next = (int) $quote->current_version_no + 1;

    $this->getJson("/api/v1/ai/requests/{$id}")->assertOk()
        ->assertJsonPath('data.apply_impact.level', 'warning')
        ->assertJsonPath('data.apply_impact.new_version', $next);

    $response = $this->postJson("/api/v1/ai/requests/{$id}/apply", [], critical());
    expect($response)->toBeApiError(409, 'AI_APPLY_CONFIRM');
    expect($response->json('message'))->toContain("crea la v{$next} en borrador");
    expect(rowOf('quote_quotes', $quote->code)->current_version_no)->toBe($quote->current_version_no);

    $this->postJson("/api/v1/ai/requests/{$id}/apply", ['confirm' => true], critical())->assertOk()
        ->assertJsonPath('data.applied.version_no', $next)
        ->assertJsonPath('data.applied.impact.level', 'warning');

    $after = rowOf('quote_quotes', $quote->code);
    expect($after->status)->toBe('borrador')
        ->and((int) $after->current_version_no)->toBe($next);

    $public = $this->getJson('/api/v1/public/quotes/'.o11Token($quote))->assertOk();
    expect($public->json('data.version'))->toBe((int) $quote->current_version_no)
        ->and($public->json('data.status'))->toBe('actualizando');
});

it('O11: en una cotización aprobada exige el segundo clic que anula la aprobación', function () {
    actingAsSeed('U01');
    $quote = o11QuoteIn(['vista', 'enviada', 'negociacion']);
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => 'aprobada', 'approved_at' => '2026-09-28 21:05:00+00', 'approved_by_name' => 'Cliente']));
    $id = o11Draft($this, $quote->code);

    $this->getJson("/api/v1/ai/requests/{$id}")->assertOk()->assertJsonPath('data.apply_impact.level', 'danger');

    $response = $this->postJson("/api/v1/ai/requests/{$id}/apply", ['confirm' => true], critical());
    expect($response)->toBeApiError(409, 'AI_APPLY_CONFIRM');
    expect($response->json('message'))->toContain('Se anulará la aprobación del cliente del 28/09/2026');
    expect(rowOf('quote_quotes', $quote->code)->status)->toBe('aprobada');

    $this->postJson("/api/v1/ai/requests/{$id}/apply", ['confirm' => true, 'void_approval' => true], critical())->assertOk();

    $after = rowOf('quote_quotes', $quote->code);
    expect($after->status)->toBe('borrador')
        ->and($after->approved_at)->toBeNull();
});

it('O11: en borrador se anota sin confirmación y en convertida queda bloqueado', function () {
    actingAsSeed('U01');
    $draft = o11QuoteIn(['borrador']);
    $id = o11Draft($this, $draft->code);
    $this->getJson("/api/v1/ai/requests/{$id}")->assertOk()->assertJsonPath('data.apply_impact', null);
    $this->postJson("/api/v1/ai/requests/{$id}/apply", [], critical())->assertOk()->assertJsonPath('data.applied.impact', null);

    $quote = o11QuoteIn(['vista', 'enviada', 'negociacion']);
    $converted = o11Draft($this, $quote->code);
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => 'convertida']));

    expect($this->postJson("/api/v1/ai/requests/{$converted}/apply", ['confirm' => true, 'void_approval' => true], critical()))->toBeApiError(409, 'QTE-BR-18');
});
