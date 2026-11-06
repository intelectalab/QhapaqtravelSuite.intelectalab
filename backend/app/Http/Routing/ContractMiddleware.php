<?php

declare(strict_types=1);

namespace App\Http\Routing;

use Illuminate\Routing\Router;

final class ContractMiddleware
{
    public static function apply(Router $router): void
    {
        $idempotent = array_flip(config('api_contract.idempotent', []));
        $ifMatch = config('api_contract.if_match', []);

        foreach ($router->getRoutes()->getRoutes() as $route) {
            $name = (string) $route->getName();

            if (isset($idempotent[$name])) {
                $route->middleware('idempotent');
            }

            if (isset($ifMatch[$name])) {
                $route->middleware('if-match:'.$ifMatch[$name]);
            }
        }
    }

    public static function unknown(Router $router): array
    {
        $names = collect($router->getRoutes()->getRoutes())->map(fn ($route) => (string) $route->getName())->flip();

        return collect([...config('api_contract.idempotent', []), ...array_keys(config('api_contract.if_match', []))])
            ->reject(fn (string $name) => $names->has($name))
            ->unique()
            ->values()
            ->all();
    }
}
