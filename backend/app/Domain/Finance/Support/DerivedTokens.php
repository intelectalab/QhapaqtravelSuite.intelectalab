<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Tenancy\TenantContext;

final class DerivedTokens
{
    public static function for(string $purpose, string $id): string
    {
        return rtrim(strtr(base64_encode(hash_hmac('sha256', "{$purpose}|{$id}", (string) config('app.key'), true)), '+/', '-_'), '=');
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function siteUrl(string $path): string
    {
        $tenant = app(TenantContext::class)->tenant();
        $domain = (string) config('sites.domain');
        $host = $tenant->custom_domain ?: "{$tenant->subdomain}.{$domain}";

        return 'https://'.$host.'/'.ltrim($path, '/');
    }
}
