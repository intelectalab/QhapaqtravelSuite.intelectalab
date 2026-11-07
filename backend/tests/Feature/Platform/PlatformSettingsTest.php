<?php

use App\Domain\Admin\Support\Branding;
use Illuminate\Support\Facades\DB;

function platformSettingsVersion(): string
{
    return (string) (DB::connection('pgsql_platform')->table('platform_settings')->where('key', 'billing')->value('lock_version') ?? 0);
}

it('la campana del Super Admin trae las alertas reales de la plataforma y las marca como leídas', function () {
    actingAsPlatform();
    DB::connection('pgsql_platform')->table('platform_invoices')->where('id', DB::connection('pgsql_platform')->table('platform_invoices')->orderBy('number')->value('id'))->update(['status' => 'failed', 'dunning_next_retry_at' => now()->addDay()]);

    $feed = $this->getJson('/api/v1/platform/notifications')->assertOk();

    expect($feed->json('meta.unread_count'))->toBeGreaterThan(0)
        ->and(collect($feed->json('data'))->pluck('event_code'))->toContain('cobranza')
        ->and($feed->json('data.0.href'))->toStartWith('/plataforma/');

    $this->postJson('/api/v1/platform/notifications/read-all')->assertOk();

    expect($this->getJson('/api/v1/platform/notifications')->json('meta.unread_count'))->toBe(0);
});

it('la búsqueda de la consola encuentra agencias, facturas, planes y cupones con su enlace', function (string $term, string $type, string $href) {
    actingAsPlatform();

    $hits = collect($this->getJson('/api/v1/platform/search?q='.urlencode($term))->assertOk()->json('data'));
    $hit = $hits->firstWhere('type', $type);

    expect($hit)->not->toBeNull()
        ->and($hit['href'])->toStartWith($href);
})->with([
    'agencia por nombre' => ['andes', 'tenant', '/plataforma/agencias/'],
    'agencia por RUC' => ['20611234567', 'tenant', '/plataforma/agencias/'],
    'factura por número' => ['FQ01', 'invoice', '/plataforma/facturacion/facturas/'],
    'plan' => ['enterprise', 'plan', '/plataforma/planes/'],
    'cupón' => ['FERIATUR', 'coupon', '/plataforma/facturacion/cupones'],
]);

it('la búsqueda de la consola pide al menos dos caracteres y es solo para la plataforma', function () {
    actingAsPlatform();
    $this->getJson('/api/v1/platform/search?q=a')->assertStatus(422);

    actingAsSeed('U01');
    expect($this->getJson('/api/v1/platform/search?q=andes')->status())->toBeIn([401, 403]);
});

it('la configuración de la plataforma guarda el emisor y los avisos con If-Match y queda en la auditoría', function () {
    actingAsPlatform();

    $this->patchJson('/api/v1/platform/settings/issuer', ['name' => 'Qhapaq Cloud S.A.C.', 'ruc' => '20614455661', 'address' => 'Av. Prueba 123, Lima', 'email' => 'facturas@qhapaq.cloud', 'web' => 'www.qhapaq.cloud'])
        ->assertStatus(428);

    $this->patchJson('/api/v1/platform/settings/notices', ['trial_days' => [5, 2], 'usage_warn_pct' => 75, 'api_key_days' => 10], ['If-Match' => platformSettingsVersion()])->assertOk();

    $data = $this->getJson('/api/v1/platform/settings')->assertOk()->json('data');

    expect($data['sections']['notices'])->toBe(['trial_days' => [5, 2], 'usage_warn_pct' => 75, 'api_key_days' => 10])
        ->and(collect($data['history'])->pluck('entity_id'))->toContain('Aviso de uso del plan');

    $this->patchJson('/api/v1/platform/settings/taxes', ['igv_pct' => 18], ['If-Match' => platformSettingsVersion()])->assertStatus(422);
});

it('la personalización de la consola guarda los colores, los expone en /platform/me y se restablece', function () {
    actingAsPlatform();

    $this->putJson('/api/v1/platform/branding', ['brand' => '#0F766E', 'accent' => '#1e40af', 'menu' => '#0f172a', 'tile_variant' => 'stacked'])->assertOk();

    expect($this->getJson('/api/v1/platform/me')->json('data.branding'))->toBe(['brand' => '#0f766e', 'accent' => '#1e40af', 'menu' => '#0f172a', 'tile_variant' => 'stacked']);

    $this->postJson('/api/v1/platform/branding/reset', ['reason' => 'Volver a los colores de fábrica'])->assertOk();

    expect($this->getJson('/api/v1/platform/branding')->json('data.branding'))->toBe(Branding::DEFAULTS);
});
