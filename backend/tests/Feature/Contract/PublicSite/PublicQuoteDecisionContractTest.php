<?php

use App\Domain\Quotes\Actions\QuoteAccessTokens;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function ctrPubQuoteToken(string $code, ?string $clientOf = 'U14'): string
{
    $plain = 'andes.'.hash('sha256', Str::uuid()->toString());

    withinTenant(tenantA(), function () use ($code, $plain, $clientOf) {
        $quote = DB::table('quote_quotes')->where('code', $code)->first(['id', 'valid_until']);
        if ($clientOf !== null) {
            DB::table('quote_quotes')->where('id', $quote->id)->update(['client_id' => seedUser($clientOf)->client_id]);
        }
        DB::table('quote_access_tokens')->where('quote_id', $quote->id)->update(['revoked_at' => now()]);
        DB::table('quote_access_tokens')->insert(['quote_id' => $quote->id, 'token_hash' => QuoteAccessTokens::hash($plain), 'expires_at' => $quote->valid_until ?? '2026-12-31']);
    });

    return $plain;
}

beforeEach(function () {
    lockSeededBookings();
    Queue::fake();
});

it('POST /public/quotes/{token}/approve aprueba la propuesta del cliente con su nombre y su IP', function () {
    $token = ctrPubQuoteToken('COT-2026-00188');
    actingAsSeed('U14');

    $data = $this->postJson("/api/v1/public/quotes/{$token}/approve", ['name' => 'Gabriela Ríos Montoya', 'accept' => true, 'comment' => 'Conforme'], critical())->assertOk()->json('data');

    $quote = rowOf('quote_quotes', 'COT-2026-00188');
    expect($data['code'])->toBe('COT-2026-00188')
        ->and($quote->status)->toBe('aprobada')
        ->and($quote->approved_by_name)->toBe('Gabriela Ríos Montoya')
        ->and($quote->approval_ip)->not->toBeNull();
});

it('POST /public/quotes/{token}/reject registra el rechazo con su motivo', function () {
    $token = ctrPubQuoteToken('COT-2026-00188');
    actingAsSeed('U14');

    $this->postJson("/api/v1/public/quotes/{$token}/reject", ['reason' => 'Precio', 'comment' => 'Encontramos otra opción'], critical())->assertOk()->assertJsonPath('data.status', 'rechazada');

    expect(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('rechazada');
});

it('aprobar por enlace exige Idempotency-Key, un enlace vigente y que la propuesta sea del cliente', function () {
    $token = ctrPubQuoteToken('COT-2026-00188', null);
    actingAsSeed('U14');

    expect($this->postJson("/api/v1/public/quotes/{$token}/approve", ['name' => 'Gabriela Ríos Montoya', 'accept' => true]))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED')
        ->and($this->postJson("/api/v1/public/quotes/{$token}/approve", ['name' => 'Gabriela Ríos Montoya', 'accept' => true], critical()))->toBeApiError(404)
        ->and($this->postJson('/api/v1/public/quotes/andes.'.str_repeat('a', 64).'/reject', ['reason' => 'Precio', 'comment' => 'Otra opción'], critical()))->toBeApiError(404)
        ->and(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('enviada');
});

it('el personal de la agencia no aprueba por el enlace del cliente', function () {
    $token = ctrPubQuoteToken('COT-2026-00188');
    actingAsSeed('U03');

    expect($this->postJson("/api/v1/public/quotes/{$token}/approve", ['name' => 'Asesor', 'accept' => true], critical()))->toBeApiError(403);
});
