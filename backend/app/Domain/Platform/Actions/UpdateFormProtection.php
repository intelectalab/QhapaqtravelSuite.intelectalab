<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Integrations\Adapters\TurnstileClient;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\FormProtection;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class UpdateFormProtection
{
    public function __construct(
        private readonly FormProtection $settings,
        private readonly TurnstileClient $turnstile,
        private readonly PlatformSession $session,
    ) {}

    public function update(bool $enabled, string $siteKey, ?string $secret, PlatformUser $actor): array
    {
        $siteKey = trim($siteKey);
        $secret = $secret === null || trim($secret) === '' ? null : trim($secret);
        $before = $this->settings->summary();
        $effective = $secret ?? $this->settings->secret();

        if ($enabled && ($siteKey === '' || $effective === '')) {
            throw ApiException::unprocessable('CFG-CAPTCHA-01', 'Para activarla necesitas la clave del sitio y la clave secreta de Turnstile.');
        }

        $changes = array_filter([
            'Protección de formularios' => $before['enabled'] !== $enabled ? [$before['enabled'] ? 'activa' : 'apagada', $enabled ? 'activa' : 'apagada'] : null,
            'Clave del sitio de Turnstile' => $before['site_key'] !== $siteKey ? [$before['site_key'] ?: null, $siteKey ?: null] : null,
            'Clave secreta de Turnstile' => $secret !== null && $secret !== $this->settings->secret() ? [$before['secret_set'] ? 'configurada' : null, 'cambiada'] : null,
        ]);

        if ($changes === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        $verifiedAt = null;
        if ($effective !== '' && ($secret !== null || ($enabled && ! $before['enabled']))) {
            $problem = $this->turnstile->secretProblem($effective);
            if ($problem !== null) {
                throw ApiException::unprocessable('CFG-CAPTCHA-02', $problem);
            }
            $verifiedAt = now()->toIso8601String();
        }

        DB::connection('pgsql_platform')->transaction(function () use ($enabled, $siteKey, $secret, $verifiedAt, $actor, $changes): void {
            $this->settings->store($enabled, $siteKey, $secret, $verifiedAt, (string) $actor->getKey());
            foreach ($changes as $field => [$old, $new]) {
                $this->session->log(UpdatePlatformSettings::ENTITY, $field, 'actualizar', $old, $new, $actor);
            }
        });

        return $this->settings->summary();
    }
}
