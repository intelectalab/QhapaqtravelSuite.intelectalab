<?php

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Sequences\SequenceService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function nextCode(string $docType, ?int $year = null): string
{
    return withinTenant(tenantA(), fn () => app(SequenceService::class)->next($docType, year: $year));
}

function seriesRow(string $docType, string $series): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('sys_sequences')->where('doc_type', $docType)->where('series', $series)->first(['prefix', 'next_number']));
}

it('la serie del año continúa desde el último código emitido', function () {
    freezeBusinessToday();
    $highest = (int) withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', 'like', 'COT-2026-%')->selectRaw("max(cast(substring(code from '([0-9]+)$') as bigint)) as n")->value('n'));

    expect(nextCode('quote'))->toBe('COT-2026-'.str_pad((string) ($highest + 1), 5, '0', STR_PAD_LEFT))
        ->and(nextCode('quote'))->toBe('COT-2026-'.str_pad((string) ($highest + 2), 5, '0', STR_PAD_LEFT));
});

it('el 1 de enero la numeración reinicia en una serie nueva sin bajar la del año anterior', function () {
    freezeBusinessToday();
    nextCode('reservation');
    $before = seriesRow('reservation', '2026');

    $now = CarbonImmutable::parse('2027-01-01 08:00:00', 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);

    expect(nextCode('reservation'))->toBe('RES-2027-000001')
        ->and(nextCode('reservation'))->toBe('RES-2027-000002')
        ->and((int) seriesRow('reservation', '2026')->next_number)->toBe((int) $before->next_number);
});

it('las órdenes operativas y los vouchers numeran por el año del viaje', function () {
    freezeBusinessToday();

    expect(nextCode('ops_order', 2027))->toBe('OP-2027-0001')
        ->and(nextCode('voucher', 2027))->toBe('VOU-2027-00001')
        ->and(nextCode('ops_order', 2026))->toMatch('/^OP-2026-\d{4}$/');
});

it('pagos, cuentas por pagar y comisiones pasan a sys_sequences y siguen la numeración existente', function () {
    freezeBusinessToday();
    $highest = fn (string $table, string $prefix): int => (int) withinTenant(tenantA(), fn () => DB::table($table)->where('code', 'like', "{$prefix}%")->selectRaw("max(cast(substring(code from '([0-9]+)$') as bigint)) as n")->value('n'));

    expect(nextCode('payment'))->toBe('PAG-'.str_pad((string) ($highest('fin_payments', 'PAG-') + 1), 5, '0', STR_PAD_LEFT))
        ->and(nextCode('payable'))->toBe('CXP-'.str_pad((string) ($highest('fin_payables', 'CXP-') + 1), 5, '0', STR_PAD_LEFT))
        ->and(nextCode('commission'))->toBe('COM-'.str_pad((string) ($highest('fin_commissions', 'COM-') + 1), 4, '0', STR_PAD_LEFT))
        ->and(seriesRow('payment', 'default'))->not->toBeNull();
});

it('el correlativo de respaldo usa el mayor número y no el orden alfabético al pasar de 9999', function () {
    $code = withinTenant(tenantA(), function () {
        DB::table('sys_sequences')->insert([
            ['doc_type' => 'zz_prueba_a', 'label' => 'ZZ-9999', 'series' => 'default', 'prefix' => 'ZZ-', 'pad_width' => 4, 'next_number' => 1, 'year_reset' => false],
            ['doc_type' => 'zz_prueba_b', 'label' => 'ZZ-10000', 'series' => 'default', 'prefix' => 'ZZ-', 'pad_width' => 4, 'next_number' => 1, 'year_reset' => false],
        ]);

        return app(CodeSequence::class)->next('sys_sequences', 'ZZ-', 4, 'label');
    });

    expect($code)->toBe('ZZ-10001');
});
