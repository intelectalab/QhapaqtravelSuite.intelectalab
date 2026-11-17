<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PayloadWebhook;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ManagePayloadWebhook
{
    public const ENTITY = 'Blog de la vitrina (Payload)';

    public function __construct(private readonly PayloadWebhook $settings, private readonly PlatformSession $session) {}

    public function overview(): array
    {
        return $this->settings->summary();
    }

    public function updateAdminUrl(string $url, PlatformUser $actor): array
    {
        $url = rtrim(trim($url), '/');
        $before = $this->settings->adminUrl();

        if ($url === rtrim($before, '/')) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        DB::connection('pgsql_platform')->transaction(function () use ($url, $before, $actor): void {
            $this->settings->storeAdminUrl($url, (string) $actor->getKey());
            $this->session->log(self::ENTITY, 'URL del admin de Payload', 'actualizar', $before ?: null, $url, $actor);
        });

        return $this->overview();
    }

    public function generate(PlatformUser $actor): array
    {
        $secret = 'kipu_pl_'.bin2hex(random_bytes(24));

        $rotated = DB::connection('pgsql_platform')->transaction(function () use ($secret, $actor): bool {
            $rotated = $this->settings->storeSecret($secret, (string) $actor->getKey());
            $this->session->log(self::ENTITY, 'Clave de firma', $rotated ? 'rotar' : 'generar', $rotated ? 'configurada' : null, $rotated ? 'rotada · la anterior vale 24 h' : 'generada', $actor);

            return $rotated;
        });

        return [...$this->overview(), 'secret' => $secret, 'rotated' => $rotated];
    }
}
