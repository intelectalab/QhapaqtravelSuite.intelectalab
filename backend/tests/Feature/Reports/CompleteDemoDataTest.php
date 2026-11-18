<?php

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
    lockPlatformBilling();
    demoOwner()->beginTransaction();
    $this->beforeApplicationDestroyed(fn () => demoOwner()->rollBack());
});

function demoOwner(): ConnectionInterface
{
    return DB::connection('pgsql_owner');
}

function demoSnapshot(): array
{
    app(TenantContext::class)->set(tenantA());
    $db = demoOwner();

    return [
        'subscriptions' => $db->table('subscriptions')->count(),
        'invoices' => $db->table('platform_invoices')->count(),
        'overrides' => $db->table('feature_overrides')->count(),
        'movements' => $db->table('channel_b2b_credit_movements')->count(),
        'fiscal' => $db->table('fin_fiscal_events')->count(),
        'tokens' => $db->table('quote_access_tokens')->whereNull('revoked_at')->count(),
        'reservations' => $db->table('booking_reservations')->count(),
        'tenants' => $db->table('tenants')->count(),
    ];
}

it('demo:completar no cambia nada cuando los datos de demostración ya están completos', function () {
    $before = demoSnapshot();

    $this->artisan('demo:completar')->assertSuccessful();

    expect(demoSnapshot())->toBe($before);
});

it('demo:completar rellena los huecos de la demo sin tocar lo que ya existe', function () {
    $before = demoSnapshot();
    $db = demoOwner();
    $costa = $db->table('tenants')->where('code', 'TNT-0003')->value('id');
    $subscription = $db->table('subscriptions')->where('tenant_id', $costa)->value('id');
    $invoices = $db->table('platform_invoices')->where('subscription_id', $subscription)->pluck('id');
    $db->table('payment_attempts')->whereIn('invoice_id', $invoices)->delete();
    $db->table('platform_invoice_lines')->whereIn('invoice_id', $invoices)->delete();
    $db->table('platform_invoices')->whereIn('id', $invoices)->delete();
    $db->table('subscriptions')->where('id', $subscription)->delete();

    $wayra = $db->table('channel_b2b_agencies')->where('code', 'AGB-01')->value('id');
    $credit = $db->table('channel_b2b_agencies')->where('id', $wayra)->value('credit_used');
    $db->statement('alter table channel_b2b_credit_movements disable trigger user');
    $db->table('channel_b2b_credit_movements')->where('agency_id', $wayra)->delete();
    $db->statement('alter table channel_b2b_credit_movements enable trigger user');
    $db->table('booking_reservations')->where('code', 'RES-2026-000345')->update(['agency_id' => null, 'b2b_terms' => null]);
    $invoice = $db->table('fin_invoices')->where('number', 'B001-00008812')->value('id');
    $db->table('fin_fiscal_events')->where('invoice_id', $invoice)->delete();
    $db->table('quote_access_tokens')->where('quote_id', $db->table('quote_quotes')->where('code', 'COT-2026-00190')->value('id'))->delete();
    $altiplano = $db->table('subscriptions')->where('tenant_id', $db->table('tenants')->where('code', 'TNT-0004')->value('id'))->first(['id', 'billing_email']);
    $db->table('subscriptions')->where('id', $altiplano->id)->update(['billing_email' => 'pagos@altiplano.example']);

    $this->artisan('demo:completar --simular')->assertSuccessful();
    expect($db->table('subscriptions')->where('tenant_id', $costa)->exists())->toBeFalse();

    $this->artisan('demo:completar')->assertSuccessful();

    app(TenantContext::class)->set(tenantA());
    expect($db->table('subscriptions')->where('tenant_id', $costa)->where('status', 'active')->exists())->toBeTrue()
        ->and($db->table('subscriptions')->where('id', $altiplano->id)->value('billing_email'))->toBe('pagos@altiplano.example')
        ->and(round((float) $db->table('channel_b2b_credit_movements')->where('agency_id', $wayra)->sum('amount'), 2))->toBe(round((float) $credit, 2))
        ->and($db->table('booking_reservations')->where('code', 'RES-2026-000345')->value('agency_id'))->toBe($wayra)
        ->and($db->table('fin_fiscal_events')->where('invoice_id', $invoice)->count())->toBe(1)
        ->and(demoSnapshot())->toBe($before);
});
