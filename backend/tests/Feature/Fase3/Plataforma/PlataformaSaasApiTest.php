<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/PlataformaHelpers.php';

function p3OAuthPayload(array $extra = []): array
{
    return ['name' => 'Conector contable', 'vendor' => 'Contasis Cloud', 'scopes' => ['reservations:read', 'invoices:read'], 'redirect_uris' => ['https://contasis.example.com/oauth/callback'], ...$extra];
}

function p3PlatformInvoice(): object
{
    return DB::connection('pgsql_platform')->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->where('status', '<>', 'draft')->orderBy('issue_date')->first();
}

it('registra una aplicación OAuth, muestra el secreto una vez, lo rota y la revoca con auditoría', function () {
    actingAsSeed('U01');

    $created = $this->postJson('/api/v1/integrations/oauth-apps', p3OAuthPayload())->assertCreated()->json('data');
    expect($created['secret'])->toStartWith('kcs_');

    $client = withinTenant(tenantA(), fn () => DB::table('oauth_clients')->where('id', $created['client_id'])->first());
    expect($client->secret)->toBe(hash('sha256', $created['secret']))->and($client->revoked)->toBeFalse();

    $list = $this->getJson('/api/v1/integrations/oauth-apps')->assertOk()->json();
    $app = collect($list['data'])->firstWhere('id', $created['id']);
    expect($app['status'])->toBe('active')->and($app)->not->toHaveKey('secret')->and($list['meta']['scopes'])->not->toBeEmpty();

    $rotated = $this->postJson("/api/v1/integrations/oauth-apps/{$created['id']}/secret")->assertOk()->json('data');
    expect($rotated['secret'])->not->toBe($created['secret'])
        ->and(withinTenant(tenantA(), fn () => DB::table('oauth_clients')->where('id', $created['client_id'])->value('secret')))->toBe(hash('sha256', $rotated['secret']));

    $this->deleteJson("/api/v1/integrations/oauth-apps/{$created['id']}")->assertNoContent();
    expect(withinTenant(tenantA(), fn () => DB::table('integration_oauth_apps')->where('id', $created['id'])->value('status')))->toBe('revoked');
    expect($this->postJson("/api/v1/integrations/oauth-apps/{$created['id']}/secret"))->toBeApiError(409, 'API-BR-09');
    expect(p3Audited(['entity' => 'App OAuth', 'entity_id' => $created['client_id'], 'action' => 'rotar_secreto']))->toBeTrue()
        ->and(p3Audited(['entity' => 'App OAuth', 'entity_id' => $created['client_id'], 'action' => 'revocar']))->toBeTrue();
});

it('valida la aplicación OAuth y exige permiso de API y plan con OAuth', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/integrations/oauth-apps', p3OAuthPayload(['redirect_uris' => ['http://inseguro.example.com']]))->assertUnprocessable()->assertJsonValidationErrors('redirect_uris.0');
    $this->postJson('/api/v1/integrations/oauth-apps', p3OAuthPayload(['scopes' => ['todo:admin']]))->assertUnprocessable();

    actingAsSeed('U02');
    expect($this->getJson('/api/v1/integrations/oauth-apps'))->toBeApiError(403);
    expect($this->getJson('/api/v1/integrations/oauth-apps')->json('required_permissions'))->toContain('admin.api.manage');

    actingAsTenantBAdmin();
    expect($this->postJson('/api/v1/integrations/oauth-apps', p3OAuthPayload()))->toBeApiError(403, 'FEATURE_NOT_IN_PLAN');
});

it('lista las entregas de webhooks paginadas y filtradas por estado', function () {
    actingAsSeed('U01');

    $page = $this->getJson('/api/v1/integrations/webhook-deliveries?filter[status]=delivered&page[size]=5')->assertOk()->json();
    expect(collect($page['data'])->pluck('status')->unique()->all())->toBe($page['data'] === [] ? [] : ['delivered'])
        ->and($page['meta'])->toHaveKeys(['totals', 'next_cursor'])
        ->and(count($page['data']))->toBeLessThanOrEqual(5);

    expect($this->getJson('/api/v1/integrations/webhook-deliveries?filter[status]=perdido'))->toBeApiError(422, 'FILTER_INVALID');
});

