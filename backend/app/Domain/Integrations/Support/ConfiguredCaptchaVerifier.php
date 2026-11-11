<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Integrations\Adapters\TurnstileClient;
use App\Domain\Integrations\Contracts\CaptchaVerifier;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Fake\FakeCaptchaVerifier;
use App\Domain\Platform\Support\FormProtection;

final class ConfiguredCaptchaVerifier implements CaptchaVerifier
{
    public function __construct(
        private readonly FormProtection $settings,
        private readonly TurnstileClient $turnstile,
        private readonly FakeCaptchaVerifier $off,
    ) {}

    public function verify(?string $token, ?string $ip = null): bool
    {
        return $this->settings->active()
            ? $this->turnstile->verify($this->settings->secret(), $token, $ip)
            : $this->off->verify($token, $ip);
    }

    public function healthcheck(): AdapterResult
    {
        return $this->settings->active()
            ? AdapterResult::success('ok')
            : AdapterResult::permanent('La protección de formularios está apagada. Configúrala en la consola, en Configuración.');
    }
}
