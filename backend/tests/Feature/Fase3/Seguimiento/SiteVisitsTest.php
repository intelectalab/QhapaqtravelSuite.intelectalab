<?php

use App\Domain\Shared\Jobs\JobCatalog;
use App\Domain\Tracking\Actions\RecordCookieConsent;
use App\Domain\Tracking\Support\AnalyticsScope;
use App\Domain\Tracking\Support\WebAnalyticsRollup;
use App\Jobs\AggregatePlatformWebAnalytics;
use App\Jobs\AggregateWebAnalytics;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

require_once __DIR__.'/SeguimientoHelpers.php';

beforeEach(function () {
    lockWebAnalytics();
    segCleanSlate();
    $GLOBALS['segVisitor'] = bin2hex(random_bytes(6));

    foreach (['tenant:'.tenantA()->getKey(), 'tenant:'.tenantB()->getKey(), 'platform:vitrina', 'platform:todos'] as $key) {
        Cache::forget('web-live:'.$key);
    }
});

const SEG_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function segBrowser(string $base = SEG_BROWSER): string
{
    return $base.' KipuTest/'.$GLOBALS['segVisitor'];
}

function segHit(array $body, array $headers = []): TestResponse
{
    return test()->postJson('/api/v1/public/analytics/hit', $body, siteOf(extra: ['User-Agent' => segBrowser(), 'CF-IPCountry' => 'PE', ...$headers]));
}

it('VIS-01 y VIS-02: cuenta la visita sin cookies, suma páginas vistas y deja de contar el rebote', function () {
    segHit(['path' => '/', 'gclid' => 'Cj0KCQ-test'])->assertStatus(202)->assertJsonPath('data.new_visit', true);
    segHit(['path' => '/tours/machu-picchu-2d'])->assertStatus(202)->assertJsonPath('data.new_visit', false);
    segHit(['path' => '/', 'kind' => 'engagement', 'seconds' => 45])->assertStatus(202);
    segHit(['path' => '/checkout', 'kind' => 'conversion', 'value' => 2380])->assertStatus(202);
    segHit(['path' => '/'], ['User-Agent' => 'Googlebot/2.1 (+http://www.google.com/bot.html)'])->assertJsonPath('data.counted', false);

    segAggregate();
    actingAsSeed('U01');
    $overview = $this->getJson('/api/v1/analytics/web/overview?days=7')->assertOk()->json('data');

    expect($overview['kpis']['visits'])->toBe(1)
        ->and($overview['kpis']['visitors'])->toBe(1)
        ->and($overview['kpis']['pageviews'])->toBe(2)
        ->and($overview['kpis']['bounces'])->toBe(0)
        ->and($overview['kpis']['engaged_seconds'])->toBe(45)
        ->and($overview['kpis']['conversions'])->toBe(1)
        ->and($overview['kpis']['revenue'])->toBe('2380.00')
        ->and($overview['trend'])->toHaveCount(7)
        ->and($overview['realtime']['visitors'])->toBe(1);

    $pages = collect($this->getJson('/api/v1/analytics/web/pages?days=7')->assertOk()->json('data'))->pluck('pageviews', 'path');
    expect($pages['/'])->toBe(1)->and($pages['/tours/machu-picchu-2d'])->toBe(1);

    $sources = $this->getJson('/api/v1/analytics/web/sources?days=7')->assertOk()->json('data');
    expect($sources[0]['source'])->toBe('google')->and($sources[0]['medium'])->toBe('cpc');

    $devices = $this->getJson('/api/v1/analytics/web/devices?days=7')->assertOk()->json('data');
    expect($devices['devices'][0]['device'])->toBe('escritorio')->and($devices['countries'][0]['country'])->toBe('PE');
    $this->getJson('/api/v1/analytics/web/realtime')->assertOk()->assertJsonPath('data.visitors', 1);
});

it('VIS-03: la fuente sale de la UTM, del referente o queda como directo', function () {
    segHit(['path' => '/', 'referrer' => 'https://www.instagram.com/rutas'], ['User-Agent' => segBrowser(SEG_BROWSER.' Instagram')])->assertStatus(202);
    segAggregate();
    actingAsSeed('U01');

    $sources = $this->getJson('/api/v1/analytics/web/sources?days=7')->assertOk()->json('data');
    expect($sources[0]['source'])->toBe('instagram')->and($sources[0]['medium'])->toBe('social');
});

