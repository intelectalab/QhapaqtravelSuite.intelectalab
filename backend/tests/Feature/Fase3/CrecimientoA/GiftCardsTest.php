<?php

use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;

function crecAGiftCard(string $amount = '300.00', string $currency = 'USD'): array
{
    actingAsSeed('U07');

    return test()->postJson('/api/v1/finance/gift-cards', ['amount' => $amount, 'currency' => $currency, 'recipient_name' => 'Ana Torres', 'recipient_email' => 'ana@example.com', 'message' => 'Feliz cumpleaños'], critical())->assertOk()->json('data');
}

function crecAGiftAudited(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('POST /finance/gift-cards emite el vale activo, muestra el código una sola vez y guarda solo su hash', function () {
    $card = crecAGiftCard();

    expect($card['code'])->toStartWith('VAL-')
        ->and($card['status'])->toBe('activa')
        ->and($card['balance'])->toBe('300.00')
        ->and($card['redeem_code'])->toMatch('/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/');

    $row = rowOf('fin_gift_cards', $card['code']);
    expect($row->redeem_code_hash)->toBe(hash('sha256', str_replace('-', '', $card['redeem_code'])))
        ->and($row->redeem_code_last4)->toBe(substr(str_replace('-', '', $card['redeem_code']), -4))
        ->and(crecAGiftAudited(['entity' => 'Vale de regalo', 'entity_id' => $card['code'], 'action' => 'emitir']))->toBeTrue();

    $detail = $this->getJson("/api/v1/finance/gift-cards/{$card['code']}")->assertOk()->json('data');
    expect($detail)->not->toHaveKey('redeem_code')
        ->and($detail['movements'][0]['kind'])->toBe('emision');
    expect(json_encode($this->getJson('/api/v1/finance/gift-cards')->assertOk()->json()))->not->toContain($card['redeem_code']);
});

it('SC-13: el canje paga la cuota, deja movimiento y no supera el saldo', function () {
    $card = crecAGiftCard('120.00');
    $before = (string) rowOf('fin_receivables', 'CXC-00714')->paid_amount;

    expect($this->postJson("/api/v1/finance/gift-cards/{$card['code']}/redeem", ['redeem_code' => $card['redeem_code'], 'amount' => '150.00', 'receivable_id' => 'CXC-00714'], critical()))->toBeApiError(422, 'GIFT_CARD_INSUFFICIENT_BALANCE');
    expect($this->postJson("/api/v1/finance/gift-cards/{$card['code']}/redeem", ['redeem_code' => 'AAAA-BBBB-CCCC-DDDD', 'amount' => '10.00', 'receivable_id' => 'CXC-00714'], critical()))->toBeApiError(422, 'GIFT_CARD_CODE_INVALID');

    $first = $this->postJson("/api/v1/finance/gift-cards/{$card['code']}/redeem", ['redeem_code' => strtolower($card['redeem_code']), 'amount' => '70.00', 'receivable_id' => 'CXC-00714'], critical())->assertOk()->json('data');
    expect($first['balance'])->toBe('50.00')->and($first['status'])->toBe('activa')->and($first['payment'])->toStartWith('PAG-');

    $second = $this->postJson("/api/v1/finance/gift-cards/{$card['code']}/redeem", ['redeem_code' => $card['redeem_code'], 'amount' => '50.00', 'receivable_id' => 'CXC-00714'], critical())->assertOk()->json('data');
    expect($second['balance'])->toBe('0.00')->and($second['status'])->toBe('agotada');

    expect(BigDecimal::of((string) rowOf('fin_receivables', 'CXC-00714')->paid_amount)->minus($before)->isEqualTo('120.00'))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_gift_card_movements')->where('gift_card_id', $card['id'])->where('kind', 'canje')->count()))->toBe(2)
        ->and(crecAGiftAudited(['entity' => 'Vale de regalo', 'entity_id' => $card['code'], 'action' => 'canjear']))->toBeTrue();

    expect($this->postJson("/api/v1/finance/gift-cards/{$card['code']}/redeem", ['redeem_code' => $card['redeem_code'], 'amount' => '1.00', 'receivable_id' => 'CXC-00714'], critical()))->toBeApiError(422, 'GIFT_CARD_NOT_ACTIVE');
});

it('SC-13: un vale vencido no se canjea', function () {
    $card = crecAGiftCard('80.00');
    withinTenant(tenantA(), fn () => DB::table('fin_gift_cards')->where('code', $card['code'])->update(['expires_at' => now()->subDays(2)->toDateString()]));

    $this->getJson('/api/v1/finance/gift-cards?filter[status]=vencida')->assertOk();
    expect(rowOf('fin_gift_cards', $card['code'])->status)->toBe('vencida');
    expect($this->postJson("/api/v1/finance/gift-cards/{$card['code']}/redeem", ['redeem_code' => $card['redeem_code'], 'amount' => '10.00', 'receivable_id' => 'CXC-00714'], critical()))->toBeApiError(422, 'GIFT_CARD_NOT_ACTIVE');
});

it('POST /void exige If-Match y devuelve el saldo solo si el vale nunca se canjeó', function () {
    $card = crecAGiftCard('90.00');

    expect($this->postJson("/api/v1/finance/gift-cards/{$card['code']}/void", ['reason' => 'Error de emisión']))->toBeApiError(428);

    $voided = $this->postJson("/api/v1/finance/gift-cards/{$card['code']}/void", ['reason' => 'Error de emisión'], critical((int) rowOf('fin_gift_cards', $card['code'])->lock_version))->assertOk()->json('data');
    expect($voided['status'])->toBe('anulada')->and($voided['refundable'])->toBeTrue()->and($voided['refundable_amount'])->toBe('90.00');

    $used = crecAGiftCard('90.00');
    $this->postJson("/api/v1/finance/gift-cards/{$used['code']}/redeem", ['redeem_code' => $used['redeem_code'], 'amount' => '10.00', 'receivable_id' => 'CXC-00714'], critical())->assertOk();
    $voidedUsed = $this->postJson("/api/v1/finance/gift-cards/{$used['code']}/void", [], critical((int) rowOf('fin_gift_cards', $used['code'])->lock_version))->assertOk()->json('data');
    expect($voidedUsed['refundable'])->toBeFalse();
});

it('POST /public/gift-cards vende un vale con tarjeta y POST /public/gift-cards/balance consulta el saldo', function () {
    $bought = $this->postJson('/api/v1/public/gift-cards', ['amount' => '150.00', 'currency' => 'PEN', 'buyer_name' => 'Mateo Ríos', 'buyer_email' => 'mateo@example.com', 'recipient_name' => 'Lucía', 'recipient_email' => 'lucia@example.com', 'card_token' => 'tok_ok_4242'], siteOf(extra: critical()))->assertOk()->json('data');

    expect($bought['code'])->toStartWith('VAL-')->and($bought['redeem_code'])->not->toBeEmpty();
    expect(rowOf('fin_gift_cards', $bought['code'])->status)->toBe('activa');

    $balance = $this->postJson('/api/v1/public/gift-cards/balance', ['redeem_code' => $bought['redeem_code']], siteOf())->assertOk()->json('data');
    expect($balance['balance'])->toBe('150.00')->and($balance['currency'])->toBe('PEN')->and($balance['status'])->toBe('activa');

    expect($this->postJson('/api/v1/public/gift-cards/balance', ['redeem_code' => 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'], siteOf()))->toBeApiError(404);
    expect($this->postJson('/api/v1/public/gift-cards', ['amount' => '150.00', 'currency' => 'PEN', 'buyer_name' => 'Mateo Ríos', 'buyer_email' => 'mateo@example.com', 'card_token' => 'tok_51_4242'], siteOf(extra: critical())))->toBeApiError(422, 'PAYMENT_DECLINED');
});

it('Ventas no tiene acceso a los vales', function () {
    actingAsSeed('U04');

    expect($this->getJson('/api/v1/finance/gift-cards'))->toBeApiError(403);
});
