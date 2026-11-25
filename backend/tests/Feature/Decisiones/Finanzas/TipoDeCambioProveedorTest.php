<?php

use App\Domain\Platform\Support\FxProviderCatalog;
use Illuminate\Support\Facades\DB;

function finanzasPlatformAudit(string $entityId, string $action): ?object
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', $entityId)->where('action', $action)->orderByDesc('code')->first();
}

function finanzasTenantAudit(array $where): bool
{
    return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('la consola lista el catálogo de tipo de cambio con el simulado validado y los oficiales por validar', function () {
    actingAsPlatform();

    $data = $this->getJson('/api/v1/platform/fx-providers')->assertOk()->json('data');
    $byCode = collect($data['providers'])->keyBy('code');

    expect($byCode['SIMULADO']['status'])->toBe('validado')
        ->and($byCode['BCRP']['status'])->toBe('por_validar')
        ->and($byCode['SUNAT']['credentials'])->toBe([])
        ->and($byCode['SUNAT']['credentials_complete'])->toBeTrue()
        ->and(collect($data['drivers'])->pluck('value')->all())->toContain('sunat', 'bcrp', 'api')
        ->and($data['simulated'])->toBeTrue();
});

it('el Super Admin crea un proveedor con claves cifradas, lo prueba, queda validado y lo audita', function () {
    actingAsPlatform();

    $created = $this->postJson('/api/v1/platform/fx-providers', ['code' => 'fx-api', 'name' => 'Divisas Pro', 'driver' => 'api', 'note' => 'Plan anual'])->assertCreated()->json('data');
    expect($created['code'])->toBe('FX-API')->and($created['status'])->toBe('por_validar');

    $failed = $this->postJson('/api/v1/platform/fx-providers/FX-API/test')->assertOk()->json('data');
    expect($failed['ok'])->toBeFalse()->and($failed['result'])->toContain('Clave de API')->and($failed['status'])->toBe('por_validar');

    $updated = $this->patchJson('/api/v1/platform/fx-providers/FX-API', ['credentials' => ['api_key' => 'clave-secreta-123456']])->assertOk()->json('data');
    expect($updated['credentials'][0]['set'])->toBeTrue()
        ->and($updated['credentials'][0]['hint'])->toEndWith('3456')
        ->and(json_encode($updated))->not->toContain('clave-secreta-123456')
        ->and(DB::connection('pgsql_platform')->table('platform_settings')->where('key', FxProviderCatalog::KEY)->value('value'))->not->toContain('clave-secreta-123456');

    $passed = $this->postJson('/api/v1/platform/fx-providers/FX-API/test')->assertOk()->json('data');
    expect($passed['ok'])->toBeTrue()->and($passed['status'])->toBe('validado')
        ->and(finanzasPlatformAudit('Tipo de cambio · FX-API', 'probar_conexion')?->after_value)->toStartWith('Validado')
        ->and(finanzasPlatformAudit('Tipo de cambio · FX-API', 'crear'))->not->toBeNull()
        ->and(finanzasPlatformAudit('Tipo de cambio · FX-API', 'editar')?->after_value)->toBe('credenciales: cambiadas');

    $this->patchJson('/api/v1/platform/fx-providers/FX-API', ['credentials' => ['api_key' => 'otra-clave-987654']])->assertOk()->assertJsonPath('data.status', 'por_validar');
    expect($this->patchJson('/api/v1/platform/fx-providers/FX-API', ['name' => 'Divisas Pro']))->toBeApiError(422, 'CFG-BR-01');
    $this->postJson('/api/v1/platform/fx-providers', ['code' => 'FX-API', 'name' => 'Duplicado', 'driver' => 'api'])->assertStatus(422)->assertJsonValidationErrors('code');

    $this->deleteJson('/api/v1/platform/fx-providers/FX-API')->assertOk();
    expect(collect($this->getJson('/api/v1/platform/fx-providers')->json('data.providers'))->pluck('code'))->not->toContain('FX-API')
        ->and(finanzasPlatformAudit('Tipo de cambio · FX-API', 'eliminar'))->not->toBeNull();
    expect($this->deleteJson('/api/v1/platform/fx-providers/FX-API'))->toBeApiError(404);
});

it('la agencia elige en Monedas solo entre los validados y el refresco usa el proveedor elegido', function () {
    actingAsPlatform();
    $this->postJson('/api/v1/platform/fx-providers/BCRP/test')->assertOk()->assertJsonPath('data.status', 'validado');

    actingAsSeed('U01');
    $list = collect($this->getJson('/api/v1/finance/fx-providers')->assertOk()->json('data'))->keyBy('code');
    expect($list['BCRP']['selectable'])->toBeTrue()
        ->and($list['SUNAT']['selectable'])->toBeFalse()
        ->and($list['SUNAT']['status'])->toBe('por_validar');

    expect($this->putJson('/api/v1/finance/fx-provider', ['code' => 'SUNAT']))->toBeApiError(422, 'FX-05');

    $chosen = $this->putJson('/api/v1/finance/fx-provider', ['code' => 'BCRP'])->assertOk();
    expect($chosen->json('meta.active'))->toBe('BCRP')
        ->and(collect($chosen->json('data'))->firstWhere('code', 'BCRP')['active'])->toBeTrue()
        ->and(finanzasTenantAudit(['entity' => 'Tipo de cambio', 'entity_id' => 'BCRP', 'action' => 'elegir_proveedor']))->toBeTrue();
    expect($this->putJson('/api/v1/finance/fx-provider', ['code' => 'BCRP']))->toBeApiError(422, 'CFG-BR-01');

    $refresh = $this->postJson('/api/v1/finance/currencies/refresh')->assertOk()->json('data');
    $usd = collect($refresh['rates'])->firstWhere('currency', 'USD');
    expect($refresh['provider'])->toBe('BCRP')->and($usd['rate'])->toBe(3.738);

    $stored = withinTenant(tenantA(), fn () => DB::table('fin_fx_rates as f')->join('fx_rate_providers as p', 'p.id', '=', 'f.provider_id')->where('f.currency_code', 'USD')->orderByDesc('f.effective_at')->first(['p.code', 'f.source']));
    expect($stored->code)->toBe('BCRP')->and($stored->source)->toBe('Banco Central de Reserva del Perú (simulado)');

    $this->putJson('/api/v1/finance/fx-provider', ['code' => null])->assertOk()->assertJsonPath('meta.active', null);
    expect($this->postJson('/api/v1/finance/currencies/refresh'))->toBeApiError(409, 'FX-04');
});

it('si la plataforma quita la validación, el refresco se detiene y la carga manual sigue disponible', function () {
    actingAsSeed('U01');
    $this->putJson('/api/v1/finance/fx-provider', ['code' => 'SIMULADO'])->assertOk();

    actingAsPlatform();
    $this->postJson('/api/v1/platform/fx-providers', ['code' => 'FX-KEY', 'name' => 'Con clave', 'driver' => 'sunat'])->assertCreated();
    DB::connection('pgsql_platform')->transaction(function (): void {
        $catalog = app(FxProviderCatalog::class);
        $catalog->save(array_map(fn (array $row): array => $row['code'] === 'SIMULADO' ? [...$row, 'status' => 'por_validar'] : $row, $catalog->all()), null);
    });

    actingAsSeed('U01');
    expect($this->postJson('/api/v1/finance/currencies/refresh'))->toBeApiError(409, 'FX-05')
        ->and(collect($this->getJson('/api/v1/finance/fx-providers')->json('data'))->firstWhere('code', 'SIMULADO')['status'])->toBe('error');
    $this->postJson('/api/v1/finance/fx-rates', ['currency' => 'USD', 'rate' => '3.7512', 'source' => 'Manual'])->assertSuccessful();
});

it('solo administración elige el proveedor y la consola rechaza usuarios de agencia', function () {
    actingAsSeed('U07');
    $denied = $this->putJson('/api/v1/finance/fx-provider', ['code' => 'SIMULADO']);
    expect($denied)->toBeApiError(403)->and($denied->json('required_permissions'))->toContain('admin.settings.manage');

    actingAsSeed('U01');
    expect($this->getJson('/api/v1/platform/fx-providers')->status())->toBeIn([401, 403])
        ->and($this->postJson('/api/v1/platform/fx-providers', ['code' => 'X-1', 'name' => 'Intruso', 'driver' => 'api'])->status())->toBeIn([401, 403]);
});
