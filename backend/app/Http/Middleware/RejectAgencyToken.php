<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use App\Http\Routing\RoutePermissions;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class RejectAgencyToken
{
    private const PLATFORM_PERMISSION = 'admin.tenant.manage';

    public function handle(Request $request, Closure $next): Response
    {
        $bearer = $request->bearerToken();

        if ($bearer !== null && $this->belongsToAgency($bearer)) {
            throw ApiException::forbidden('PLATFORM_ONLY', 'Esta sección es solo para la administración de la plataforma.', RoutePermissions::platform($request) ?: [self::PLATFORM_PERMISSION]);
        }

        return $next($request);
    }

    private function belongsToAgency(string $bearer): bool
    {
        $hash = hash('sha256', str_contains($bearer, '|') ? explode('|', $bearer, 2)[1] : $bearer);

        return DB::selectOne('select tenant_id from app_resolve_access_token(?)', [$hash]) !== null;
    }
}
