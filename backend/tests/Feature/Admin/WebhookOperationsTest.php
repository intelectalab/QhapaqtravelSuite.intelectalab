<?php

use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function whGancho(): string
{
    $code = (string) withinTenant(tenantA(), fn () => DB::table('integration_webhooks')->where('status', 'active')->orderBy('code')->value('code'));
    withinTenant(tenantA(), fn () => DB::table('integration_webhooks')->where('code', $code)->update(['url' => 'https://93.184.216.34/hooks', 'secret_encrypted' => Crypt::encryptString('whsec_original_secret_value_123456'), 'consecutive_failures' => 0]));

    return $code;
}

it('rotar el secreto conserva el anterior 24 h y el ping llega firmado con ambos', function () {
    Http::fake(['93.184.216.34/*' => Http::response(['ok' => true], 200)]);
    actingAsSeed('U01');
    $code = whGancho();

    $rotated = $this->postJson("/api/v1/integrations/webhooks/{$code}/rotate-secret", [], critical())->assertOk()->json('data');
    $hook = rowOf('integration_webhooks', $code);

    expect($rotated['secret'])->toStartWith('whsec_')
        ->and(Crypt::decryptString((string) $hook->previous_secret_encrypted))->toBe('whsec_original_secret_value_123456')
        ->and(now()->diffInHours(Carbon::parse((string) $hook->previous_secret_expires_at)) >= 23)->toBeTrue();

    $ping = $this->postJson("/api/v1/integrations/webhooks/{$code}/ping", [], critical())->assertOk()->json('data');

    expect($ping['status'])->toBe('delivered')->and($ping['http'])->toBe(200);
    Http::assertSent(function (ClientRequest $request) use ($rotated): bool {
        $header = $request->header('KipuControl-Signature')[0] ?? '';
        preg_match('/t=(\d+)/', $header, $time);
        $expected = hash_hmac('sha256', $time[1].'.'.$request->body(), $rotated['secret']);
        $previous = hash_hmac('sha256', $time[1].'.'.$request->body(), 'whsec_original_secret_value_123456');

        return str_contains($header, "v1={$expected}") && str_contains($header, "v1={$previous}") && $request->header('KipuControl-Event-Type')[0] === 'ping';
    });
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Webhook')->where('entity_id', $code)->whereIn('action', ['rotar_secreto', 'ping'])->count()))->toBe(2);
});

it('el detalle de una entrega muestra el cuerpo y reenviarla crea una entrega manual', function () {
    Http::fake(['93.184.216.34/*' => Http::response('caído', 503)]);
    actingAsSeed('U01');
    $code = whGancho();
    $hookId = rowOf('integration_webhooks', $code)->id;
    $original = (string) withinTenant(tenantA(), fn () => DB::table('integration_webhook_deliveries')->where('webhook_id', $hookId)->orderByDesc('created_at')->value('code'));

    $detail = $this->getJson("/api/v1/integrations/webhook-deliveries/{$original}")->assertOk()->json('data');
    expect($detail['payload'])->toHaveKey('type')->and($detail['headers'])->toHaveKey('KipuControl-Signature');

    $resent = $this->postJson("/api/v1/integrations/webhook-deliveries/{$original}/redeliver", [], critical())->assertCreated()->json('data');
    $row = rowOf('integration_webhook_deliveries', $resent['code']);

    expect($resent['status'])->toBe('failed')
        ->and($row->manual)->toBeTrue()
        ->and($row->event_id)->toBe($detail['event_id'])
        ->and((int) rowOf('integration_webhooks', $code)->consecutive_failures)->toBe(1);
});

it('un webhook pausado no recibe ping y solo la administración de la API opera los webhooks', function () {
    actingAsSeed('U01');
    $code = whGancho();
    withinTenant(tenantA(), fn () => DB::table('integration_webhooks')->where('code', $code)->update(['status' => 'paused']));

    expect($this->postJson("/api/v1/integrations/webhooks/{$code}/ping", [], critical()))->toBeApiError(422, 'API-BR-07');

    actingAsSeed('U02');
    expect($this->postJson("/api/v1/integrations/webhooks/{$code}/rotate-secret", [], critical()))->toBeApiError(403);
});
