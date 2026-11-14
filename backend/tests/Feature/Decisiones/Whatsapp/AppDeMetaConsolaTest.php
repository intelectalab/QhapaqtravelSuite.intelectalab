<?php

use App\Domain\Platform\Support\WhatsappWebhook;
use Illuminate\Support\Facades\DB;

function wadecPlatformAudit(string $field, string $action): ?object
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity', 'App de Meta de WhatsApp')->where('entity_id', $field)->where('action', $action)->orderByDesc('occurred_at')->first();
}

it('la consola guarda la app de Meta cifrada, la prueba y rota el secreto con 24 horas de gracia', function () {
    actingAsPlatform();

    $this->getJson('/api/v1/platform/integrations/whatsapp')->assertOk()
        ->assertJsonPath('data.app_secret_set', false)
        ->assertJsonPath('data.simulated', true);

    expect($this->postJson('/api/v1/platform/integrations/whatsapp/test'))->toBeApiError(422, 'WA-APP-01');
    expect($this->putJson('/api/v1/platform/integrations/whatsapp', ['app_id' => 'abc']))->toBeApiError(422);

    $saved = $this->putJson('/api/v1/platform/integrations/whatsapp', [
        'app_id' => '1234567890123',
        'app_secret' => 'secreto-de-la-app-kipu-0001',
        'verify_token' => 'token-verificacion-kipu',
        'config_id' => '998877665544',
        'api_version' => 'v21.0',
    ])->assertOk()->json('data');

    $stored = (string) DB::connection('pgsql_platform')->table('platform_settings')->where('key', WhatsappWebhook::KEY)->value('value');

    expect($saved['status'])->toBe('lista')
        ->and($saved['app_secret_set'])->toBeTrue()
        ->and($saved['app_secret_hint'])->toBe('••••0001')
        ->and(json_encode($saved))->not->toContain('secreto-de-la-app-kipu-0001')
        ->and($stored)->not->toContain('secreto-de-la-app-kipu-0001')
        ->and($stored)->not->toContain('token-verificacion-kipu')
        ->and(wadecPlatformAudit('Secreto de la app', 'actualizar')?->after_value)->toBe('cambiado')
        ->and(wadecPlatformAudit('ID de la app', 'actualizar')?->after_value)->toBe('1234567890123');

    expect($this->putJson('/api/v1/platform/integrations/whatsapp', ['app_id' => '1234567890123']))->toBeApiError(422, 'CFG-BR-01');

    $this->postJson('/api/v1/platform/integrations/whatsapp/test')->assertOk()
        ->assertJsonPath('data.test.ok', true)
        ->assertJsonPath('data.last_test.ok', true);
    expect(wadecPlatformAudit('Prueba de conexión', 'probar')?->after_value)->toBe('correcta');

    $raw = '{"object":"whatsapp_business_account","entry":[]}';
    $settings = app(WhatsappWebhook::class);
    $oldSignature = 'sha256='.hash_hmac('sha256', $raw, 'secreto-de-la-app-kipu-0001');

    $rotated = $this->putJson('/api/v1/platform/integrations/whatsapp', ['app_secret' => 'secreto-nuevo-de-la-app-0002'])->assertOk()->json('data');

    expect($rotated['secret_rotated_at'])->not->toBeNull()
        ->and($rotated['previous_secret_until'])->not->toBeNull()
        ->and(wadecPlatformAudit('Secreto de la app', 'rotar')?->after_value)->toBe('rotado · el anterior vale 24 h')
        ->and($settings->signedByPlatform($raw, $oldSignature))->toBeTrue()
        ->and($settings->signedByPlatform($raw, 'sha256='.hash_hmac('sha256', $raw, 'secreto-nuevo-de-la-app-0002')))->toBeTrue()
        ->and($settings->signedByPlatform($raw, 'sha256='.hash_hmac('sha256', $raw, 'otro-secreto-cualquiera')))->toBeFalse();

    $this->travel(25)->hours();
    expect($settings->signedByPlatform($raw, $oldSignature))->toBeFalse();
});

it('la app de Meta es solo para la plataforma y una agencia recibe 403', function () {
    actingAsSeed('U01');
    expect($this->getJson('/api/v1/platform/integrations/whatsapp'))->toBeApiError(403);
    expect($this->putJson('/api/v1/platform/integrations/whatsapp', ['app_id' => '1234567890123']))->toBeApiError(403);
});
