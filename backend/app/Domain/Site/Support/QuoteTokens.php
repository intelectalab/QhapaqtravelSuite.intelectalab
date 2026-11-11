<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;

final class QuoteTokens
{
    public const TTL_MINUTES = 30;

    public const SITE = 'site';

    public const ENGINE = 'engine';

    public static function issue(string $tenantId, string $productId, array $quote, string $kind = self::SITE): array
    {
        $expires = Carbon::now()->addMinutes(self::TTL_MINUTES);
        $body = self::encode(json_encode([
            't' => $tenantId,
            'k' => $kind,
            'p' => $productId,
            'd' => $quote['date'],
            'x' => $quote['pax'],
            's' => self::fingerprint($quote['extras'] ?? []),
            'a' => $quote['total'],
            'c' => $quote['currency'],
            'e' => $expires->getTimestamp(),
        ], JSON_UNESCAPED_UNICODE));

        return ['quote_token' => $body.'.'.self::sign($body), 'quote_expires_at' => $expires->toIso8601String()];
    }

    public static function verify(string $token, string $tenantId, string $productId, array $quote): void
    {
        $claims = self::read($token, $tenantId);

        if ($claims === null || ($claims['k'] ?? null) !== self::SITE) {
            throw ApiException::unprocessable('QUOTE_TOKEN_INVALID', 'La cotización venció. Vuelve a calcular el precio.', ['quote_token' => ['La cotización venció. Vuelve a calcular el precio.']]);
        }

        $same = $claims['p'] === $productId && $claims['d'] === $quote['date'] && $claims['x'] == $quote['pax']
            && $claims['s'] === self::fingerprint($quote['extras'] ?? []) && $claims['c'] === $quote['currency'];

        if (! $same || $claims['a'] !== $quote['total']) {
            throw ApiException::conflict('QUOTE_CHANGED', 'El precio cambió desde que lo cotizaste. Revisa el nuevo total.', ['quote' => $quote]);
        }
    }

    public static function read(string $token, string $tenantId): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2 || ! hash_equals(self::sign($parts[0]), $parts[1])) {
            return null;
        }

        $claims = json_decode((string) base64_decode(strtr($parts[0], '-_', '+/'), true), true);

        return is_array($claims) && ($claims['t'] ?? null) === $tenantId && (int) ($claims['e'] ?? 0) >= Carbon::now()->getTimestamp() ? $claims : null;
    }

    private static function fingerprint(array $extras): string
    {
        return hash('sha256', (string) json_encode($extras, JSON_UNESCAPED_UNICODE));
    }

    private static function sign(string $body): string
    {
        return self::encode(hash_hmac('sha256', 'quote|'.$body, (string) config('app.key'), true));
    }

    private static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
