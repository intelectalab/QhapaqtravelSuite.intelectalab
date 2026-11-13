<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Http\Middleware;

use App\Domain\Site\Http\Middleware\ScopeSiteTenant;
use App\Http\Middleware\ResolvePublicSite;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ResolveTrackingSite
{
    public const PLATFORM_SITES = ['vitrina', 'blog', 'landing'];

    public function __construct(private readonly ResolvePublicSite $site, private readonly ScopeSiteTenant $scope) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->input('site'), self::PLATFORM_SITES, true)) {
            return $next($request);
        }

        return $this->site->handle($request, fn (Request $request) => $this->scope->handle($request, $next));
    }
}
