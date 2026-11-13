<?php

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

require_once __DIR__.'/SeguimientoHelpers.php';

beforeEach(fn () => segCleanSlate());

function segSecondSuperAdmin(): void
{
    app(TenantContext::class)->clear();
    $user = PlatformUser::query()->forceCreate(['name' => 'Segunda Superadmin', 'email' => 'marketing@kipucontrol.com', 'password' => Hash::make('Clave-Segura-2026'), 'mfa_secret' => 'JBSWY3DPEHPK3PXP', 'status' => 'activo']);
    $plain = DB::connection('pgsql_platform')->transaction(function () use ($user) {
        $token = AccessToken::on('pgsql_platform')->forceCreate([
            'tokenable_type' => $user->getMorphClass(),
            'tokenable_id' => $user->getKey(),
            'name' => 'pest',
            'token' => hash('sha256', $secret = 'pest-platform-'.bin2hex(random_bytes(16))),
            'abilities' => ['*'],
            'experience' => 'platform',
            'expires_at' => now()->addHour(),
            'mfa_verified_at' => now(),
        ]);

        return $token->getKey().'|'.$secret;
    });
    useToken($plain);
}

function segPayload(array $body, ?string $secret = 'payload-secreto-de-prueba', ?int $timestamp = null): TestResponse
{
    config(['seguimiento.payload.webhook_secret' => 'payload-secreto-de-prueba']);
    $raw = json_encode($body);
    $ts = (string) ($timestamp ?? time());

    return test()->call('POST', '/api/v1/platform/blog/webhooks/payload', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_X_KIPU_TIMESTAMP' => $ts,
        'HTTP_X_KIPU_SIGNATURE' => 'sha256='.hash_hmac('sha256', $ts.'.'.$raw, (string) $secret),
        'HTTP_IDEMPOTENCY_KEY' => 'payload-'.Str::uuid(),
    ], $raw);
}

function segPost(array $overrides = []): array
{
    return ['event' => 'published', 'post' => [...['id' => '66f1a0c2e4b0a1d2c3f40001', 'slug' => 'free-tours-en-lima-guia', 'title' => 'Free tours en Lima: guía completa', 'excerpt' => 'Todo lo que necesitas saber.', 'focus_keyword' => 'free tours en lima', 'status' => 'published', 'word_count' => 1640, 'published_at' => '2026-09-20T11:00:00Z', 'canonical_url' => 'https://rutaslibres.pe/blog/free-tours-en-lima-guia'], ...$overrides]];
}

it('SEG-04 plataforma: la etiqueta nace en borrador, va a revisión y la aprueba otro Super Admin', function () {
    actingAsPlatform();
    $tag = $this->postJson('/api/v1/platform/tracking/tags', ['site' => 'ambos', 'provider' => 'ga4', 'name' => 'GA4 Rutas Libres', 'measurement_id' => 'G-RL4P8N2X6K'], critical())->assertCreated()->json('data');
    expect($tag['status'])->toBe('borrador')->and($tag['code'])->toStartWith('PTG-');

    $submitted = $this->patchJson("/api/v1/platform/tracking/tags/{$tag['code']}", ['action' => 'enviar_revision'], critical($tag['lock_version']))->assertOk()->json('data');
    expect($submitted['status'])->toBe('en_revision');
    expect($this->postJson("/api/v1/platform/tracking/tags/{$tag['code']}/decision", ['decision' => 'aprobar']))->toBeApiError(403, 'SCRIPT_SELF_APPROVAL');

    segSecondSuperAdmin();
    $approved = $this->postJson("/api/v1/platform/tracking/tags/{$tag['code']}/decision", ['decision' => 'aprobar'])->assertOk()->json('data');
    expect($approved['status'])->toBe('activo');

    $paused = $this->patchJson("/api/v1/platform/tracking/tags/{$approved['code']}", ['action' => 'pausar'], critical($approved['lock_version']))->assertOk()->json('data');
    expect($paused['status'])->toBe('pausado');
    expect(segAudited(['entity' => 'Etiqueta vitrina', 'entity_id' => $tag['code'], 'action' => 'aprobar'], true))->toBeTrue();

    $vitrina = $this->getJson('/api/v1/public/site/tags?site=vitrina&path=/lima')->assertOk()->json('data.tags');
    expect($vitrina)->toBe([]);
    $list = $this->getJson('/api/v1/platform/tracking/tags')->assertOk()->json('data');
    expect(collect($list['rows'])->pluck('code'))->toContain($tag['code']);
});

