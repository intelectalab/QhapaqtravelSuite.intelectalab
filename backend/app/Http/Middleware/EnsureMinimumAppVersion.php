<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Platform\Support\MobileAppVersions;
use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureMinimumAppVersion
{
    public function __construct(private readonly MobileAppVersions $versions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $version = $request->headers->get(MobileAppVersions::VERSION_HEADER);

        if ($version === null || $version === '') {
            return $next($request);
        }

        $platform = strtolower((string) $request->headers->get(MobileAppVersions::PLATFORM_HEADER, ''));
        $required = $this->versions->requirement($platform, trim($version));

        if ($required !== null) {
            throw new ApiException(426, 'UPGRADE_REQUIRED', MobileAppVersions::UPGRADE_CODE, "Hay una versión nueva de la app. Actualízala desde la tienda para seguir usándola (versión mínima {$required['min_version']}).", [], [
                'platform' => $platform,
                'current_version' => trim($version),
                'min_version' => $required['min_version'],
                'store_url' => $required['store_url'],
            ]);
        }

        return $next($request);
    }
}
