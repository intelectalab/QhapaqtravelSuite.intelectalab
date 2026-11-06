<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureTenantActive
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->context->has() && $this->context->tenant()->isSuspended()) {
            throw ApiException::forbidden('TENANT_SUSPENDED', 'El acceso de tu empresa está suspendido. Comunícate con tu proveedor del sistema.');
        }

        return $next($request);
    }
}
