<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\OtaConnector;
use App\Domain\Integrations\Data\AdapterResult;

final class FakeOtaConnector implements OtaConnector
{
    public function verify(string $ota, string $accountRef, string $credentials): AdapterResult
    {
        if (mb_strlen($credentials) < 8) {
            return AdapterResult::permanent('La OTA rechazó la clave: revisa que esté completa.');
        }

        if (str_starts_with($accountRef, 'error')) {
            return AdapterResult::permanent('La OTA no reconoce esa cuenta de proveedor.');
        }

        return AdapterResult::success('conectado', strtoupper($ota).'-'.substr(hash('sha256', $accountRef), 0, 8), ['simulated' => true]);
    }

    public function pushAvailability(string $ota, string $accountRef, string $credentials, array $listings): AdapterResult
    {
        if (str_starts_with($accountRef, 'caida')) {
            return AdapterResult::transient('La OTA no respondió a tiempo. Se reintentará en la próxima sincronización.');
        }

        return AdapterResult::success('sincronizado', null, ['simulated' => true, 'listings' => count($listings)]);
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
