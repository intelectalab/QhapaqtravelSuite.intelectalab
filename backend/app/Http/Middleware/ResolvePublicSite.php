<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class ResolvePublicSite
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $site = strtolower((string) $request->route('site'));
        $tenant = DB::connection('pgsql_platform')->table('tenants')->where('subdomain', $site)->whereIn('status', ['activo', 'prueba'])->first(['id']);

        if ($tenant === null) {
            throw ApiException::notFound('Esta agencia no tiene un sitio publicado.');
        }

        $this->context->set((string) $tenant->id);
        $request->attributes->set('tenant_id', (string) $tenant->id);
        $request->route()?->forgetParameter('site');

        return $next($request);
    }
}
