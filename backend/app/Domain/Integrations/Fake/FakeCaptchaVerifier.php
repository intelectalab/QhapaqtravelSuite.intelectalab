<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\CaptchaVerifier;
use App\Domain\Integrations\Data\AdapterResult;

final class FakeCaptchaVerifier implements CaptchaVerifier
{
    public const FAILING_TOKEN = 'fake-captcha-fail';

    public function verify(?string $token, ?string $ip = null): bool
    {
        return $token !== self::FAILING_TOKEN;
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