it('SEG-04 plataforma: el CHECK impide una etiqueta de la vitrina activa sin aprobación', function () {
    expect(fn () => DB::connection('pgsql_platform')->table('platform_tracking_tags')->insert(['code' => 'PTG-9901', 'site' => 'vitrina', 'provider' => 'ga4', 'name' => 'x', 'measurement_id' => 'G-ABCDEF12', 'consent_category' => 'analiticas', 'status' => 'activo']))->toThrow(QueryException::class);
});

it('mapea las conversiones de captación de la vitrina y la edición pide If-Match', function () {
    actingAsPlatform();
    $ads = $this->postJson('/api/v1/platform/tracking/tags', ['site' => 'ambos', 'provider' => 'google_ads', 'name' => 'Ads · captación de agencias', 'measurement_id' => 'AW-16620045123'], critical())->assertCreated()->json('data');

    $this->putJson("/api/v1/platform/tracking/conversions/{$ads['code']}/registro_agencia", ['provider_event' => 'conversion', 'conversion_label' => 'Rq1aCJm7-YgZEKOn'])->assertOk()->assertJsonPath('data.event', 'registro_agencia');
    expect($this->putJson("/api/v1/platform/tracking/conversions/{$ads['code']}/compra", ['provider_event' => 'conversion', 'conversion_label' => 'Rq1aCJm7-YgZEKOn']))->toBeApiError(404);
    expect($this->patchJson("/api/v1/platform/tracking/tags/{$ads['code']}", ['name' => 'Sin versión'], ['Accept' => 'application/json']))->toBeApiError(428);
    $this->patchJson("/api/v1/platform/tracking/tags/{$ads['code']}", ['name' => 'Ads · agencias Lima'], critical($ads['lock_version']))->assertOk()->assertJsonPath('data.name', 'Ads · agencias Lima');
});

it('muestra visitas de la vitrina por agencia', function () {
    $agency = DB::connection('pgsql_platform')->table('platform_showcase_agencies')->value('id');
    DB::connection('pgsql_platform')->table('platform_web_analytics_daily')->insert([
        ['day' => now('America/Lima')->toDateString(), 'site' => 'vitrina', 'path' => '/lima/tour-centro', 'agency_id' => $agency, 'device' => 'movil', 'visits' => 120, 'visitors' => 100, 'pageviews' => 300, 'bounces' => 40, 'conversions' => 9],
        ['day' => now('America/Lima')->toDateString(), 'site' => 'blog', 'path' => '/blog/free-tours', 'agency_id' => null, 'device' => 'escritorio', 'visits' => 50, 'visitors' => 45, 'pageviews' => 80, 'bounces' => 20, 'conversions' => 0],
    ]);

    actingAsPlatform();
    $agencies = $this->getJson('/api/v1/platform/analytics/web/agencies?days=30')->assertOk()->json('data');
    $top = collect($agencies)->firstWhere('visits', 120);
    expect($top)->not->toBeNull()->and($top['conversions'])->toBe(9)->and($top['trend'])->toHaveCount(14);

    expect($this->getJson('/api/v1/platform/analytics/web/overview?days=30&site=blog')->assertOk()->json('data.kpis.visits'))->toBe(50);
});

it('BLG-03: el webhook firmado de Payload sincroniza el índice y rechaza firmas inválidas y artículos cortos', function () {
    segPayload(segPost())->assertOk()->assertJsonPath('data.status', 'publicado')->assertJsonPath('data.created', true);
    expect(DB::connection('pgsql_platform')->table('platform_blog_posts')->where('payload_id', '66f1a0c2e4b0a1d2c3f40001')->value('status'))->toBe('publicado');

    expect(segPayload(segPost(), 'otra-clave'))->toBeApiError(401, 'WEBHOOK_SIGNATURE');
    expect(segPayload(segPost(), timestamp: time() - 3600))->toBeApiError(401, 'WEBHOOK_SIGNATURE');
    expect(segPayload(segPost(['id' => '66f1a0c2e4b0a1d2c3f40009', 'slug' => 'articulo-corto', 'word_count' => 700])))->toBeApiError(422, 'VT-13');
    expect(DB::connection('pgsql_platform')->table('platform_blog_posts')->where('payload_id', '66f1a0c2e4b0a1d2c3f40009')->exists())->toBeFalse();

    segPayload(['event' => 'unpublished', 'post' => segPost()['post']])->assertOk()->assertJsonPath('data.status', 'borrador');

    actingAsPlatform();
    $status = $this->getJson('/api/v1/platform/blog/sync-status')->assertOk()->json('data');
    expect($status['kpis']['synced'])->toBe(1)->and($status['last_webhook']['ok'])->toBeTrue()->and($status['configured'])->toBeTrue();
});

it('el Tenant Admin no entra a las etiquetas ni a las altas de la plataforma', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/platform/tracking/tags'))->toBeApiError(403);
    expect($this->getJson('/api/v1/platform/signups'))->toBeApiError(403);
});
