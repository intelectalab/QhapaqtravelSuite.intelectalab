<?php

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Platform\Support\PlanFeatureRules;
use Illuminate\Support\Facades\DB;

function plataformaReglaApagada(string $code): void
{
    withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', $code)->update(['enabled' => false]));
    RuleResolver::invalidate(tenantA()->getKey());
}

function plataformaVale(): array
{
    actingAsSeed('U07');

    return test()->postJson('/api/v1/finance/gift-cards', ['amount' => '200.00', 'currency' => 'USD', 'recipient_name' => 'Ana Torres', 'recipient_email' => 'ana@example.com'], critical())->assertOk()->json('data');
}

it('O2: las 14 reglas de plan están en el catálogo, en la matriz y en las reglas de la agencia con su plan mínimo', function () {
    $platform = DB::connection('pgsql_platform');
    $matrix = $platform->table('plan_rule_entitlements')->whereIn('rule_code', PlanFeatureRules::codes())->pluck('min_plan', 'rule_code')->all();

    expect(PlanFeatureRules::codes())->toHaveCount(14)
        ->and($matrix)->toHaveCount(14)
        ->and($matrix['R-AI-ASSISTANT'])->toBe('Starter')
        ->and($matrix['R-CORP-PORTAL'])->toBe('Professional')
        ->and($matrix['R-GIFT-CARDS'])->toBe('Professional')
        ->and($matrix['R-AI-INSIGHTS'])->toBe('Enterprise')
        ->and(collect($matrix)->countBy()->all())->toBe(['Starter' => 3, 'Professional' => 6, 'Enterprise' => 5])
        ->and(withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->whereIn('code', PlanFeatureRules::codes())->count()))->toBe(14);

    actingAsPlatform();
    $codes = collect($this->getJson('/api/v1/platform/plan-rules')->assertOk()->json('data.groups'))->flatMap(fn (array $group) => collect($group['rules'])->pluck('code'));
    expect($codes)->toContain('R-GDS-OFFERS', 'R-PAY-LINKS', 'R-QR-CHECKIN');
});

it('O2: con la regla de vales apagada no se emiten nuevos, pero los vigentes se consultan y canjean', function () {
    $card = plataformaVale();
    plataformaReglaApagada('R-GIFT-CARDS');

    expect($this->postJson('/api/v1/finance/gift-cards', ['amount' => '50.00', 'currency' => 'USD', 'recipient_name' => 'Luis', 'recipient_email' => 'luis@example.com'], critical()))->toBeApiError(403, 'RULE_NOT_IN_PLAN');
    expect($this->getJson('/api/v1/finance/gift-cards')->assertOk()->json('meta.rule_enabled'))->toBeFalse();
    $this->getJson("/api/v1/finance/gift-cards/{$card['code']}")->assertOk();
    $this->postJson("/api/v1/finance/gift-cards/{$card['code']}/redeem", ['redeem_code' => $card['redeem_code'], 'amount' => '20.00', 'receivable_id' => 'CXC-00714'], critical())->assertOk();
});

it('SUB-BR-03: al bajar de plan, el aviso cuenta lo ya vendido que se respeta', function () {
    plataformaVale();
    actingAsSeed('U01');

    $preview = $this->postJson('/api/v1/billing/subscription/preview-change', ['plan' => 'starter', 'cycle' => 'monthly'])->assertOk()->json('data');
    $gift = collect($preview['carry_over']['items'])->firstWhere('rule', 'R-GIFT-CARDS');

    expect($preview['rules']['lost'])->toContain('Vales de regalo')
        ->and($gift['count'])->toBeGreaterThanOrEqual(1)
        ->and($gift['kept'])->toBe('se consultan y canjean hasta vencer')
        ->and($preview['carry_over']['notice'])->toStartWith('Tienes ')->toEndWith('se respetarán, pero no podrás crear nuevos.');
});
