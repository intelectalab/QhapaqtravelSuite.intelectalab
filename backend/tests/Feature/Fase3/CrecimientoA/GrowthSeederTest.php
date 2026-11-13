<?php

use Database\Seeders\Modules\GrowthBackOfficeSeeder;
use Illuminate\Support\Facades\DB;

it('GrowthBackOfficeSeeder deja plan de cuentas, deslinde, links y vales visibles en sus pantallas y es idempotente', function () {
    withinTenant(tenantA(), fn () => (new GrowthBackOfficeSeeder(tenantA()))->run());
    withinTenant(tenantA(), fn () => (new GrowthBackOfficeSeeder(tenantA()))->run());

    expect(withinTenant(tenantA(), fn () => DB::table('fin_account_mappings')->where('target', 'contasis')->count()))->toBe(12)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_gift_cards')->whereIn('code', ['VAL-0001', 'VAL-0002'])->count()))->toBe(2)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_gift_card_movements')->count()))->toBe(2);

    actingAsSeed('U07');
    expect(collect($this->getJson('/api/v1/finance/payment-links')->assertOk()->json('data'))->pluck('code'))->toContain('LPG-0001')
        ->and(collect($this->getJson('/api/v1/finance/gift-cards')->assertOk()->json('data'))->pluck('code'))->toContain('VAL-0001');

    $link = $this->postJson('/api/v1/finance/payment-links', ['receivable_id' => 'CXC-00711', 'amount' => '10.00', 'methods' => ['card']], critical())->assertCreated()->json('data');
    expect($link['code'])->toBe('LPG-0003');

    actingAsSeed('U05');
    expect(collect($this->getJson('/api/v1/ops/waiver-templates')->assertOk()->json('data.templates'))->pluck('code'))->toContain('DES-001');
});
