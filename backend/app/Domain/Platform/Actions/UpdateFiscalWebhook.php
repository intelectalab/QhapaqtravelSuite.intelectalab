<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\FiscalWebhookSecret;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class UpdateFiscalWebhook
{
    public const FIELD = 'Secreto del webhook fiscal';

    public function __construct(private readonly FiscalWebhookSecret $settings, private readonly PlatformSession $session) {}

    public function update(?string $secret, bool $clear, PlatformUser $actor): array
    {
        $secret = $secret === null || trim($secret) === '' ? null : trim($secret);
        $current = $this->settings->secret();

        if ($clear ? $current === '' : ($secret === null || $secret === $current)) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        DB::connection('pgsql_platform')->transaction(function () use ($secret, $clear, $current, $actor): void {
            $this->settings->store($clear ? null : $secret, (string) $actor->getKey());
            $this->session->log(UpdatePlatformSettings::ENTITY, self::FIELD, $clear ? 'eliminar' : 'actualizar', $current === '' ? null : 'configurado', $clear ? null : 'cambiado', $actor);
        });

        return $this->settings->summary();
    }
}
