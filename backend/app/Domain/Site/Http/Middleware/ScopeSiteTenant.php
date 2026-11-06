<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Middleware;

use App\Http\Middleware\SetPostgresTenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ScopeSiteTenant
{
    public function __construct(private readonly SetPostgresTenant $tenantDatabase) {}

    public function handle(Request $request, Closure $next): Response
    {
        return $this->tenantDatabase->handle($request, $next);
    }
}
