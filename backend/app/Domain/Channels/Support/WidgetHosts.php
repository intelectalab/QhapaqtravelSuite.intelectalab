<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

final class WidgetHosts
{
    public static function cdn(): string
    {
        $configured = (string) config('widget.cdn', '');

        return rtrim($configured !== '' ? $configured : self::web().'/widget/v1', '/');
    }

    public static function host(string $tenant): string
    {
        $configured = (string) config('widget.host', '');

        return rtrim($configured !== '' ? str_replace('{tenant}', $tenant, $configured) : self::web(), '/');
    }

    public static function site(string $tenant): string
    {
        $configured = (string) config('widget.site', '');

        return rtrim($configured !== '' ? str_replace('{tenant}', $tenant, $configured) : self::web().'/sitio/'.$tenant, '/');
    }

    private static function web(): string
    {
        return rtrim((string) config('app.frontend_url'), '/');
    }
}
