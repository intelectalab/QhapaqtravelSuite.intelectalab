<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

interface CaptchaVerifier extends HealthCheckable
{
    public function verify(?string $token, ?string $ip = null): bool;
}
