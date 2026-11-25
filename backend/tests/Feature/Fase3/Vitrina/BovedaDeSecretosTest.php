<?php

use App\Domain\Showcase\Contracts\GatewayCredentialVault;
use App\Domain\Showcase\Support\DatabaseGatewayCredentialVault;
use App\Domain\Tracking\Contracts\TrackingSecretVault;
use App\Domain\Tracking\Support\DatabaseTrackingSecretVault;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

it('las bóvedas reales quedan conectadas por defecto', function () {
    expect(app(GatewayCredentialVault::class))->toBeInstanceOf(DatabaseGatewayCredentialVault::class)
        ->and(app(TrackingSecretVault::class))->toBeInstanceOf(DatabaseTrackingSecretVault::class);
});

it('guarda las credenciales de la pasarela cifradas en la base y las aísla por agencia', function () {
    $vault = app(GatewayCredentialVault::class);
    $reference = 'vault://gateways/'.tenantA()->id.'/prueba/20261124';

    withinTenant(tenantA(), fn () => $vault->put($reference, ['client_id' => 'cli-1', 'secret' => 'super-secreto']));
    $row = withinTenant(tenantA(), fn () => DB::table('integration_vault_secrets')->where('reference', $reference)->first());

    expect($row->kind)->toBe('pasarela')
        ->and($row->payload)->not->toContain('super-secreto')
        ->and(json_decode(Crypt::decryptString($row->payload), true))->toBe(['client_id' => 'cli-1', 'secret' => 'super-secreto'])
        ->and(withinTenant(tenantA(), fn () => $vault->has($reference)))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => $vault->get($reference)))->toBe(['client_id' => 'cli-1', 'secret' => 'super-secreto'])
        ->and(withinTenant(tenantB(), fn () => $vault->has($reference)))->toBeFalse()
        ->and(withinTenant(tenantB(), fn () => $vault->get($reference)))->toBeNull();

    withinTenant(tenantA(), fn () => $vault->put($reference, ['secret' => 'renovado']));

    expect(withinTenant(tenantA(), fn () => DB::table('integration_vault_secrets')->where('reference', $reference)->count()))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => $vault->get($reference)))->toBe(['secret' => 'renovado']);
});

it('guarda los tokens de seguimiento de la agencia y de la plataforma en su propia tabla', function () {
    $vault = app(TrackingSecretVault::class);
    $tenantRef = 'vault://tenant/'.tenantA()->id.'/tracking/TAG-PRUEBA';
    $platformRef = 'vault://platform/tracking/PTG-PRUEBA';

    withinTenant(tenantA(), fn () => $vault->put($tenantRef, 'EAAB-token-agencia'));
    $vault->put($platformRef, 'EAAB-token-vitrina');

    $platformRow = DB::connection('pgsql_platform')->table('platform_vault_secrets')->where('reference', $platformRef)->first();

    expect(withinTenant(tenantA(), fn () => $vault->get($tenantRef)))->toBe('EAAB-token-agencia')
        ->and(withinTenant(tenantB(), fn () => $vault->has($tenantRef)))->toBeFalse()
        ->and($platformRow->payload)->not->toContain('EAAB-token-vitrina')
        ->and($vault->get($platformRef))->toBe('EAAB-token-vitrina')
        ->and(withinTenant(tenantA(), fn () => DB::table('integration_vault_secrets')->where('reference', $platformRef)->exists()))->toBeFalse();
});

it('la conexión de la agencia no puede leer la bóveda de la plataforma', function () {
    $read = fn () => withinTenant(tenantA(), fn () => DB::table('platform_vault_secrets')->count());

    expect($read)->toThrow(QueryException::class);
});
