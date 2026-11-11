<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Integrations\Contracts\CaptchaVerifier;
use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class VerifyCaptcha
{
    public const HEADER = 'X-Captcha-Token';

    public function __construct(private readonly CaptchaVerifier $captcha) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header(self::HEADER) ?? $request->input('captcha_token');

        if (! $this->captcha->verify(is_string($token) ? $token : null, $request->ip())) {
            throw ApiException::unprocessable('CAPTCHA_FAILED', 'No pudimos comprobar que el envío lo hace una persona. Recarga la página e inténtalo de nuevo.');
        }

        return $next($request);
    }
}