it('VIS: el CHECK impide más visitantes que visitas', function () {
    expect(fn () => withinTenant(tenantA(), fn () => DB::table('cms_web_analytics_daily')->insert(['day' => '2026-09-29', 'path' => '/', 'device' => 'movil', 'visits' => 1, 'visitors' => 3, 'pageviews' => 1])))->toThrow(QueryException::class);
});

it('exporta el CSV del periodo y la exportación queda auditada', function () {
    segHit(['path' => '/'])->assertStatus(202);
    segAggregate();
    actingAsSeed('U01');

    $response = $this->get('/api/v1/analytics/web/export?days=7');
    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('text/csv')
        ->and($response->getContent())->toContain('fecha;visitas;visitantes');
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Visitas', 'action' => 'exportar'])->exists()))->toBeTrue();
});

it('Ventas ve las visitas, Operaciones no y la agencia B no ve las visitas de A', function () {
    segHit(['path' => '/'])->assertStatus(202);

    actingAsSeed('U03');
    $this->getJson('/api/v1/analytics/web/overview')->assertOk();

    actingAsSeed('U05');
    $denied = $this->getJson('/api/v1/analytics/web/overview');
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('analytics.web.view');

    actingAsTenantBAdmin();
    expect($this->getJson('/api/v1/analytics/web/overview?days=7')->assertOk()->json('data.kpis.visits'))->toBe(0);
});

it('guarda la elección del banner de cookies con la versión de la política', function () {
    $visitor = '01938a8e-0000-7000-8000-000000000001';

    $saved = $this->postJson('/api/v1/public/consent', ['visitor_id' => $visitor, 'analytics' => true, 'marketing' => false, 'policy_version' => 'COOK-2026.2'], siteOf())->assertCreated()->json('data');
    expect($saved['visitor_id'])->toBe($visitor)->and($saved['marketing'])->toBeFalse();
    expect(withinTenant(tenantA(), fn () => RecordCookieConsent::marketingGranted($visitor)))->toBeFalse();

    $this->postJson('/api/v1/public/consent', ['visitor_id' => $visitor, 'analytics' => true, 'marketing' => true, 'policy_version' => 'COOK-2026.2'], siteOf())->assertCreated();
    expect(withinTenant(tenantA(), fn () => RecordCookieConsent::marketingGranted($visitor)))->toBeTrue();
    expect(withinTenant(tenantB(), fn () => DB::table('cms_cookie_consents')->where('visitor_id', $visitor)->exists()))->toBeFalse();

    $this->postJson('/api/v1/public/consent', ['analytics' => false, 'marketing' => false, 'policy_version' => 'COOK-2026.2', 'site' => 'vitrina'])->assertCreated();
    expect(DB::connection('pgsql_platform')->table('platform_cookie_consents')->where('site', 'vitrina')->exists())->toBeTrue();
    expect($this->postJson('/api/v1/public/consent', ['analytics' => 'x'], siteOf()))->toBeApiError(422);
});

it('SEG-01 y SEG-05: el sitio recibe Consent Mode denegado y en el pago no carga ningún script ni etiqueta de marketing', function () {
    actingAsSeed('U02');
    $script = $this->postJson('/api/v1/marketing/tracking/tags', ['provider' => 'script', 'name' => 'Chat de ventas', 'script_body' => 'window.chatVentas = true;', 'csp_domains' => 'chat.example.com', 'submit' => true], critical())->assertCreated()->json('data');
    actingAsSeed('U01');
    $this->postJson("/api/v1/marketing/tracking/tags/{$script['code']}/decision", ['decision' => 'aprobar'])->assertOk();
    $this->postJson('/api/v1/marketing/tracking/tags', ['provider' => 'ga4', 'name' => 'Analytics', 'measurement_id' => 'G-AH7K2M9Q1T', 'exclude' => '/cuenta/*'], critical())->assertCreated();

    $home = $this->getJson('/api/v1/public/site/tags?path=/', siteOf())->assertOk()->json('data');
    expect($home['consent_defaults']['ad_storage'])->toBe('denied')
        ->and(collect($home['tags'])->pluck('provider')->all())->toEqualCanonicalizing(['ga4', 'script'])
        ->and($home['csp_domains'])->toContain('chat.example.com')
        ->and(json_encode($home))->not->toContain('secret');

    expect($this->getJson('/api/v1/public/site/tags?path=/checkout/WEB-00001', siteOf())->assertOk()->json('data.tags'))->toBe([]);
    expect(collect($this->getJson('/api/v1/public/site/tags?path=/cuenta/reservas', siteOf())->assertOk()->json('data.tags'))->pluck('provider')->all())->toBe(['script']);
});

