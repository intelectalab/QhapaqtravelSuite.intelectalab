<?php

use App\Domain\Platform\Support\PayloadWebhook;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

function c16Audit(string $field, string $action): ?object
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity', 'Blog de la vitrina (Payload)')->where('entity_id', $field)->where('action', $action)->orderByDesc('occurred_at')->first();
}

function c16Notice(string $secret, string $slug = 'free-tours-en-lima-guia', string $title = 'Free tours en Lima: guía completa'): TestResponse
{
    $raw = json_encode(['event' => 'published', 'post' => ['id' => '66f1a0c2e4b0a1d2c3f4'.substr(md5($slug), 0, 4), 'slug' => $slug, 'title' => $title, 'status' => 'published', 'word_count' => 1640, 'published_at' => '2026-09-20T11:00:00Z']]);
    $ts = (string) time();

    return test()->call('POST', '/api/v1/platform/blog/webhooks/payload', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_X_KIPU_TIMESTAMP' => $ts,
        'HTTP_X_KIPU_SIGNATURE' => 'sha256='.hash_hmac('sha256', $ts.'.'.$raw, $secret),
        'HTTP_IDEMPOTENCY_KEY' => 'payload-'.Str::uuid(),
    ], $raw);
}

beforeEach(function () {
    DB::connection('pgsql_platform')->table('platform_settings')->whereIn('key', [PayloadWebhook::KEY, PayloadWebhook::ACTIVITY_KEY])->delete();
    DB::connection('pgsql_platform')->table('platform_blog_posts')->delete();
});

it('O9: la clave del webhook de Payload sale del .env y se genera en la consola, cifrada, una sola vez y auditada', function () {
    expect(config('seguimiento.payload'))->not->toHaveKey('webhook_secret');

    actingAsPlatform();
    $this->getJson('/api/v1/platform/integrations/payload')->assertOk()
        ->assertJsonPath('data.status', 'sin_clave')
        ->assertJsonPath('data.secret_set', false)
        ->assertJsonPath('data.last_signed', null)
        ->assertJsonPath('data.rejections_24h', 0);

    expect(c16Notice('cualquier-clave'))->toBeApiError(401, 'WEBHOOK_SIGNATURE');

    $generated = $this->postJson('/api/v1/platform/integrations/payload/secret')->assertOk()->json('data');
    $secret = $generated['secret'];
    $stored = (string) DB::connection('pgsql_platform')->table('platform_settings')->where('key', PayloadWebhook::KEY)->value('value');

    expect($secret)->toStartWith('kipu_pl_')
        ->and($generated['rotated'])->toBeFalse()
        ->and($generated['secret_hint'])->toBe('••••'.substr($secret, -4))
        ->and($stored)->not->toContain($secret)
        ->and(c16Audit('Clave de firma', 'generar')?->after_value)->toBe('generada');

    $shown = $this->getJson('/api/v1/platform/integrations/payload')->assertOk()->json('data');
    expect(json_encode($shown))->not->toContain($secret)
        ->and($shown['status'])->toBe('lista')
        ->and($shown['rejections_24h'])->toBe(1)
        ->and($shown['still_previous'])->toBeFalse();

    c16Notice($secret)->assertOk()->assertJsonPath('data.status', 'publicado');
    $after = $this->getJson('/api/v1/platform/integrations/payload')->assertOk()->json('data');
    expect($after['last_signed']['title'])->toBe('Free tours en Lima: guía completa')
        ->and($after['last_signed']['slug'])->toBe('free-tours-en-lima-guia')
        ->and($after['last_signed']['key'])->toBe('actual');

    $this->getJson('/api/v1/platform/blog/sync-status')->assertOk()->assertJsonPath('data.configured', true);
});

it('O9: rotar la clave deja 24 h de gracia y avisa que Payload todavía firma con la anterior hasta recibir la nueva', function () {
    actingAsPlatform();
    $old = $this->postJson('/api/v1/platform/integrations/payload/secret')->assertOk()->json('data.secret');

    $rotated = $this->postJson('/api/v1/platform/integrations/payload/secret')->assertOk()->json('data');
    $new = $rotated['secret'];

    expect($new)->not->toBe($old)
        ->and($rotated['rotated'])->toBeTrue()
        ->and($rotated['still_previous'])->toBeTrue()
        ->and($rotated['previous_secret_valid'])->toBeTrue()
        ->and($rotated['previous_secret_until'])->not->toBeNull()
        ->and(c16Audit('Clave de firma', 'rotar')?->after_value)->toBe('rotada · la anterior vale 24 h');

    c16Notice($old, 'machu-picchu-en-un-dia', 'Machu Picchu en un día')->assertOk();
    $withOld = $this->getJson('/api/v1/platform/integrations/payload')->assertOk()->json('data');
    expect($withOld['still_previous'])->toBeTrue()->and($withOld['last_signed']['key'])->toBe('anterior');

    c16Notice($new, 'machu-picchu-en-un-dia', 'Machu Picchu en un día')->assertOk();
    $withNew = $this->getJson('/api/v1/platform/integrations/payload')->assertOk()->json('data');
    expect($withNew['still_previous'])->toBeFalse()->and($withNew['last_signed']['key'])->toBe('actual');

    $this->travel(25)->hours();
    expect(c16Notice($old))->toBeApiError(401, 'WEBHOOK_SIGNATURE');
    c16Notice($new)->assertOk();
    actingAsPlatform();
    expect($this->getJson('/api/v1/platform/integrations/payload')->assertOk()->json('data.previous_secret_valid'))->toBeFalse();
});

it('O9: la URL del admin de Payload se edita en la consola con https y queda auditada', function () {
    actingAsPlatform();

    expect($this->putJson('/api/v1/platform/integrations/payload', ['admin_url' => 'http://cms.rutaslibres.pe/admin']))->toBeApiError(422);

    $this->putJson('/api/v1/platform/integrations/payload', ['admin_url' => 'https://cms.rutaslibres.pe/admin/'])->assertOk()
        ->assertJsonPath('data.admin_url', 'https://cms.rutaslibres.pe/admin');
    expect(c16Audit('URL del admin de Payload', 'actualizar')?->after_value)->toBe('https://cms.rutaslibres.pe/admin');
    expect($this->putJson('/api/v1/platform/integrations/payload', ['admin_url' => 'https://cms.rutaslibres.pe/admin']))->toBeApiError(422, 'CFG-BR-01');

    $this->getJson('/api/v1/platform/blog/sync-status')->assertOk()->assertJsonPath('data.admin_url', 'https://cms.rutaslibres.pe/admin');
});

it('O9: la conexión de Payload es solo para la plataforma y una agencia recibe 403', function () {
    actingAsSeed('U01');
    expect($this->getJson('/api/v1/platform/integrations/payload'))->toBeApiError(403);
    expect($this->postJson('/api/v1/platform/integrations/payload/secret'))->toBeApiError(403);
});

it('duda 13: los errores de integración enlazan a su conexión de la consola', function () {
    actingAsPlatform();
    $errors = collect($this->getJson('/api/v1/platform/operations')->assertOk()->json('data.errors'));
    $connection = fn (string $target): ?string => ($error = $errors->firstWhere('target', $target)) === null ? 'falta' : $error['connection'];

    expect($errors)->not->toBeEmpty()
        ->and($connection('WhatsApp Business API (sandbox)'))->toBe('whatsapp')
        ->and($connection('Recordatorios de pago'))->toBeNull()
        ->and($connection('Adapter tren (Ferrovía Sur Andina)'))->toBeNull()
        ->and($connection('Correo transaccional'))->toBe('correo-de-salida');
});
