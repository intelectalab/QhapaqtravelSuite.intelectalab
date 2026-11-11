<?php

use App\Domain\Finance\Actions\TargetBonusCommission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

function bonusTargetVersion(string $code): int
{
    return (int) rowOf('crm_sales_targets', $code)->lock_version;
}

function bonusCommissionsOf(string $code): array
{
    $id = idOf('crm_sales_targets', $code);

    return withinTenant(tenantA(), fn () => DB::table('fin_commissions')->where('sales_target_id', $id)->get()->all());
}

function bonusTargetWithSales(object $test, string $code, float $achievedPct, float $bonus): float
{
    $sales = (float) $test->getJson("/api/v1/crm/sales-targets/{$code}")->assertOk()->json('data.target.actual.sales');
    expect($sales)->toBeGreaterThan(0.0);
    withinTenant(tenantA(), fn () => DB::table('crm_sales_targets')->where('code', $code)->update(['goal_sales_pen' => round($sales / ($achievedPct / 100), 2), 'bonus_amount' => $bonus, 'bonus_currency' => 'PEN']));

    return $sales;
}

it('MET-BR-10: cerrar una meta con 112,9 % y bono de S/ 600 crea una sola comisión «Bono por meta» calculada', function () {
    actingAsSeed('U02');
    $sales = bonusTargetWithSales($this, 'MET-0005', 112.9, 600);

    $this->postJson('/api/v1/crm/sales-targets/MET-0005/close', [], critical(bonusTargetVersion('MET-0005')))->assertOk();

    $commissions = bonusCommissionsOf('MET-0005');
    $target = rowOf('crm_sales_targets', 'MET-0005');
    expect($commissions)->toHaveCount(1)
        ->and($commissions[0]->kind)->toBe('Bono por meta')
        ->and($commissions[0]->status)->toBe('calculada')
        ->and((string) $commissions[0]->amount)->toBe('600.00')
        ->and((float) $commissions[0]->base_amount)->toBe(round($sales, 2))
        ->and($commissions[0]->reservation_id)->toBeNull()
        ->and($commissions[0]->beneficiary_user_id)->toBe($target->scope_id)
        ->and($commissions[0]->rule_description)->toContain('tramo ≥ 100 %')
        ->and($target->bonus_commission_id)->toBe($commissions[0]->id)
        ->and(collect(withinTenant(tenantA(), fn () => DB::table('crm_sales_target_adjustments')->where('target_id', $target->id)->pluck('action')->all())))->toContain('bono')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Comisión', 'entity_id' => $commissions[0]->code, 'action' => 'calcular'])->exists()))->toBeTrue()
        ->and($this->getJson('/api/v1/crm/sales-targets/MET-0005')->json('data.commission.code'))->toBe($commissions[0]->code);

    expect($this->postJson('/api/v1/crm/sales-targets/MET-0005/close', [], critical(bonusTargetVersion('MET-0005'))))->toBeApiError(409, 'MET-STATE');
    expect(withinTenant(tenantA(), fn () => app(TargetBonusCommission::class)->create($target->id, $target->created_by)))->toBeNull()
        ->and(bonusCommissionsOf('MET-0005'))->toHaveCount(1);

    actingAsSeed('U07');
    expect(collect($this->getJson('/api/v1/finance/commissions')->assertOk()->json('data.rows'))->pluck('code'))->toContain($commissions[0]->code);
});

it('MET-BR-10: los tramos pagan 50 % desde el 90 % y 130 % desde el 120 %', function (float $achieved, string $expected) {
    actingAsSeed('U02');
    bonusTargetWithSales($this, 'MET-0005', $achieved, 1000);

    $this->postJson('/api/v1/crm/sales-targets/MET-0005/close', [], critical(bonusTargetVersion('MET-0005')))->assertOk();

    expect((string) bonusCommissionsOf('MET-0005')[0]->amount)->toBe($expected);
})->with([
    'tramo del 90 %' => [95.0, '500.00'],
    'tramo del 120 %' => [125.0, '1300.00'],
]);

it('MET-BR-10: bajo el 90 % no se genera bono', function () {
    actingAsSeed('U02');
    bonusTargetWithSales($this, 'MET-0005', 80.0, 1000);

    $this->postJson('/api/v1/crm/sales-targets/MET-0005/close', [], critical(bonusTargetVersion('MET-0005')))->assertOk();

    expect(rowOf('crm_sales_targets', 'MET-0005')->status)->toBe('cerrada')
        ->and(bonusCommissionsOf('MET-0005'))->toBeEmpty();
});
