<?php

use App\Domain\Integrations\Fake\FakePaymentGateway;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

function crecALink(string $receivable = 'CXC-00714', array $extra = []): array
{
    actingAsSeed('U07');

    return test()->postJson('/api/v1/finance/payment-links', ['receivable_id' => $receivable, 'amount' => '100.00', 'methods' => ['card', 'yape'], 'installments_max' => 3, ...$extra], critical())->assertCreated()->json('data');
}

function crecALinkAudited(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function crecAToken(array $link): string
{
    return (string) substr((string) $link['url'], strrpos((string) $link['url'], '/') + 1);
}

function crecAWebhook(array $event): TestResponse
{
    $raw = json_encode($event);

    return test()->call('POST', '/api/v1/webhooks/payments/sandbox', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_GATEWAY_SIGNATURE' => FakePaymentGateway::sign($raw)], $raw);
}

it('POST /finance/payment-links crea el link con código LPG, token con hash y queda auditado', function () {
    $link = crecALink();

    expect($link['code'])->toStartWith('LPG-')
        ->and($link['status'])->toBe('activo')
        ->and($link['amount'])->toBe('100.00')
        ->and($link['currency'])->toBe('USD')
        ->and($link['methods'])->toBe(['card', 'yape'])
        ->and($link['installments_max'])->toBe(3)
        ->and($link['url'])->toContain('/pagar/');

    $row = rowOf('fin_payment_links', $link['code']);
    expect($row->token_hash)->toBe(hash('sha256', crecAToken($link)))
        ->and(crecALinkAudited(['entity' => 'Link de pago', 'entity_id' => $link['code'], 'action' => 'crear']))->toBeTrue();
});

it('SC-06: un link por más del saldo pendiente responde 422 AMOUNT_EXCEEDS_BALANCE', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/finance/payment-links', ['receivable_id' => 'CXC-00714', 'amount' => '99999.00', 'methods' => ['card']], critical()))->toBeApiError(422, 'AMOUNT_EXCEEDS_BALANCE');
    expect($this->postJson('/api/v1/finance/payment-links', ['methods' => ['card']], critical()))->toBeApiError(422);
    expect($this->postJson('/api/v1/finance/payment-links', ['receivable_id' => 'CXC-00714', 'methods' => ['bitcoin']], critical()))->toBeApiError(422);
});

it('GET /finance/payment-links lista con KPIs por estado y filtra por estado', function () {
    $link = crecALink();

    $page = $this->getJson('/api/v1/finance/payment-links?filter[status]=activo&include=targets')->assertOk()->json();

    expect(collect($page['data'])->pluck('code'))->toContain($link['code'])
        ->and($page['meta']['kpis']['activo']['count'])->toBeGreaterThanOrEqual(1)
        ->and($page['meta']['targets'])->not->toBeEmpty();
    expect($this->getJson('/api/v1/finance/payment-links?filter[status]=pagado')->assertOk()->json('data'))->each(fn ($row) => $row->status->toBe('pagado'));
});

it('Ventas solo crea links de su cartera', function () {
    $foreign = withinTenant(tenantA(), function () {
        $owner = DB::table('iam_users')->where('code', 'U04')->value('id');

        return DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->whereIn('f.status', ['abierta', 'parcial', 'vencida'])->where('r.owner_id', '<>', $owner)->value('f.code');
    });
    actingAsSeed('U04');

    expect($this->postJson('/api/v1/finance/payment-links', ['receivable_id' => $foreign, 'methods' => ['card']], critical()))->toBeApiError(403, 'SEC-BR-09');
});

it('POST /send registra el canal y POST /cancel exige If-Match y anula el link', function () {
    $link = crecALink();

    $sent = $this->postJson("/api/v1/finance/payment-links/{$link['code']}/send", ['via' => 'email', 'to' => 'cliente@example.com'])->assertOk()->json('data');
    expect($sent['sent_via'])->toBe('email')
        ->and(crecALinkAudited(['entity' => 'Link de pago', 'entity_id' => $link['code'], 'action' => 'enviar']))->toBeTrue();

    expect($this->postJson("/api/v1/finance/payment-links/{$link['code']}/cancel", ['reason' => 'Cliente pagó en oficina']))->toBeApiError(428);

    $version = (int) rowOf('fin_payment_links', $link['code'])->lock_version;
    $this->postJson("/api/v1/finance/payment-links/{$link['code']}/cancel", ['reason' => 'Cliente pagó en oficina'], critical($version))->assertOk()->assertJsonPath('data.status', 'anulado');

    expect($this->postJson("/api/v1/finance/payment-links/{$link['code']}/send", ['via' => 'copia']))->toBeApiError(409, 'PAYMENT_LINK_NOT_ACTIVE');
});

it('GET /public/pay/{token} muestra el link y el checkout con tarjeta aplica el pago a la cuota', function () {
    $link = crecALink();
    $token = crecAToken($link);
    $before = (string) rowOf('fin_receivables', 'CXC-00714')->paid_amount;

    $view = $this->getJson("/api/v1/public/pay/{$token}", siteOf())->assertOk()->json('data');
    expect($view['code'])->toBe($link['code'])->and($view['amount'])->toBe('100.00')->and(collect($view['methods'])->pluck('key')->all())->toBe(['card', 'yape']);
    expect($this->getJson('/api/v1/public/pay/token-que-no-existe-en-ninguna-agencia', siteOf()))->toBeApiError(404);

    expect($this->postJson("/api/v1/public/pay/{$token}/checkout", ['method' => 'card', 'card_token' => 'tok_51_4242'], siteOf(extra: critical())))->toBeApiError(422, 'PAYMENT_DECLINED');

    $paid = $this->postJson("/api/v1/public/pay/{$token}/checkout", ['method' => 'card', 'card_token' => 'tok_ok_4242', 'installments' => 3], siteOf(extra: critical()))->assertOk()->json('data');
    expect($paid['result'])->toBe('aprobado')->and($paid['payment'])->toStartWith('PAG-');

    $after = (string) rowOf('fin_receivables', 'CXC-00714')->paid_amount;
    expect(BigDecimal::of($after)->minus($before)->isEqualTo('100.00'))->toBeTrue()
        ->and(rowOf('fin_payment_links', $link['code'])->status)->toBe('pagado')
        ->and(rowOf('fin_payments', $paid['payment'])->status)->toBe('aplicado');

    expect($this->postJson("/api/v1/public/pay/{$token}/checkout", ['method' => 'card', 'card_token' => 'tok_ok_4242'], siteOf(extra: critical())))->toBeApiError(409, 'PAYMENT_LINK_NOT_ACTIVE');
});

it('SC-06: el webhook de la pasarela paga el link con Yape una sola vez aunque llegue duplicado', function () {
    $link = crecALink();
    $token = crecAToken($link);

    $session = $this->postJson("/api/v1/public/pay/{$token}/checkout", ['method' => 'yape'], siteOf(extra: critical()))->assertOk()->json('data');
    expect($session['result'])->toBe('pendiente');

    $event = ['id' => 'evt_'.uniqid(), 'type' => 'payment.approved', 'data' => ['tenant_id' => (string) tenantA()->getKey(), 'reference' => $link['code'], 'scope' => 'payment_link', 'method' => 'yape', 'txn_id' => 'SBX-YAPE-001']];
    crecAWebhook($event)->assertOk()->assertJsonPath('data.result', 'aprobado');
    crecAWebhook([...$event, 'id' => 'evt_'.uniqid()])->assertOk()->assertJsonPath('data.duplicate', true);

    expect(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'SBX-YAPE-001')->count()))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'SBX-YAPE-001')->value('method')))->toBe('yape')
        ->and(crecALinkAudited(['entity' => 'Link de pago', 'entity_id' => $link['code'], 'action' => 'pagar']))->toBeTrue();
});

it('un link vencido no se paga y el checkout lo informa', function () {
    $link = crecALink();
    withinTenant(tenantA(), fn () => DB::table('fin_payment_links')->where('code', $link['code'])->update(['expires_at' => now()->subHour()]));

    expect($this->postJson('/api/v1/public/pay/'.crecAToken($link).'/checkout', ['method' => 'card', 'card_token' => 'tok_ok_4242'], siteOf(extra: critical())))->toBeApiError(409, 'PAYMENT_LINK_NOT_ACTIVE');
    $this->getJson('/api/v1/public/pay/'.crecAToken($link), siteOf())->assertOk()->assertJsonPath('data.status', 'vencido');
    expect(rowOf('fin_payment_links', $link['code'])->status)->toBe('vencido');
});
