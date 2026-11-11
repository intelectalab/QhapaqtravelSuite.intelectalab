<?php

use App\Domain\Quotes\Support\QuoteApprovalPolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('los umbrales de aprobación interna salen de la configuración de la agencia', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/quotes/COT-2026-00191')->json('data.approval_rules'))->toBe(['discount_limit' => '5', 'margin_floor' => '15', 'max_discount' => '10']);

    withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'policies')->update(['values' => DB::raw("values || '{\"max_discount_pct\": 6, \"approval_margin_pct\": 10, \"discount_cap_pct\": 12}'::jsonb")]));

    $data = $this->getJson('/api/v1/quotes/COT-2026-00191')->json('data');
    expect($data['approval_rules'])->toBe(['discount_limit' => '6', 'margin_floor' => '10', 'max_discount' => '12'])
        ->and($data['internal']['required'])->toBeFalse();
});

it('la configuración valida que el tope no sea menor que el descuento sin aprobación', function () {
    actingAsSeed('U01');
    $settings = $this->getJson('/api/v1/settings')->json('data.sections.policies');
    $values = [...$settings['values'], 'approval_margin_pct' => 15, 'discount_cap_pct' => 3, 'max_discount_pct' => 5];

    expect($this->patchJson('/api/v1/settings/policies', $values, ['If-Match' => (string) $settings['lock_version']]))->toBeApiError(422);
    $this->patchJson('/api/v1/settings/policies', [...$values, 'discount_cap_pct' => 8], ['If-Match' => (string) $settings['lock_version']])->assertOk();
    expect($this->getJson('/api/v1/quotes/COT-2026-00191')->json('data.approval_rules.max_discount'))->toBe('8');
    expect(QuoteApprovalPolicy::DEFAULTS)->toBe(['discount_limit' => '5', 'margin_floor' => '15', 'max_discount' => '10']);
});
