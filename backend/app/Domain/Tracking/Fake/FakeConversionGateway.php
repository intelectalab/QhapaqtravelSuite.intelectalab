<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Fake;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Tracking\Contracts\ConversionGateway;

final class FakeConversionGateway implements ConversionGateway
{
    public const FAIL_MARKER = 'simular-fallo';

    public function send(string $provider, array $payload): AdapterResult
    {
        if (($payload['secret_ref'] ?? null) === null) {
            return new AdapterResult(false, 'fallido', null, 'permanente', 'Falta el token del proveedor. Guárdalo en la etiqueta para enviar desde el servidor.', ['http_status' => 401]);
        }

        if (str_contains((string) ($payload['reference'] ?? ''), self::FAIL_MARKER)) {
            return new AdapterResult(false, 'fallido', null, 'transitorio', 'El proveedor no respondió a tiempo. Se reintentará.', ['http_status' => 503]);
        }

        return AdapterResult::success('enviado', 'SIM-'.substr(hash('sha256', (string) ($payload['event_id'] ?? '').$provider), 0, 12), ['http_status' => $provider === 'ga4' ? 204 : 200, 'simulated' => true]);
    }
}
