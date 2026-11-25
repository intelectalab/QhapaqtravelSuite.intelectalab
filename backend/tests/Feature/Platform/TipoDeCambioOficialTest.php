<?php

use App\Domain\Integrations\Adapters\BcrpFxRateProvider;
use App\Domain\Integrations\Adapters\SunatFxRateProvider;
use App\Domain\Integrations\Support\FxAdapters;
use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Platform\Support\FxProviderCatalog;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function bcrpPeriods(array $rows): array
{
    return ['config' => ['title' => 'Tipo de cambio', 'series' => []], 'periods' => array_map(fn (string $name, array $values): array => ['name' => $name, 'values' => $values], array_keys($rows), $rows)];
}

function fakeBcrp(?array $rows = null, int $status = 200): void
{
    $rows ??= [
        '20.Nov.26' => ['3.447', '3.453', '3.572', '4.011'],
        '23.Nov.26' => ['3.444', '3.455', '3.629', '3.881'],
        '24.Nov.26' => ['n.d.', 'n.d.', 'n.d.', 'n.d.'],
        '25.Nov.26' => ['n.d.', 'n.d.', 'n.d.', 'n.d.'],
    ];

    Http::fake(['estadisticas.bcrp.gob.pe/*' => Http::response(bcrpPeriods($rows), $status)]);
}

function fakeSunat(string $body = '25/11/2026|3.47|3.479|', int $status = 200): void
{
    Http::fake(['www.sunat.gob.pe/*' => Http::response($body, $status, ['Content-Type' => 'text/plain'])]);
}

beforeEach(function () {
    Http::preventStrayRequests();
    config(['integrations.drivers.fx' => 'live']);
});

it('BCRP toma la serie SBS de compra y venta y, sin publicación del día, usa la última publicada', function () {
    fakeBcrp();

    $rates = collect((new BcrpFxRateProvider)->latest(['USD', 'EUR', 'GBP'], '2026-11-25'))->keyBy('currencyCode');

    expect($rates->keys()->all())->toBe(['USD', 'EUR'])
        ->and($rates['USD']->ratePen)->toBe('3.455000')
        ->and($rates['USD']->buy)->toBe('3.444000')
        ->and($rates['USD']->rateDate)->toBe('2026-11-25')
        ->and($rates['USD']->source)->toBe('BCRP · publicado el 23/11/2026')
        ->and($rates['EUR']->sell)->toBe('3.881000');

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/PD04639PD-PD04640PD-PD04647PD-PD04648PD/json/2026-11-10/2026-11-25/esp'));
});

it('BCRP con publicación del mismo día la marca solo como BCRP y redondea a 3 decimales', function () {
    fakeBcrp(['25.Nov.26' => ['3.45071428571429', '3.452']]);

    $usd = (new BcrpFxRateProvider)->latest(['usd'], '2026-11-25')[0];

    expect($usd->source)->toBe('BCRP')->and($usd->buy)->toBe('3.451000')->and($usd->ratePen)->toBe('3.452000');
});

it('BCRP sin moneda soportada no llama al servicio', function () {
    Http::fake();

    expect((new BcrpFxRateProvider)->latest(['BRL'], '2026-11-25'))->toBe([]);
    Http::assertNothingSent();
});

it('BCRP caído o sin datos en 15 días deja la prueba como fallida', function () {
    Http::fake(['estadisticas.bcrp.gob.pe/*' => Http::sequence()->push('', 503)->push('', 503)->push(bcrpPeriods(['24.Nov.26' => ['n.d.', 'n.d.']]))]);
    expect((new BcrpFxRateProvider)->healthcheck()->ok)->toBeFalse()
        ->and(fn () => (new BcrpFxRateProvider)->latest(['USD'], '2026-11-25'))->toThrow(RuntimeException::class, 'HTTP 503');

    $check = (new BcrpFxRateProvider)->healthcheck();
    expect($check->ok)->toBeFalse()->and($check->message)->toContain('15 días');
});

it('SUNAT lee el archivo público de compra y venta y en feriados usa el último publicado', function () {
    fakeSunat('22/11/2026|3.441|3.452|');

    $usd = (new SunatFxRateProvider)->latest(['USD', 'EUR'], '2026-11-24');

    expect($usd)->toHaveCount(1)
        ->and($usd[0]->ratePen)->toBe('3.452000')
        ->and($usd[0]->buy)->toBe('3.441000')
        ->and($usd[0]->rateDate)->toBe('2026-11-24')
        ->and($usd[0]->source)->toBe('SUNAT · publicado el 22/11/2026');

    Http::assertSent(fn (Request $request): bool => $request->url() === SunatFxRateProvider::ENDPOINT);
    expect((new SunatFxRateProvider)->latest(['EUR'], '2026-11-24'))->toBe([]);
});

