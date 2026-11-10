<?php

use Illuminate\Support\Facades\DB;

function finComAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Comisión', 'entity_id' => $code, 'action' => $action])->exists());
}

function finComBeneficiaryPen(array $overview, string $name): string
{
    $row = collect($overview['by_beneficiary'])->firstWhere('name', $name);

    return number_format((float) ($row['pen'] ?? 0), 2, '.', '');
}

function finComSellerCalculated(): object
{
    test()->postJson('/api/v1/finance/commissions/calculate', [], critical())->assertCreated();

    return withinTenant(tenantA(), fn () => DB::table('fin_commissions')->whereNull('deleted_at')->where('status', 'calculada')->where('kind', 'vendedor')->orderBy('code')->first())
        ?? throw new RuntimeException('No hay comisiones de vendedor calculadas.');
}

it('anular una comisión calculada la saca del total del asesor y de los KPI', function () {
    actingAsSeed('U07');
    $commission = finComSellerCalculated();
    $before = $this->getJson('/api/v1/finance/commissions')->assertOk()->json('data');
    $row = collect($before['rows'])->firstWhere('code', $commission->code);
    $expected = bcsub(finComBeneficiaryPen($before, $row['beneficiary']), number_format($row['pen'], 2, '.', ''), 2);

    $this->postJson("/api/v1/finance/commissions/{$commission->code}/annul", ['reason' => 'Reserva vendida por otro asesor'], critical())
        ->assertOk()->assertJsonPath('data.code', $commission->code);

    $after = $this->getJson('/api/v1/finance/commissions')->assertOk()->json('data');
    $stored = rowOf('fin_commissions', $commission->code);

    expect(collect($after['rows'])->pluck('code'))->not->toContain($commission->code)
        ->and(finComBeneficiaryPen($after, $row['beneficiary']))->toBe($expected)
        ->and($after['kpis']['calculada']['count'])->toBe($before['kpis']['calculada']['count'] - 1)
        ->and($after['kpis']['pending_reservations'])->toBe($before['kpis']['pending_reservations'] + 1)
        ->and($stored->deleted_at)->not->toBeNull()
        ->and($stored->observation)->toBe('Reserva vendida por otro asesor')
        ->and(finComAudit($commission->code, 'anular'))->toBeTrue();
});

it('la anulación es lógica: la comisión anulada ya no se aprueba ni se vuelve a anular', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/commissions/COM-0299/annul', ['reason' => 'Convenio mal configurado'], critical())->assertOk();

    expect(rowOf('fin_commissions', 'COM-0299'))->not->toBeNull()
        ->and($this->postJson('/api/v1/finance/commissions/COM-0299/annul', ['reason' => 'Otra vez la misma'], critical()))->toBeApiError(404)
        ->and($this->postJson('/api/v1/finance/commissions/COM-0299/approve', [], critical((int) rowOf('fin_commissions', 'COM-0299')->lock_version)))->toBeApiError(404);
});

it('FIN-BR-29: una comisión aprobada o pagada no se anula', function (string $code) {
    actingAsSeed('U07');
    $status = rowOf('fin_commissions', $code)->status;

    expect($this->postJson("/api/v1/finance/commissions/{$code}/annul", ['reason' => 'Error de cálculo'], critical()))->toBeApiError(409, 'FIN-BR-29')
        ->and(rowOf('fin_commissions', $code)->deleted_at)->toBeNull()
        ->and(rowOf('fin_commissions', $code)->status)->toBe($status);
})->with(['COM-0301', 'COM-0298']);

it('anular exige un motivo de al menos 5 caracteres', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/commissions/COM-0299/annul', ['reason' => 'no'], critical())
        ->assertStatus(422)->assertJsonValidationErrors(['reason']);

    expect(rowOf('fin_commissions', 'COM-0299')->deleted_at)->toBeNull();
});

it('Ventas no puede anular comisiones', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/finance/commissions/COM-0299/annul', ['reason' => 'Quiero anularla'], critical()))->toBeApiError(403);
    expect(rowOf('fin_commissions', 'COM-0299')->deleted_at)->toBeNull();
});
