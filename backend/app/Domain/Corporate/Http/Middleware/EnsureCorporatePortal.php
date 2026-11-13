<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Http\Middleware;

use App\Domain\Corporate\Support\CorporatePortalRule;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureCorporatePortal
{
    public function __construct(private readonly CorporatePortalRule $rule) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->rule->assert();

        return $next($request);
    }
}
