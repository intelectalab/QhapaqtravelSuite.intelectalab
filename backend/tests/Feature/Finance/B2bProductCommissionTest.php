<?php

use App\Domain\Finance\Support\CommissionDirectory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

function b2bRateOf(string $product, string $agency): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_product_b2b_rates as r')
        ->join('catalog_products as p', 'p.id', '=', 'r.product_id')->join('channel_b2b_agencies as a', 'a.id', '=', 'r.agency_id')
        ->where('p.code', $product)->where('a.code', $agency)->whereNull('r.deleted_at')->first(['r.id', 'r.commission_pct', 'a.commission_pct as agreement_pct']));
}

it('FIN-BR-26: la comisión de la lista de precios manda sobre el convenio, se congela en la reserva y es la que se liquida', function () {
    $rate = b2bRateOf('CUS-HUM-FD', 'AGB-01');
    $pct = bccomp((string) $rate->agreement_pct, '14.50', 2) === 0 ? '13.50' : '14.50';
    withinTenant(tenantA(), fn () => DB::table('catalog_product_b2b_rates')->where('id', $rate->id)->update(['commission_pct' => $pct]));

    actingAsSeed('U13');
    $body = ['product' => 'CUS-HUM-FD', 'date' => '2026-10-06', 'adults' => 2];
    $quote = $this->postJson('/api/v1/b2b/reservations/quote-price', $body)->assertOk()->json('data');
    expect((float) $quote['commission_pct'])->toBe((float) $pct);

    $product = collect($this->getJson('/api/v1/b2b/catalog')->assertOk()->json('data.products'))->firstWhere('code', 'CUS-HUM-FD');
    expect((float) $product['commission_pct'])->toBe((float) $pct);

    $code = (string) $this->postJson('/api/v1/b2b/reservations', [...$body, 'pay_mode' => 'credito'], critical())->assertOk()->json('data.code');
    $reservation = reservationRow($code);
    $commission = withinTenant(tenantA(), fn () => DB::table('fin_commissions')->where('reservation_id', $reservation->id)->first());

    expect((float) json_decode((string) $reservation->b2b_terms, true)['commission_pct'])->toBe((float) $pct)
        ->and((float) $commission->pct)->toBe((float) $pct)
        ->and($commission->rule_description)->toStartWith('Tarifa B2B del producto');
});

it('FIN-BR-26: sin comisión congelada en la reserva se liquida con la del convenio', function () {
    $directory = app(CommissionDirectory::class);
    $reservation = fn (?array $terms): object => (object) ['channel' => 'B2B', 'agency_id' => 'agencia', 'owner_id' => null, 'segment_code' => null, 'currency' => 'PEN', 'total_amount' => '1000.00', 'commission_pct' => '10.00', 'b2b_terms' => $terms === null ? null : json_encode($terms)];

    $frozen = $directory->terms($reservation(['commission_pct' => 12.5, 'pay_mode' => 'credito']), new Collection);
    $agreement = $directory->terms($reservation(null), new Collection);
    $withoutPct = $directory->terms($reservation(['pay_mode' => 'prepago']), new Collection);

    expect($frozen)->toMatchArray(['pct' => '12.5', 'amount' => '125.00'])->and($frozen['description'])->toStartWith('Tarifa B2B del producto')
        ->and($agreement)->toMatchArray(['pct' => '10', 'amount' => '100.00'])->and($agreement['description'])->toStartWith('Convenio B2B')
        ->and($withoutPct['pct'])->toBe('10');
});

it('FIN-BR-30: la ficha de la comisión avisa solo si el monto difiere en más de 0,05 de la regla vigente', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('fin_commissions')->whereNotNull('reservation_id')->where('status', 'calculada')->whereNull('deleted_at')->orderBy('code')->value('code'));
    $expected = $this->getJson("/api/v1/finance/commissions/{$code}")->assertOk()->json('data.current_rule.expected');
    $setAmount = fn (string $amount) => withinTenant(tenantA(), fn () => DB::table('fin_commissions')->where('code', $code)->update(['amount' => $amount]));

    $setAmount(bcadd($expected, '0.05', 2));
    expect($this->getJson("/api/v1/finance/commissions/{$code}")->json('data.current_rule'))->toMatchArray(['difference' => '0.05', 'alert' => null]);

    $setAmount(bcadd($expected, '0.06', 2));
    $rule = $this->getJson("/api/v1/finance/commissions/{$code}")->json('data.current_rule');
    expect($rule['difference'])->toBe('0.06')->and($rule['alert'])->toStartWith('FIN-BR-30');

    $setAmount(bcsub($expected, '1.00', 2));
    expect($this->getJson("/api/v1/finance/commissions/{$code}")->json('data.current_rule.alert'))->toContain('1.00');
});
