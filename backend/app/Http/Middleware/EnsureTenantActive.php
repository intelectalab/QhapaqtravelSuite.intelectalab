<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Platform\Support\ReadOnlyWindow;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

final class EnsureTenantActive
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->context->has() && $this->context->tenant()->isSuspended()) {
            throw ApiException::forbidden('TENANT_SUSPENDED', 'El acceso de tu empresa está suspendido. Comunícate con tu proveedor del sistema.');
        }

        if ($this->context->has() && ! $request->isMethodSafe() && ! ReadOnlyWindow::allows($request->route()?->getName())) {
            $until = ReadOnlyWindow::until((string) $this->context->idOrFail());

            if ($until !== null) {
                throw ApiException::forbidden('TENANT_READ_ONLY', 'Tu cuenta está en solo lectura hasta el '.Carbon::parse($until)->format('d/m/Y').'. Puedes consultar y exportar tus datos; registra un medio de pago o reactiva tu plan para volver a operar.');
            }
        }

        return $next($request);
    }
}
