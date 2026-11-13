<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Fake;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Tracking\Contracts\TagVerifier;
use App\Domain\Tracking\Support\TrackingCatalog;

final class FakeTagVerifier implements TagVerifier
{
    public function verify(object $tag, string $url): AdapterResult
    {
        $provider = TrackingCatalog::provider((string) $tag->provider);

        if ($tag->provider !== 'script' && ! TrackingCatalog::idIsValid((string) $tag->provider, $tag->measurement_id)) {
            return AdapterResult::permanent("{$provider['short']} no cargó: el ID no tiene el formato esperado.");
        }

        if ($tag->provider === 'script' && $tag->script_src !== null && $tag->sri_hash === null) {
            return AdapterResult::permanent('El script externo no tiene hash SRI y el navegador lo bloquea.');
        }

        $target = $tag->provider === 'script' ? 'El script' : $provider['short'];

        return AdapterResult::success('ok', null, ['note' => "Verificación simulada: {$target} cargó en {$url} con cookies aceptadas y envió page_view."]);
    }
}
