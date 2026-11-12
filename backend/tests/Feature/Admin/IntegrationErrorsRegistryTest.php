<?php

use App\Domain\Admin\Support\IntegrationErrors;
use App\Jobs\ExpireQuotes;
use App\Jobs\RetryIntegrationErrors;
use App\Jobs\TenantJob;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class ExplodingTenantJob extends TenantJob
{
    protected function run(): string
    {
        throw new RuntimeException('El proveedor no respondió');
    }
}

beforeEach(function () {
    lockScheduledJobs();
    freezeBusinessToday();
});

function errorRows(string $ref): array
{
    return withinTenant(tenantA(), fn () => DB::table('integration_errors')->where('ref_code', $ref)->orderBy('created_at')->get(['code', 'status', 'attempt', 'error_class', 'next_retry_at', 'resolution'])->all());
}

it('un mismo fallo se acumula en un solo registro hasta agotar los intentos', function () {
    $tenant = (string) tenantA()->getKey();

    IntegrationErrors::record($tenant, 'integration', 'ADP-TEST', 'Adaptador de prueba', 'Timeout', 1, 3);
    IntegrationErrors::record($tenant, 'integration', 'ADP-TEST', 'Adaptador de prueba', 'Timeout', 2, 3);
    $retrying = errorRows('ADP-TEST');
    IntegrationErrors::record($tenant, 'integration', 'ADP-TEST', 'Adaptador de prueba', 'Timeout', 3, 3);
    $final = errorRows('ADP-TEST');

    expect($retrying)->toHaveCount(1)
        ->and($retrying[0]->status)->toBe('reintentando')
        ->and((int) $retrying[0]->attempt)->toBe(2)
        ->and($retrying[0]->next_retry_at)->not->toBeNull()
        ->and($retrying[0]->code)->toStartWith('ERR-')
        ->and($final)->toHaveCount(1)
        ->and($final[0]->status)->toBe('fallo_definitivo')
        ->and($final[0]->next_retry_at)->toBeNull();
});

it('el reintento correcto marca el error como resuelto', function () {
    $tenant = (string) tenantA()->getKey();

    IntegrationErrors::record($tenant, 'notification', 'MSG-PRUEBA', 'Correo · a@b.pe', 'SMTP 421', 1, 5);
    IntegrationErrors::resolve($tenant, 'notification', 'MSG-PRUEBA');

    $row = errorRows('MSG-PRUEBA')[0];

    expect($row->status)->toBe('resuelto')
        ->and($row->resolution)->toBe(IntegrationErrors::AUTO_RESOLUTION);
});

it('un proceso que falla queda registrado como error transitorio del job', function () {
    expect(fn () => dispatch_sync((new ExplodingTenantJob)->forTenant((string) tenantA()->getKey())))->toThrow(RuntimeException::class);

    $row = errorRows('ExplodingTenantJob')[0];

    expect($row->status)->toBe('reintentando')
        ->and($row->error_class)->toBe('transitorio')
        ->and((int) $row->attempt)->toBe(1);
});

it('el reintento manual de un proceso lo relanza y se resuelve al terminar bien', function () {
    withinTenant(tenantA(), fn () => DB::table('integration_errors')->insert([
        'code' => 'ERR-9001', 'source' => 'job', 'ref_code' => 'JOB-02', 'target' => 'Marcar cotizaciones vencidas', 'error' => 'Timeout',
        'error_class' => 'transitorio', 'attempt' => 0, 'max_attempts' => 5, 'status' => 'reintentando', 'next_retry_at' => now()->subMinute(),
    ]));

    Cache::lock('laravel_unique_job:'.ExpireQuotes::class.':'.tenantA()->getKey().':schedule')->forceRelease();
    dispatch_sync((new RetryIntegrationErrors)->forTenant((string) tenantA()->getKey()));

    $row = errorRows('JOB-02')[0];

    expect($row->status)->toBe('resuelto')
        ->and($row->next_retry_at)->toBeNull();
});
