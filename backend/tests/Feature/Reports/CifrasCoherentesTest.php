<?php

use App\Domain\Platform\Support\BillingMetrics;
use App\Domain\Platform\Support\PlatformHome;
use App\Domain\Platform\Support\TenantDirectory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('el ingreso mensual de Agencias es la misma suma de suscripciones que muestra Inicio de la consola', function () {
    lockPlatformBilling();
    $home = app(PlatformHome::class)->overview();
    $tenants = app(TenantDirectory::class)->all();
    $billable = app(BillingMetrics::class)->subscriptions()->whereIn('status', BillingMetrics::BILLABLE)->pluck('mrr', 'tenant_id');

    expect(round($tenants->sum(fn (array $tenant): float => (float) $tenant['mrr']), 2))->toBe(round((float) $home['mrr'], 2))
        ->and($tenants->filter(fn (array $tenant): bool => ! $billable->has($tenant['id']))->every(fn (array $tenant): bool => (float) $tenant['mrr'] === 0.0))->toBeTrue();
});

it('cada agencia del kit tiene su suscripción, y las agencias en prueba coinciden con las suscripciones en prueba', function () {
    $db = DB::connection('pgsql_platform');
    $kit = $db->table('tenants')->whereIn('code', ['TNT-0001', 'TNT-0002', 'TNT-0003', 'TNT-0004', 'TNT-0005', 'TNT-0006'])->pluck('id');

    expect($db->table('subscriptions')->whereIn('tenant_id', $kit)->where('status', '<>', 'canceled')->distinct()->count('tenant_id'))->toBe($kit->count())
        ->and($db->table('subscriptions as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->whereIn('t.id', $kit)->where('s.status', 'trialing')->count())
        ->toBe($db->table('tenants')->whereIn('id', $kit)->where('status', 'prueba')->count());
});

it('FIN-BR-26: el catálogo del portal B2B muestra la comisión de la lista de precios de cada producto, que es la que se liquida', function () {
    actingAsSeed('U13');
    $rates = withinTenant(tenantA(), fn () => DB::table('catalog_product_b2b_rates as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->join('channel_b2b_agencies as a', 'a.id', '=', 'r.agency_id')
        ->where('a.code', 'AGB-01')->whereNull('r.deleted_at')->pluck('r.commission_pct', 'p.code'));
    $products = collect($this->getJson('/api/v1/b2b/catalog')->assertOk()->json('data.products'))->filter(fn (array $product): bool => $product['commission_pct'] !== null);

    expect($products)->not->toBeEmpty()
        ->and($products->every(fn (array $product): bool => (float) $product['commission_pct'] === (float) $rates[$product['code']]))->toBeTrue();
});

it('el crédito usado de cada agencia B2B es la suma de sus movimientos y sus reservas B2B están ligadas a ella', function () {
    withinTenant(tenantA(), function (): void {
        foreach (DB::table('channel_b2b_agencies')->get(['id', 'crm_client_id', 'credit_used']) as $agency) {
            expect(round((float) DB::table('channel_b2b_credit_movements')->where('agency_id', $agency->id)->sum('amount'), 2))->toBe(round((float) $agency->credit_used, 2));

            if ($agency->crm_client_id !== null) {
                expect(DB::table('booking_reservations')->where('channel', 'B2B')->where('client_id', $agency->crm_client_id)->whereNull('agency_id')->exists())->toBeFalse();
            }
        }

        $terms = json_decode((string) DB::table('booking_reservations')->where('code', 'RES-2026-000345')->value('b2b_terms'), true);
        expect($terms['pay_mode'] ?? null)->toBe('credito');
    });
});

it('MET-BR-10: el bono estimado de una meta vigente sale del % vendido, no de la proyección con pipeline', function () {
    actingAsSeed('U01');
    $targets = collect($this->getJson('/api/v1/crm/sales-targets')->assertOk()->json('data.targets') ?? []);
    $policy = withinTenant(tenantA(), fn () => DB::table('crm_sales_target_policies')->value('tiers'));
    $tiers = $policy ? json_decode((string) $policy, true) : [['min' => 90, 'pay' => 50], ['min' => 100, 'pay' => 100], ['min' => 120, 'pay' => 130]];
    $live = $targets->filter(fn (array $target): bool => $target['bonus'] !== null && $target['status'] === 'vigente');

    if ($live->isEmpty()) {
        $this->markTestSkipped('La demo no tiene metas vigentes con bono.');
    }

    foreach ($live as $target) {
        $expected = collect($tiers)->filter(fn (array $tier): bool => $target['progress_pct'] >= $tier['min'])->max('pay') ?? 0;
        expect($target['bonus']['pct'])->toBe((int) $expected);
    }
});

it('la boleta observada de la demo registra su envío al OSE', function () {
    actingAsSeed('U01');
    $invoice = $this->getJson('/api/v1/finance/invoices/B001-00008812')->assertOk()->json('data');

    expect($invoice['status'])->toBe('observado')
        ->and($invoice['fiscal_events'])->not->toBeEmpty()
        ->and($invoice['fiscal_events'][0]['response_code'])->toBe('4287');
});

it('la demo no tiene servicios completados con fecha futura y cada cotización enviada abierta tiene enlace activo', function () {
    withinTenant(tenantA(), function (): void {
        $today = Carbon::today('America/Lima')->toDateString();
        expect(DB::table('booking_reservation_services')->where('status', 'completado')->where('service_date', '>=', $today)->whereNull('confirmation_code')->exists())->toBeFalse();

        $orphans = DB::table('quote_quotes as q')->whereNull('q.deleted_at')->whereNotIn('q.status', ['borrador', 'convertida', 'rechazada', 'cancelada'])
            ->whereExists(fn ($query) => $query->from('quote_sends as s')->whereColumn('s.quote_id', 'q.id'))
            ->whereNotExists(fn ($query) => $query->from('quote_access_tokens as a')->whereColumn('a.quote_id', 'q.id')->whereNull('a.revoked_at'))
            ->pluck('q.code');
        expect($orphans->all())->toBe([]);

        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        preg_match('/hasta el (\d{1,2}) de (\p{L}+)/u', (string) DB::table('cms_contents')->where('code', 'CMS-02')->value('body'), $match);
        $deadline = Carbon::create(2026, array_search($match[2] ?? '', $months, true) + 1, (int) ($match[1] ?? 1));
        expect($deadline->greaterThanOrEqualTo(Carbon::today('America/Lima')))->toBeTrue();
    });
});
