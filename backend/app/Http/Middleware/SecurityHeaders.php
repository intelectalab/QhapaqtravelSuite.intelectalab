<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class SecurityHeaders
{
    private const HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'no-referrer',
        'Cross-Origin-Resource-Policy' => 'same-site',
        'Permissions-Policy' => 'camera=(), microphone=(), geolocation=()',
    ];

    private const JSON_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        foreach (self::HEADERS as $name => $value) {
            $response->headers->set($name, $value, false);
        }
        if (str_contains((string) $response->headers->get('Content-Type', ''), 'json')) {
            $response->headers->set('Content-Security-Policy', self::JSON_POLICY, false);
        }
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains', false);
        }
        $response->headers->remove('X-Powered-By');

        return $response;
    }
}
