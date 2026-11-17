<?php

declare(strict_types=1);

namespace App\Http\Routing;

use App\Http\Middleware\EnsurePlatformUser;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;

final class RoutePermissions
{
    public static function agency(Request $request): array
    {
        return self::collect($request, ['permission:', PermissionMiddleware::class.':'], fn (string $params): array => preg_split('/[|,]/', $params) ?: []);
    }

    public static function platform(Request $request): array
    {
        return self::collect($request, ['platform.user:', EnsurePlatformUser::class.':'], fn (string $params): array => array_slice(explode(',', $params), 1));
    }

    private static function collect(Request $request, array $prefixes, callable $split): array
    {
        $found = [];

        foreach ($request->route()?->gatherMiddleware() ?? [] as $middleware) {
            if (! is_string($middleware)) {
                continue;
            }

            foreach ($prefixes as $prefix) {
                if (str_starts_with($middleware, $prefix)) {
                    array_push($found, ...$split(substr($middleware, strlen($prefix))));
                }
            }
        }

        return array_values(array_unique(array_filter(array_map('trim', $found))));
    }
}