it('SUNAT ignora una publicación posterior a la fecha pedida y rechaza formatos raros', function () {
    Http::fake(['www.sunat.gob.pe/*' => Http::sequence()->push('25/11/2026|3.47|3.479|')->push('<html>Request Rejected</html>')->push('25/11/2026|n.d.|3.4|')->push('', 500)]);
    expect((new SunatFxRateProvider)->latest(['USD'], '2026-11-24'))->toBe([])
        ->and((new SunatFxRateProvider)->healthcheck()->message)->toContain('formato')
        ->and((new SunatFxRateProvider)->healthcheck()->message)->toContain('todavía no publica')
        ->and((new SunatFxRateProvider)->healthcheck()->message)->toContain('HTTP 500');
});

it('«Probar» en la consola valida BCRP y SUNAT con el valor publicado y lo audita', function () {
    Http::fake([
        'estadisticas.bcrp.gob.pe/*' => Http::response(bcrpPeriods(['23.Nov.26' => ['3.444', '3.455']])),
        'www.sunat.gob.pe/*' => Http::response('25/11/2026|3.47|3.479|'),
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-11-25 10:00', 'America/Lima'));
    actingAsPlatform();

    $bcrp = $this->postJson('/api/v1/platform/fx-providers/BCRP/test')->assertOk()->json('data');
    $sunat = $this->postJson('/api/v1/platform/fx-providers/SUNAT/test')->assertOk()->json('data');

    expect($bcrp['ok'])->toBeTrue()->and($bcrp['status'])->toBe('validado')
        ->and($bcrp['result'])->toBe('Conexión correcta: USD compra 3.444 y venta 3.455, publicado el 23/11/2026.')
        ->and($sunat['result'])->toBe('Conexión correcta: USD compra 3.47 y venta 3.479, publicado el 25/11/2026.')
        ->and($this->getJson('/api/v1/platform/fx-providers')->json('data.simulated'))->toBeFalse()
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', 'Tipo de cambio · SUNAT')->where('action', 'probar_conexion')->exists())->toBeTrue();
});

it('«Probar» deja por validar al proveedor oficial que no responde', function () {
    Http::fake(['estadisticas.bcrp.gob.pe/*' => Http::response('', 500)]);
    actingAsPlatform();

    $data = $this->postJson('/api/v1/platform/fx-providers/BCRP/test')->assertOk()->json('data');

    expect($data['ok'])->toBeFalse()->and($data['status'])->toBe('por_validar')->and($data['result'])->toContain('HTTP 500');
});

it('con el adaptador real, el simulado se rechaza en producción y los oficiales no', function () {
    config(['integrations.require_real' => true]);
    $catalog = app(FxProviderCatalog::class);

    expect(fn () => app(FxAdapters::class)->for($catalog->find('SIMULADO')))->toThrow(ApiException::class)
        ->and(app(FxAdapters::class)->for($catalog->find('BCRP')))->toBeInstanceOf(BcrpFxRateProvider::class)
        ->and(app(FxAdapters::class)->for($catalog->find('SUNAT')))->toBeInstanceOf(SunatFxRateProvider::class)
        ->and(IntegrationReadiness::usable('fx'))->toBeTrue();
});

it('la agencia actualiza desde SUNAT real y si SUNAT cae conserva el último tipo de cambio', function () {
    $today = now('America/Lima')->format('d/m/Y').'|3.47|3.479|';
    Http::fake(['www.sunat.gob.pe/*' => Http::sequence()->push($today)->push($today)->push('', 503)]);
    actingAsPlatform();
    $this->postJson('/api/v1/platform/fx-providers/SUNAT/test')->assertOk()->assertJsonPath('data.status', 'validado');

    actingAsSeed('U01');
    $this->putJson('/api/v1/finance/fx-provider', ['code' => 'SUNAT'])->assertOk();
    $refresh = $this->postJson('/api/v1/finance/currencies/refresh')->assertOk()->json('data');
    $sunatRows = fn () => withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->where('currency_code', 'USD')->where('source', 'SUNAT')->get(['rate_pen', 'buy', 'sell', 'source', 'is_demo']));
    $stored = $sunatRows()->sole();

    expect(collect($refresh['rates'])->firstWhere('currency', 'USD')['rate'])->toBe(3.479)
        ->and((float) $stored->buy)->toBe(3.47)
        ->and($stored->source)->toBe('SUNAT')
        ->and($stored->is_demo)->toBeFalse();

    expect($this->postJson('/api/v1/finance/currencies/refresh'))->toBeApiError(409, 'FX-PROVIDER-ERROR');
    expect($sunatRows())->toHaveCount(1);
});
