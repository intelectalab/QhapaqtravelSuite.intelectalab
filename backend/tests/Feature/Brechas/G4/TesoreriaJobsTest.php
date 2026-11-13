<?php

use App\Domain\Finance\Support\TreasuryDirectory;
use App\Domain\Shared\Jobs\JobCatalog;
use App\Jobs\TreasuryCashFlowSnapshot;
use App\Jobs\TreasuryOpenSessionCheck;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockScheduledJobs());

it('el aviso diario de cajas sin abrir llega a finanzas y al custodio una sola vez', function () {
    actingAsSeed('U01');
    $custodian = withinTenant(tenantA(), fn () => (string) DB::table('iam_users')->where('code', 'U07')->value('id'));
    $cash = $this->postJson('/api/v1/treasury/accounts', ['kind' => 'petty_cash', 'name' => 'Caja chica G4 sin abrir', 'currency' => 'PEN', 'opening_balance' => 300, 'fund_amount' => 300, 'custodian_id' => $custodian])->assertCreated()->json('data.code');
    $id = withinTenant(tenantA(), fn () => (string) DB::table('fin_treasury_accounts')->where('code', $cash)->value('id'));

    dispatch_sync((new TreasuryOpenSessionCheck)->forTenant((string) tenantA()->getKey()));
    dispatch_sync((new TreasuryOpenSessionCheck)->forTenant((string) tenantA()->getKey()));

    $sent = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'caja.sin_abrir')->where('source_id', $id)->pluck('recipient_user_id'));

    expect($sent)->toContain($custodian)->and($sent->count())->toBe($sent->unique()->count());
});

it('la foto diaria del flujo proyectado queda en caché para el resumen', function () {
    dispatch_sync((new TreasuryCashFlowSnapshot)->forTenant((string) tenantA()->getKey()));

    expect(Cache::get(TreasuryDirectory::snapshotKey((string) tenantA()->getKey())))->toHaveKeys(['taken_at', 'horizons', 'weeks']);
});

it('los dos procesos de tesorería están en el catálogo de jobs de la agencia', function () {
    expect(JobCatalog::forClass(TreasuryOpenSessionCheck::class)['code'])->toBe('JOB-TES-1')
        ->and(JobCatalog::forClass(TreasuryCashFlowSnapshot::class)['code'])->toBe('JOB-TES-2');
});