it('cuenta las visitas de la vitrina sin agencia y las muestra en la consola', function () {
    $this->postJson('/api/v1/public/analytics/hit', ['path' => '/lima', 'site' => 'vitrina', 'utm_source' => 'tiktok', 'utm_medium' => 'paid', 'utm_campaign' => 'free-tours-lima'], ['User-Agent' => segBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148')])->assertStatus(202);

    segAggregate();
    actingAsPlatform();
    $overview = $this->getJson('/api/v1/platform/analytics/web/overview?site=vitrina&days=7')->assertOk()->json('data');

    expect($overview['kpis']['visits'])->toBe(1)
        ->and($overview['sources'][0]['campaign'])->toBe('free-tours-lima')
        ->and($overview['devices']['devices'][0]['device'])->toBe('movil');
});

it('VIS-04: el reporte lee el agregado, que el job recalcula cada hora; lo en vivo sale de los últimos 30 minutos', function () {
    segHit(['path' => '/'])->assertStatus(202);
    segHit(['path' => '/tours'])->assertStatus(202);
    actingAsSeed('U01');

    $before = $this->getJson('/api/v1/analytics/web/overview?days=7')->assertOk()->json('data');
    expect($before['kpis']['visits'])->toBe(0)->and($before['realtime']['visitors'])->toBe(1)->and($before['computed_at'])->toBeNull();

    $job = (new AggregateWebAnalytics)->forTenant((string) tenantA()->getKey());
    withinTenant(tenantA(), fn () => $job->handle());
    expect($job->runResult)->toContain('2 filas');

    $after = $this->getJson('/api/v1/analytics/web/overview?days=7')->assertOk()->json('data');
    expect($after['kpis']['visits'])->toBe(1)->and($after['kpis']['pageviews'])->toBe(2)->and($after['kpis']['bounces'])->toBe(0)->and($after['computed_at'])->not->toBeNull();

    expect(JobCatalog::TENANT['JOB-WEB-5'])->toMatchArray(['class' => AggregateWebAnalytics::class, 'cron' => '0 * * * *', 'queue' => 'reports'])
        ->and(JobCatalog::PLATFORM['PLT-VIS-1'])->toMatchArray(['class' => AggregatePlatformWebAnalytics::class, 'cron' => '0 * * * *']);
});

it('VIS-04: a las 03:00 recalcula el día anterior y depura los movimientos ya consolidados', function () {
    $scope = AnalyticsScope::tenant((string) tenantA()->getKey());
    $night = CarbonImmutable::now('America/Lima')->setTime(3, 0);
    $yesterday = $night->subDay()->toDateString();
    $old = $night->subDays(3)->toDateString();
    $row = ['path' => '/', 'device' => 'movil', 'visits' => 1, 'visitors' => 1, 'pageviews' => 1, 'bounces' => 1];

    withinTenant(tenantA(), function () use ($scope, $night, $yesterday, $old, $row): void {
        DB::table('cms_web_analytics_hits')->insert([[...$row, 'day' => $yesterday], [...$row, 'day' => $yesterday, 'visits' => 0, 'visitors' => 0, 'bounces' => -1], [...$row, 'day' => $old]]);

        expect(app(WebAnalyticsRollup::class)->run($scope, $night->setTime(14, 0)))->toHaveKey($night->toDateString())->not->toHaveKey($yesterday);
        expect(app(WebAnalyticsRollup::class)->run($scope, $night))->toHaveKeys([$night->toDateString(), $yesterday]);

        $day = DB::table('cms_web_analytics_daily')->where('day', $yesterday)->first();
        expect((int) $day->visits)->toBe(1)->and((int) $day->pageviews)->toBe(2)->and((int) $day->bounces)->toBe(0)
            ->and(DB::table('cms_web_analytics_hits')->where('day', $old)->exists())->toBeFalse()
            ->and(DB::table('cms_web_analytics_hits')->where('day', $yesterday)->count())->toBe(2);
    });

    $platform = new AggregatePlatformWebAnalytics;
    $platform->handle();
    expect($platform->runResult)->toContain('sin visitas nuevas');
});
