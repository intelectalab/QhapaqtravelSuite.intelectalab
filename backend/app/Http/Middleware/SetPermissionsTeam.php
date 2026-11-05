<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

final class SetPermissionsTeam
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly PermissionRegistrar $permissions,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $this->permissions->setPermissionsTeamId($this->context->id());

        return $next($request);
    }
}
