<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Platform\Support\Entitlements;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureFeature
{
    public const CODE = 'FEATURE_NOT_IN_PLAN';

    public function __construct(private readonly TenantContext $context, private readonly Entitlements $entitlements) {}

    public function handle(Request $request, Closure $next, ?string $feature = null): Response
    {
        $tenantId = $this->context->id();
        $feature = $feature ?: self::featureForPath($request->path());

        if ($tenantId !== null && $feature !== null && ! $this->entitlements->enabled($tenantId, $feature)) {
            throw ApiException::forbidden(self::CODE, 'El plan de tu agencia no incluye '.$this->entitlements->label($feature).'. Para usarlo, la administración puede mejorar el plan desde Suscripción.');
        }

        return $next($request);
    }

    public static function featureForPath(string $path): ?string
    {
        $relative = preg_replace('#^/?api/v1/#', '', $path) ?? $path;

        return self::longestMatch($relative, array_merge_recursive((array) config('entitlements.api', []), (array) config('entitlements.public', [])));
    }

    public static function featureForScreen(string $path): ?string
    {
        return self::longestMatch($path, (array) config('entitlements.screens', []));
    }

    private static function longestMatch(string $path, array $map): ?string
    {
        $best = null;
        $length = -1;

        foreach ($map as $feature => $prefixes) {
            foreach ($prefixes as $prefix) {
                if (($path === $prefix || str_starts_with($path, rtrim($prefix, '/').'/')) && strlen($prefix) > $length) {
                    $best = $feature;
                    $length = strlen($prefix);
                }
            }
        }

        return $best;
    }
}
