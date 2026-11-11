<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

final class ReviewLinks
{
    public static function token(string $tenantId, string $code): string
    {
        return rtrim(strtr(base64_encode(hash_hmac('sha256', "review|{$tenantId}|{$code}", (string) config('app.key'), true)), '+/', '-_'), '=');
    }

    public static function hash(string $tenantId, string $code): string
    {
        return hash('sha256', self::token($tenantId, $code));
    }

    public static function url(string $subdomain, string $tenantId, string $code): string
    {
        return WidgetHosts::site($subdomain).'/resena/'.rawurlencode($code).'?t='.self::token($tenantId, $code);
    }
}
