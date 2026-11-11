<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Adapters;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class TurnstileClient
{
    public const ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public const PROBE_TOKEN = 'kipucontrol-prueba-de-clave';

    public function verify(string $secret, ?string $token, ?string $ip = null): bool
    {
        if ($secret === '' || $token === null || trim($token) === '' || strlen($token) > 2048) {
            return false;
        }

        $body = $this->call($secret, $token, $ip);

        return $body !== null && ($body['success'] ?? false) === true;
    }

    public function secretProblem(string $secret): ?string
    {
        $body = $this->call($secret, self::PROBE_TOKEN, null);

        if ($body === null) {
            return 'No pudimos comunicarnos con Cloudflare. Inténtalo de nuevo en unos minutos.';
        }

        return in_array('invalid-input-secret', (array) ($body['error-codes'] ?? []), true) ? 'Cloudflare no reconoce esa clave secreta. Cópiala otra vez desde el panel de Turnstile.' : null;
    }

    private function call(string $secret, string $token, ?string $ip): ?array
    {
        try {
            $response = Http::asForm()->timeout(5)->post(self::ENDPOINT, array_filter(['secret' => $secret, 'response' => $token, 'remoteip' => $ip]));
        } catch (ConnectionException) {
            Log::warning('captcha.turnstile.unreachable');

            return null;
        }

        return $response->successful() || $response->status() === 400 ? (array) $response->json() : null;
    }
}
