<?php

use App\Domain\Platform\Support\MobileAppVersions;
use Illuminate\Support\Facades\DB;

const OPS_PLAY_URL = 'https://play.google.com/store/apps/details?id=pe.kipucontrol.operador';

function opsAppHeaders(string $version, string $platform = 'android'): array
{
    return [MobileAppVersions::VERSION_HEADER => $version, MobileAppVersions::PLATFORM_HEADER => $platform, 'Accept' => 'application/json'];
}

it('G3-27: el Super Admin fija la versión mínima por plataforma con su enlace a la tienda, auditado', function () {
    actingAsPlatform();

    $summary = $this->getJson('/api/v1/platform/settings/mobile-app')->assertOk()->json('data');
    expect(collect($summary['platforms'])->pluck('platform')->all())->toBe(['ios', 'android']);

    expect($this->putJson('/api/v1/platform/settings/mobile-app', ['ios' => [], 'android' => ['min_version' => '1.2.0']]))->toBeApiError(422, 'VALIDATION_ERROR');
    $this->putJson('/api/v1/platform/settings/mobile-app', ['ios' => [], 'android' => ['min_version' => 'uno', 'store_url' => OPS_PLAY_URL]])->assertStatus(422)->assertJsonValidationErrors('android.min_version');
    $this->putJson('/api/v1/platform/settings/mobile-app', ['ios' => [], 'android' => ['min_version' => '1.2.0', 'store_url' => 'http://inseguro.test']])->assertStatus(422)->assertJsonValidationErrors('android.store_url');

    $saved = $this->putJson('/api/v1/platform/settings/mobile-app', ['ios' => ['min_version' => null, 'store_url' => null], 'android' => ['min_version' => '1.2.0', 'store_url' => OPS_PLAY_URL]])->assertOk()->json('data');
    expect(collect($saved['platforms'])->firstWhere('platform', 'android'))->toMatchArray(['min_version' => '1.2.0', 'store_url' => OPS_PLAY_URL])
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity', 'App móvil')->where('entity_id', 'Android · versión mínima')->exists())->toBeTrue();

    expect($this->putJson('/api/v1/platform/settings/mobile-app', ['ios' => [], 'android' => ['min_version' => '1.2.0', 'store_url' => OPS_PLAY_URL]]))->toBeApiError(422, 'CFG-BR-01');
});

it('G3-27: la app con versión menor recibe 426 con el enlace; la web y las versiones al día siguen igual', function () {
    actingAsPlatform();
    $this->putJson('/api/v1/platform/settings/mobile-app', ['ios' => [], 'android' => ['min_version' => '1.2.0', 'store_url' => OPS_PLAY_URL]])->assertOk();

    $this->postJson('/api/v1/auth/login', ['email' => 'nadie@example.com', 'password' => 'x'], opsAppHeaders('1.0.0'))
        ->assertStatus(426)
        ->assertJsonPath('error', 'UPGRADE_REQUIRED')
        ->assertJsonPath('code', MobileAppVersions::UPGRADE_CODE)
        ->assertJsonPath('details.store_url', OPS_PLAY_URL)
        ->assertJsonPath('details.min_version', '1.2.0');

    actingAsSeed('U09');
    $this->getJson('/api/v1/me', opsAppHeaders('1.1.9'))->assertStatus(426);
    $this->getJson('/api/v1/me', opsAppHeaders('1.2'))->assertOk();
    $this->getJson('/api/v1/me', opsAppHeaders('1.10.0'))->assertOk();
    $this->getJson('/api/v1/me', opsAppHeaders('1.0.0', 'ios'))->assertOk();
    $this->getJson('/api/v1/me')->assertOk();
});

it('G3-27: compara versiones por número y no por texto', function () {
    expect(MobileAppVersions::older('1.9.0', '1.10.0'))->toBeTrue()
        ->and(MobileAppVersions::older('1.10.0', '1.9.0'))->toBeFalse()
        ->and(MobileAppVersions::older('2', '1.99.99'))->toBeFalse()
        ->and(MobileAppVersions::older('1.2', '1.2.0'))->toBeFalse();
});
