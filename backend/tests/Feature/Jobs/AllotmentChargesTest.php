<?php

use App\Jobs\ReleaseAllotments;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockSeededBookings();
    lockScheduledJobs();
    freezeBusinessToday();
});

function allotmentWithDays(): string
{
    return withinTenant(tenantA(), function (): string {
        $service = DB::table('catalog_services')->where('name', 'Noche en lodge flotante Uros')->first(['id', 'provider_id']);
        $id = (string) DB::table('catalog_allotments')->insertGetId([
            'code' => 'CUP-PRUEBA',
            'provider_id' => $service->provider_id,
            'service_id' => $service->id,
            'kind' => 'hotel',
            'name' => 'Bloqueo de prueba',
            'valid_from' => '2026-09-01',
            'valid_to' => '2026-12-31',
            'base_qty' => 5,
            'release_days' => 7,
            'net_rate' => '120.50',
            'penalty_pct' => '50.00',
            'currency' => 'PEN',
            'status' => 'en_release',
            'owner_id' => seedUser('U01')->getKey(),
        ], 'id');

        DB::table('catalog_allotment_days')->insert([
            ['allotment_id' => $id, 'service_date' => '2026-09-20', 'blocked_qty' => 5, 'used_qty' => 2, 'release_deadline' => '2026-09-13', 'retained_at' => now(), 'retained_reason' => 'Grupo por confirmar'],
            ['allotment_id' => $id, 'service_date' => '2026-09-22', 'blocked_qty' => 5, 'used_qty' => 5, 'release_deadline' => '2026-09-15', 'retained_at' => null, 'retained_reason' => null],
            ['allotment_id' => $id, 'service_date' => '2026-09-25', 'blocked_qty' => 5, 'used_qty' => 0, 'release_deadline' => '2026-09-18', 'retained_at' => null, 'retained_reason' => null],
            ['allotment_id' => $id, 'service_date' => '2026-10-03', 'blocked_qty' => 5, 'used_qty' => 0, 'release_deadline' => '2026-09-26', 'retained_at' => null, 'retained_reason' => null],
        ]);

        return $id;
    });
}

function runReleaseAllotments(): void
{
    dispatch_sync((new ReleaseAllotments)->forTenant((string) tenantA()->getKey()));
}

it('CUP-BR-009/010: la fecha pasada retenida sin usar genera cargo y cuenta por pagar al proveedor', function () {
    $id = allotmentWithDays();

    runReleaseAllotments();

    [$charges, $payable, $days, $status] = withinTenant(tenantA(), fn () => [
        DB::table('catalog_allotment_charges as c')->join('catalog_allotment_days as d', 'd.id', '=', 'c.allotment_day_id')->where('d.allotment_id', $id)->get(['d.service_date', 'c.qty', 'c.amount', 'c.payable_id']),
        DB::table('fin_payables')->where('concept', 'like', 'Penalidad por no uso de cupo CUP-PRUEBA%')->first(['amount', 'currency', 'kind', 'cost_type', 'status', 'provider_id']),
        DB::table('catalog_allotment_days')->where('allotment_id', $id)->orderBy('service_date')->get(['service_date', 'released_qty', 'closed_at']),
        DB::table('catalog_allotments')->where('id', $id)->value('status'),
    ]);

    expect($charges)->toHaveCount(1)
        ->and($charges[0]->service_date)->toBe('2026-09-20')
        ->and((int) $charges[0]->qty)->toBe(3)
        ->and((string) $charges[0]->amount)->toBe('180.75')
        ->and($charges[0]->payable_id)->not->toBeNull()
        ->and((string) $payable->amount)->toBe('180.75')
        ->and($payable->cost_type)->toBe('penalidad_proveedor')
        ->and($payable->status)->toBe('abierta')
        ->and($days->whereNotNull('closed_at')->pluck('service_date')->all())->toBe(['2026-09-20', '2026-09-22', '2026-09-25'])
        ->and((int) $days->firstWhere('service_date', '2026-10-03')->released_qty)->toBe(5)
        ->and($status)->toBe('activo');
});

it('una segunda ejecución no duplica cargos ni cuentas por pagar', function () {
    $id = allotmentWithDays();

    runReleaseAllotments();
    runReleaseAllotments();

    [$charges, $payables] = withinTenant(tenantA(), fn () => [
        DB::table('catalog_allotment_charges as c')->join('catalog_allotment_days as d', 'd.id', '=', 'c.allotment_day_id')->where('d.allotment_id', $id)->count(),
        DB::table('fin_payables')->where('concept', 'like', 'Penalidad por no uso de cupo CUP-PRUEBA%')->count(),
    ]);

    expect($charges)->toBe(1)->and($payables)->toBe(1);
});
