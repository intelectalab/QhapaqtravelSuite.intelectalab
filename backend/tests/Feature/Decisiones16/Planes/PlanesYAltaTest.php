<?php

use App\Domain\Platform\Support\Entitlements;
use App\Domain\Tracking\Support\TrackingPlan;
use App\Http\Middleware\EnsureFeature;
use Database\Seeders\PlanCatalogAdditionsSeeder;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

require_once __DIR__.'/../../Fase3/Seguimiento/SeguimientoHelpers.php';

beforeEach(function () {
    lockPlatformBilling();
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function planes16Db(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function planes16Plan(string $code, string $status = 'active'): object
{
    $db = planes16Db();
    $tenant = tenantA()->getKey();
    $planId = $db->table('plans')->where('code', $code)->value('id');
    $today = Carbon::today('America/Lima');
    $db->table('subscriptions')->where('tenant_id', $tenant)->where('status', '<>', 'canceled')->update([
        'plan_id' => $planId,
        'cycle' => 'monthly',
        'status' => $status,
        'coupon_redemption_id' => null,
        'current_period_start' => $today->copy()->subDays(10)->toDateString(),
        'current_period_end' => $today->copy()->addDays(19)->toDateString(),
    ]);
    $db->table('subscription_items')->whereIn('subscription_id', $db->table('subscriptions')->where('tenant_id', $tenant)->pluck('id'))->delete();
    $db->table('tenants')->where('id', $tenant)->update(['plan_id' => $planId]);
    Entitlements::flush();

    return $db->table('subscriptions')->where('tenant_id', $tenant)->where('status', '<>', 'canceled')->first();
}

function planes16Item(string $addon): ?object
{
    $subscription = planes16Db()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->where('status', '<>', 'canceled')->value('id');

    return planes16Db()->table('subscription_items')->where('subscription_id', $subscription)->where('addon_code', $addon)->whereNull('ends_at')->first();
}

it('O3 y O4: Starter usa Plantillas, Contenido con IA, Seguimiento y Visitas; Blog, Campañas y Reportes siguen fuera', function () {
    actingAsSeed('U01');
    planes16Plan('starter');

    $this->getJson('/api/v1/cms/templates')->assertOk();
    $this->getJson('/api/v1/cms/theme')->assertOk();
    $this->getJson('/api/v1/cms/ai/credits')->assertOk()->assertJsonPath('data.plan_included.contenido', 0);
    $this->getJson('/api/v1/marketing/tracking/tags')->assertOk()->assertJsonPath('data.plan.full', false);
    $this->getJson('/api/v1/analytics/web/overview')->assertOk()->assertJsonPath('data.can_export', false);

    expect($this->getJson('/api/v1/marketing/campaigns'))->toBeApiError(403, EnsureFeature::CODE)
        ->and($this->getJson('/api/v1/reports/kpis'))->toBeApiError(403, EnsureFeature::CODE)
        ->and($this->getJson('/api/v1/analytics/web/export'))->toBeApiError(422, 'TRACKING_PLAN_REQUIRED');

    $locked = $this->getJson('/api/v1/me/access')->assertOk()->json('data.locked');
    expect($locked)->toHaveKeys(['/reportes', '/marketing', '/canales/cms', '/canales/seo', '/canales/aventuras'])
        ->and($locked['/reportes/visitas'])->toBeNull()
        ->and($locked)->not->toHaveKeys(['/canales/plantillas', '/canales/contenido-ia', '/canales/seguimiento']);

    expect(EnsureFeature::featureForPath('api/v1/cms/ai/jobs'))->toBe('module.ai_content')
        ->and(EnsureFeature::featureForPath('api/v1/cms/theme/tokens'))->toBe('module.site_templates')
        ->and(EnsureFeature::featureForPath('api/v1/cms/contents'))->toBe('module.cms')
        ->and(EnsureFeature::featureForPath('api/v1/marketing/tracking/tags'))->toBe('module.web_tracking')
        ->and(EnsureFeature::featureForScreen('/reportes/visitas'))->toBe('module.web_analytics');
});

it('O3: Pacífico pide Professional en Starter (TEMPLATE_PLAN_REQUIRED) y la premium se cobra como ítem de pago único con IGV (TPL-04)', function () {
    actingAsSeed('U01');
    planes16Plan('starter');
    foreach (['TPL-PACIFICO', 'TPL-NAZCA'] as $code) {
        $versionId = planes16Db()->table('platform_site_templates')->where('code', $code)->value('current_version_id');
        $manifest = json_decode((string) planes16Db()->table('platform_site_template_versions')->where('id', $versionId)->value('manifest'), true);
        planes16Db()->table('platform_site_template_versions')->where('id', $versionId)->update(['manifest' => json_encode([...$manifest, 'site_style' => 'andes'])]);
    }

    $lock = (int) $this->getJson('/api/v1/cms/theme')->json('data.lock_version');
    expect($this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-PACIFICO'], ['If-Match' => (string) $lock]))->toBeApiError(422, 'TEMPLATE_PLAN_REQUIRED');

    $gallery = collect($this->getJson('/api/v1/cms/templates')->assertOk()->json('data'))->keyBy('code');

    expect($gallery['TPL-PACIFICO']['plan_allowed'])->toBeFalse()
        ->and($gallery['TPL-PACIFICO']['min_plan']['name'])->toBe('Professional')
        ->and($gallery['TPL-ANDES']['plan_allowed'])->toBeTrue()
        ->and($gallery['TPL-NAZCA']['plan_allowed'])->toBeTrue();

    $before = planes16Db()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->count();
    $result = $this->postJson('/api/v1/cms/templates/TPL-NAZCA/purchase', [], critical())->assertOk()->json('data');
    $invoice = planes16Db()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->orderByDesc('number')->first();
    $item = planes16Item('premium_template');

    expect($result['billing']['invoice'])->toStartWith('FQ01-')
        ->and(planes16Db()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->count())->toBe($before + 1)
        ->and($invoice->kind)->toBe('addon')
        ->and((string) $invoice->subtotal)->toBe('290.00')
        ->and((string) $invoice->igv)->toBe('52.20')
        ->and((string) $invoice->total)->toBe('342.20')
        ->and($item->billing_mode)->toBe('unico')
        ->and((int) $item->quantity)->toBe(1)
        ->and(json_decode((string) $item->meta, true)['purchases'][0]['template'])->toBe('TPL-NAZCA');
});

it('O3: los paquetes de IA van a la factura como pago único y los planes IA Básico o IA Pro como complemento mensual', function () {
    actingAsSeed('U01');
    planes16Plan('professional');

    $pack = $this->postJson('/api/v1/cms/ai/packs/IA-CONT-EXTRA-200/purchase', [], critical())->assertOk()->json('data');
    expect($pack['billing']['invoice'])->toStartWith('FQ01-')
        ->and(planes16Item('ai_credit_pack')->billing_mode)->toBe('unico')
        ->and((int) planes16Item('ai_credit_pack')->quantity)->toBe(1);

    $this->postJson('/api/v1/cms/ai/packs/IA-CONT-EXTRA-200/purchase', [], critical())->assertOk();
    expect((int) planes16Item('ai_credit_pack')->quantity)->toBe(2)
        ->and(json_decode((string) planes16Item('ai_credit_pack')->meta, true)['purchases'])->toHaveCount(2);

    $this->postJson('/api/v1/cms/ai/packs/IA-PRO/purchase', [], critical())->assertOk();
    $plan = planes16Item('ai_content');
    expect($plan->billing_mode)->toBe('mensual')
        ->and((string) $plan->unit_price)->toBe('149.00')
        ->and(json_decode((string) $plan->meta, true)['pack'])->toBe('IA-PRO');

    expect($this->postJson('/api/v1/billing/addons/ai_content', [], critical()))->toBeApiError(422, 'ADDON_MANAGED_ELSEWHERE');
    expect(collect($this->getJson('/api/v1/billing/subscription')->json('data.addon_catalog'))->pluck('code'))->not->toContain('ai_content', 'premium_template', 'ai_credit_pack');
});

it('O3: sin saldo responde 429 AI_CREDITS_EXHAUSTED con la oferta de planes y paquetes', function () {
    withinTenant(tenantA(), function (): void {
        $balance = (int) DB::table('fin_ai_credit_ledger')->where('kind', 'imagenes')->orderByDesc('occurred_at')->orderByDesc('id')->value('balance_after');
        DB::table('fin_ai_credit_ledger')->insert(['kind' => 'imagenes', 'movement' => 'ajuste', 'credits' => -$balance, 'balance_after' => 0, 'note' => 'Prueba', 'occurred_at' => now()->addMinute()]);
    });
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/cms/ai/images', ['prompt' => 'Cañón del Colca al amanecer con cóndores', 'style' => 'fotografico', 'count' => 4, 'quality' => 'hd'], critical());

    expect($response)->toBeApiError(429, 'AI_CREDITS_EXHAUSTED');
    expect($response->json('details.manage_path'))->toBe('/canales/contenido-ia/planes')
        ->and(collect($response->json('details.offer'))->pluck('code'))->toContain('IA-IMG-20')
        ->and($response->json('message'))->toContain('+ IGV');
});

it('O3: al empezar el mes vencen los créditos mensuales sin usar y se asignan los incluidos en el plan una sola vez', function () {
    actingAsSeed('U01');
    planes16Plan('enterprise');
    Carbon::setTestNow(Carbon::parse('2026-10-05 10:00', 'America/Lima'));

    $balances = $this->getJson('/api/v1/cms/ai/credits')->assertOk()->json('data.balances');
    $this->getJson('/api/v1/cms/ai/credits')->assertOk();

    $ledger = withinTenant(tenantA(), fn () => DB::table('fin_ai_credit_ledger')->where('kind', 'contenido')->where('occurred_at', '>=', Carbon::parse('2026-10-01', 'America/Lima')->utc())->orderBy('occurred_at')->orderBy('id')->get());

    expect($balances['contenido']['balance'])->toBe(100)
        ->and($ledger->pluck('movement')->all())->toBe(['vencimiento', 'asignacion_plan'])
        ->and((int) $ledger[0]->credits)->toBe(-394)
        ->and((int) $ledger[1]->credits)->toBe(100);
});

it('O4: Marketing Pro se ofrece a Starter, viene incluido en Professional y Enterprise, y al contratarlo habilita todo el seguimiento', function () {
    $addon = planes16Db()->table('addons')->where('code', 'marketing_pro')->first();
    $plans = planes16Db()->table('plans')->pluck('id', 'code');

    expect((string) $addon->price_month)->toBe('39.00')
        ->and($addon->available_plans)->toContain($plans['starter'])
        ->and($addon->included_plans)->toContain($plans['professional'])->toContain($plans['enterprise']);

    actingAsSeed('U01');
    planes16Plan('starter');
    $this->postJson('/api/v1/billing/addons/marketing_pro', [], critical())->assertSuccessful();

    withinTenant(tenantA(), fn () => expect(app(TrackingPlan::class)->full())->toBeTrue());
    $this->getJson('/api/v1/analytics/web/overview')->assertOk()->assertJsonPath('data.can_export', true);
});

it('O3 y O4: al bajar de plan la vista previa avisa lo que cambia sin bloquear', function () {
    actingAsSeed('U01');
    planes16Plan('enterprise');

    $preview = $this->postJson('/api/v1/billing/subscription/preview-change', ['plan' => 'starter', 'cycle' => 'monthly'])->assertOk()->json('data');
    $warnings = implode(' | ', $preview['warnings']);

    expect($warnings)->toContain('Los créditos de IA incluidos bajan de 100 a 0 al mes')
        ->and($warnings)->toContain('Visitas del sitio mostrará solo los últimos 30 días')
        ->and($warnings)->toContain('Marketing Pro (S/ 39.00 al mes + IGV)');

    $up = $this->postJson('/api/v1/billing/subscription/preview-change', ['plan' => 'enterprise', 'cycle' => 'annual'])->assertOk()->json('data');
    expect($up['warnings'])->toBe([]);
});

it('Semilla del catálogo: solo agrega lo que falta y no pisa lo editado en la consola (O3, O4, O8)', function () {
    $db = planes16Db();
    $db->table('plan_features')->where('feature_key', 'module.web_analytics')->delete();
    $db->table('features')->where('key', 'module.web_analytics')->delete();

    (new PlanCatalogAdditionsSeeder)->run();
    (new PlanCatalogAdditionsSeeder)->run();

    $coupon = $db->table('coupons')->where('code', 'KIPUTURISMO2026')->first();
    $plans = $db->table('plans')->pluck('id', 'code');

    expect($db->table('features')->where('key', 'module.web_analytics')->count())->toBe(1)
        ->and($db->table('plan_features')->where('feature_key', 'module.web_analytics')->count())->toBe(3)
        ->and($coupon)->not->toBeNull()
        ->and((string) $coupon->value)->toBe('10.00')
        ->and((int) $coupon->duration_cycles)->toBe(1)
        ->and($coupon->max_redemptions)->toBeNull()
        ->and($coupon->valid_to)->toBe('2026-12-31')
        ->and($coupon->plan_ids)->toContain($plans['starter'])->toContain($plans['professional'])->not->toContain($plans['enterprise'])
        ->and($coupon->note)->toBe('Bienvenida de la landing (spec 25 §5.1)');

    $db->table('coupons')->where('code', 'KIPUTURISMO2026')->update(['value' => 15, 'status' => 'inactive']);
    (new PlanCatalogAdditionsSeeder)->run();

    expect((string) $db->table('coupons')->where('code', 'KIPUTURISMO2026')->value('value'))->toBe('15.00')
        ->and($db->table('coupons')->where('code', 'KIPUTURISMO2026')->value('status'))->toBe('inactive')
        ->and($db->table('coupons')->where('code', 'KIPUTURISMO2026')->count())->toBe(1);
});

it('O8: el cupón vencido avisa con su código y fecha', function () {
    (new PlanCatalogAdditionsSeeder)->run();
    planes16Db()->table('coupons')->where('code', 'KIPUTURISMO2026')->update(['valid_to' => '2026-09-01']);

    $response = $this->postJson('/api/v1/public/coupons/validate', ['coupon' => 'kiputurismo2026', 'plan' => 'starter', 'cycle' => 'mensual']);

    expect($response)->toBeApiError(422, 'COUPON_INVALID');
    expect($response->json('message'))->toBe('El cupón KIPUTURISMO2026 venció el 01/09/2026.');
});

it('O7: el alta de la landing es solo con RUC y factura; no acepta boleta', function () {
    segCleanSlate();
    $body = [
        'plan' => 'starter',
        'cycle' => 'prueba',
        'admin_name' => 'Rosa Mamani',
        'email' => 'rosa@viajesnuevos.pe',
        'password' => 'Lago-Titicaca-2026',
        'commercial_name' => 'Viajes Nuevos Puno',
        'ruc' => segRuc('1045678912'),
        'city' => 'Puno',
        'business_type' => 'Operador turístico',
        'accept_terms' => true,
        'terms_version' => 'TYC-2026.1',
    ];

    expect($this->postJson('/api/v1/public/signups', [...$body, 'doc_type' => 'boleta'], critical()))->toBeApiError(422);

    $signup = $this->postJson('/api/v1/public/signups', $body, critical())->assertCreated()->json('data');
    $tenant = planes16Db()->table('tenants')->where('code', $signup['tenant'])->first();

    expect(planes16Db()->table('subscriptions')->where('tenant_id', $tenant->id)->value('billing_doc_type'))->toBe('Factura')
        ->and(json_decode((string) $tenant->settings, true)['signup']['doc_type'])->toBe('factura');
});

it('O7: Mi suscripción factura a otro RUC, también 10, y nunca emite boleta', function () {
    actingAsSeed('U01');
    planes16Plan('professional');
    $body = ['ruc' => segRuc('1045678912'), 'name' => 'Mariela Quispe Rojas', 'address' => 'Jr. Puno 120, Cusco', 'email' => 'facturas@andeshorizonte.pe'];

    expect($this->patchJson('/api/v1/billing/subscription', [...$body, 'doc_type' => 'Boleta']))->toBeApiError(422, 'SUB-BR-09');
    $this->patchJson('/api/v1/billing/subscription', $body)->assertOk();

    expect($this->getJson('/api/v1/billing/subscription')->json('data.subscription.billing'))->toMatchArray(['ruc' => $body['ruc'], 'doc_type' => 'Factura']);
});
