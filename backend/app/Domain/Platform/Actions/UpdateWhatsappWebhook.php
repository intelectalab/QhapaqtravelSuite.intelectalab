<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\WhatsappWebhook;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class UpdateWhatsappWebhook
{
    public const FIELD = 'Token de verificación de WhatsApp';

    public function __construct(private readonly WhatsappWebhook $settings, private readonly PlatformSession $session) {}

    public function update(?string $token, bool $clear, PlatformUser $actor): array
    {
        $token = $token === null || trim($token) === '' ? null : trim($token);
        $current = $this->settings->verifyToken();

        if ($clear ? $current === '' : ($token === null || $token === $current)) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        DB::connection('pgsql_platform')->transaction(function () use ($token, $clear, $current, $actor): void {
            $this->settings->store($clear ? null : $token, (string) $actor->getKey());
            $this->session->log(UpdatePlatformSettings::ENTITY, self::FIELD, $clear ? 'eliminar' : 'actualizar', $current === '' ? null : 'configurado', $clear ? null : 'cambiado', $actor);
        });

        return $this->settings->summary();
    }
}
