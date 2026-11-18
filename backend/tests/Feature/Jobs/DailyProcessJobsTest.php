<?php

use App\Jobs\DeliverGiftCards;
use App\Jobs\ExpireGiftCards;
use App\Jobs\RefreshFxRates;
use App\Jobs\SalesTargetsPendingClose;
use App\Jobs\SendCorporateStatements;
use App\Jobs\TenantJob;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

function dailyJobRun(TenantJob $job): string
{
    $runs = fn () => DB::connection('pgsql_audit')->table('sys_job_runs')->where('tenant_id', tenantA()->getKey())->where('job_class', $job::class);
    $before = $runs()->pluck('id')->all();
    dispatch_sync($job->forTenant((string) tenantA()->getKey()));

    return (string) $runs()->whereNotIn('id', $before)->value('result');
}

it('JOB-35 avisa a gerencia de la meta vigente con periodo terminado, una sola vez', function () {
    $target = withinTenant(tenantA(), fn () => DB::table('crm_sales_targets')->where('status', 'vigente')->orderBy('code')->first(['id', 'code']));
    withinTenant(tenantA(), fn () => DB::table('crm_sales_targets')->where('id', $target->id)->update(['period_to' => Carbon::parse(BUSINESS_TODAY)->subDays(2)->toDateString()]));

    expect(dailyJobRun(new SalesTargetsPendingClose))->toContain('por cerrar');

    $notices = fn () => withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'meta.por_cerrar')->where('source_id', $target->id)->count());
    $first = $notices();
    expect($first)->toBeGreaterThan(0);

    dailyJobRun(new SalesTargetsPendingClose);
    expect($notices())->toBe($first);
});

it('JOB-36 vence el vale activo con fecha pasada y deja el movimiento de vencimiento', function () {
    $card = withinTenant(tenantA(), fn () => DB::table('fin_gift_cards')->where('status', 'activa')->where('balance', '>', 0)->orderBy('code')->first(['id', 'balance']));
    withinTenant(tenantA(), fn () => DB::table('fin_gift_cards')->where('id', $card->id)->update(['expires_at' => Carbon::parse(BUSINESS_TODAY)->subDay()->toDateString()]));

    expect(dailyJobRun(new ExpireGiftCards))->toContain('vencido');

    $row = withinTenant(tenantA(), fn () => DB::table('fin_gift_cards')->where('id', $card->id)->first(['status', 'balance']));
    expect($row->status)->toBe('vencida')
        ->and((float) $row->balance)->toBe(0.0)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_gift_card_movements')->where('gift_card_id', $card->id)->where('kind', 'vencimiento')->exists()))->toBeTrue();
});

it('JOB-37 genera y envía el estado de cuenta del mes anterior el día programado sin duplicarlo', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-05 14:00:00', 'UTC'));
    $account = withinTenant(tenantA(), fn () => DB::table('crm_corporate_accounts')->where('status', 'activa')->first(['id', 'currency']));
    $today = Carbon::now('America/Lima');
    withinTenant(tenantA(), fn () => DB::table('crm_corporate_accounts')->where('id', $account->id)->update(['statement_auto' => true, 'statement_day' => $today->day]));
    $start = $today->copy()->subMonthNoOverflow()->startOfMonth()->toDateString();
    withinTenant(tenantA(), fn () => DB::table('fin_corporate_statements')->where('account_id', $account->id)->where('period_start', $start)->update(['status' => 'anulado']));

    expect(dailyJobRun(new SendCorporateStatements))->toContain('estado de cuenta enviado');

    $statements = fn () => withinTenant(tenantA(), fn () => DB::table('fin_corporate_statements')->where('account_id', $account->id)->where('period_start', $start)->where('status', '<>', 'anulado')->get(['status']));
    expect($statements())->toHaveCount(1)->and($statements()->first()->status)->toBe('enviado');

    dailyJobRun(new SendCorporateStatements);
    expect($statements())->toHaveCount(1);
});

it('JOB-38 registra el tipo de cambio del día con el proveedor elegido y sin proveedor no hace nada', function () {
    expect(dailyJobRun(new RefreshFxRates))->toContain('Sin proveedor');

    actingAsSeed('U01');
    $this->putJson('/api/v1/finance/fx-provider', ['code' => 'SIMULADO'])->assertOk();

    expect(dailyJobRun(new RefreshFxRates))->toContain('Tipo de cambio del día')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_fx_rates as f')->join('fx_rate_providers as p', 'p.id', '=', 'f.provider_id')->where('p.code', 'SIMULADO')->where('f.currency_code', 'USD')->exists()))->toBeTrue();
});

it('JOB-39 guarda cifrado el código del vale con envío programado y lo envía en su fecha', function () {
    actingAsSeed('U07');
    $deliver = Carbon::now('America/Lima')->addDays(3)->toDateString();
    $card = $this->postJson('/api/v1/finance/gift-cards', ['amount' => '100.00', 'currency' => 'PEN', 'recipient_name' => 'Ana Torres', 'recipient_email' => 'ana@example.com', 'deliver_at' => $deliver], critical())->assertOk()->json('data');
    $row = fn () => withinTenant(tenantA(), fn () => DB::table('fin_gift_cards')->where('code', $card['code'])->first(['redeem_code_encrypted', 'delivered_at']));

    expect($row()->delivered_at)->toBeNull()
        ->and($row()->redeem_code_encrypted)->not->toBeNull()
        ->and($row()->redeem_code_encrypted)->not->toContain($card['redeem_code'])
        ->and(Crypt::decryptString((string) $row()->redeem_code_encrypted))->toBe($card['redeem_code'])
        ->and(dailyJobRun(new DeliverGiftCards))->toBe('Sin vales por enviar');

    Carbon::setTestNow(Carbon::parse($deliver.' 08:05:00', 'America/Lima')->utc());

    expect(dailyJobRun(new DeliverGiftCards))->toContain('1 vale enviado')
        ->and($row()->delivered_at)->not->toBeNull()
        ->and($row()->redeem_code_encrypted)->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Vale de regalo', 'entity_id' => $card['code'], 'action' => 'entregar'])->exists()))->toBeTrue();
});

it('el envío programado del vale exige correo y una fecha anterior al vencimiento', function () {
    actingAsSeed('U07');
    $soon = Carbon::now('America/Lima')->addDays(5)->toDateString();

    expect($this->postJson('/api/v1/finance/gift-cards', ['amount' => '50.00', 'currency' => 'PEN', 'deliver_at' => $soon], critical()))->toBeApiError(422, 'GIFT_CARD_DELIVERY_EMAIL');
    expect($this->postJson('/api/v1/finance/gift-cards', ['amount' => '50.00', 'currency' => 'PEN', 'recipient_email' => 'ana@example.com', 'deliver_at' => $soon, 'expires_at' => Carbon::now('America/Lima')->addDays(2)->toDateString()], critical()))->toBeApiError(422, 'GIFT_CARD_DELIVERY_AFTER_EXPIRY');
});