it('entrega el PDF de una factura de la suscripción como URL firmada o archivo', function () {
    Storage::fake((string) config('filesystems.default'), ['serve' => true]);
    actingAsSeed('U01');
    $invoice = p3PlatformInvoice();
    $number = $invoice->series.'-'.str_pad((string) $invoice->number, 8, '0', STR_PAD_LEFT);

    $json = $this->getJson("/api/v1/billing/invoices/{$number}/pdf")->assertOk()->json('data');
    expect($json['file_name'])->toBe("Factura-{$number}.pdf")->and($json['mime_type'])->toBe('application/pdf');

    $this->get("/api/v1/billing/invoices/{$number}/pdf", ['Accept' => 'application/pdf'])->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(p3Audited(['entity' => 'Factura de plataforma', 'entity_id' => $number, 'action' => 'generar_pdf']))->toBeTrue();
    $this->getJson('/api/v1/billing/invoices/ZZZZ-00000001/pdf')->assertNotFound();
});

it('publica el contrato OpenAPI 3.1 sin iniciar sesión', function () {
    $response = $this->getJson('/api/v1/docs/openapi.json')->assertOk();

    expect($response->json('openapi'))->toBe('3.1.0')->and($response->headers->get('ETag'))->not->toBeEmpty();
    $this->getJson('/api/v1/docs/openapi.json', ['If-None-Match' => $response->headers->get('ETag')])->assertStatus(304);
});

it('la consola lista y quita excepciones por agencia, y muestra la política de cobranza y el entitlement por plan', function () {
    lockPlatformBilling();
    Queue::fake();
    actingAsPlatform();
    $this->postJson('/api/v1/platform/feature-overrides', ['tenant' => 'TNT-0002', 'feature' => 'module.oauth_apps', 'value' => true, 'reason' => 'Piloto de integración contable', 'valid_until' => Carbon::today()->addDays(30)->toDateString()])->assertCreated();

    $list = $this->getJson('/api/v1/platform/feature-overrides?filter[tenant]=TNT-0002')->assertOk()->json();
    expect(collect($list['data'])->pluck('feature.key'))->toContain('module.oauth_apps');

    $this->deleteJson('/api/v1/platform/feature-overrides', ['tenant' => 'TNT-0002', 'feature' => 'module.oauth_apps'])->assertNoContent();
    expect(DB::connection('pgsql_platform')->table('feature_overrides')->where('tenant_id', tenantB()->getKey())->where('feature_key', 'module.oauth_apps')->exists())->toBeFalse();
    $this->deleteJson('/api/v1/platform/feature-overrides', ['tenant' => 'TNT-0002', 'feature' => 'module.oauth_apps'])->assertNotFound();

    $policy = $this->getJson('/api/v1/platform/dunning-policy')->assertOk()->json('data');
    expect($policy['retry_days'])->not->toBeEmpty()->and($policy['steps'][0]['label'])->toStartWith('D+');

    $feature = $this->getJson('/api/v1/platform/features/module.oauth_apps/plans/enterprise')->assertOk()->json('data');
    expect($feature['included'])->toBeTrue()->and($feature['plan_id'])->toBe('enterprise');
    expect($this->getJson('/api/v1/platform/features/module.oauth_apps/plans/starter')->json('data.included'))->toBeFalse();
    $this->getJson('/api/v1/platform/features/module.nada/plans/starter')->assertNotFound();
});

it('la consola edita un cupón por código y un plan de forma parcial', function () {
    lockPlatformBilling();
    actingAsPlatform();
    $coupon = DB::connection('pgsql_platform')->table('coupons')->where('status', 'active')->orderBy('code')->first();

    $this->patchJson('/api/v1/platform/coupons', ['code' => $coupon->code, 'active' => false])->assertOk();
    expect(DB::connection('pgsql_platform')->table('coupons')->where('id', $coupon->id)->value('status'))->toBe('inactive');
    $this->patchJson('/api/v1/platform/coupons', ['active' => true])->assertUnprocessable();

    $before = DB::connection('pgsql_platform')->table('plans')->where('code', 'starter')->first();
    $plan = $this->patchJson('/api/v1/platform/plans/starter', ['trial_days' => 21])->assertOk()->json('data');
    expect((int) $plan['trial_days'])->toBe(21)->and((string) $plan['price_month'])->toBe((string) $before->price_month);
    $this->patchJson('/api/v1/platform/plans/starter', ['trial_days' => 90])->assertUnprocessable();
    $this->patchJson('/api/v1/platform/plans/nada', ['trial_days' => 10])->assertNotFound();
});
