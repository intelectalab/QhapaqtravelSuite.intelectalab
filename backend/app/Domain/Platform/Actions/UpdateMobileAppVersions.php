<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\MobileAppVersions;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class UpdateMobileAppVersions
{
    public const ENTITY = 'App móvil';

    public function __construct(private readonly MobileAppVersions $versions, private readonly PlatformSession $session) {}

    public function update(array $data, PlatformUser $actor): array
    {
        $before = [];
        $after = [];

        foreach (array_keys(MobileAppVersions::PLATFORMS) as $platform) {
            $current = $this->versions->platform($platform);
            $before[$platform] = ['min_version' => $current['min_version'], 'store_url' => $current['store_url']];
            $after[$platform] = [
                'min_version' => self::clean($data[$platform]['min_version'] ?? null),
                'store_url' => self::clean($data[$platform]['store_url'] ?? null),
            ];

            if ($after[$platform]['min_version'] !== null && $after[$platform]['store_url'] === null) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Indica el enlace a la tienda de '.MobileAppVersions::PLATFORMS[$platform].': la app lo muestra al pedir la actualización.');
            }
        }

        if ($before === $after) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        DB::connection('pgsql_platform')->transaction(function () use ($before, $after, $actor): void {
            $this->versions->store($after, (string) $actor->getKey());

            foreach ($after as $platform => $values) {
                foreach ($values as $field => $value) {
                    if ($before[$platform][$field] !== $value) {
                        $this->session->log(self::ENTITY, MobileAppVersions::PLATFORMS[$platform].' · '.($field === 'min_version' ? 'versión mínima' : 'enlace a la tienda'), 'actualizar', $before[$platform][$field], $value, $actor);
                    }
                }
            }
        });

        return $this->versions->summary();
    }

    private static function clean(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }
}
