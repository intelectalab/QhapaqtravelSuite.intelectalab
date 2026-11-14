<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Admin\Http\Middleware\AuthenticateApiKey;
use App\Domain\Admin\Http\Middleware\RequireApiScope;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Router;
use Illuminate\Support\Str;

final class ApiKeyEndpoints
{
    public static function all(): array
    {
        return collect(Router::getRoutes()->getRoutes())
            ->filter(fn (Route $route): bool => in_array(AuthenticateApiKey::class, $route->gatherMiddleware(), true))
            ->map(function (Route $route): array {
                $scopes = collect($route->gatherMiddleware())
                    ->filter(fn (mixed $middleware): bool => is_string($middleware) && Str::startsWith($middleware, RequireApiScope::class.':'))
                    ->flatMap(fn (string $middleware): array => explode(',', Str::after($middleware, RequireApiScope::class.':')))
                    ->values()->all();

                return [
                    'method' => collect($route->methods())->reject(fn (string $method): bool => $method === 'HEAD')->first(),
                    'path' => '/'.$route->uri(),
                    'scopes' => $scopes,
                    'label' => collect($scopes)->map(fn (string $scope): string => ApiDirectory::SCOPES[$scope] ?? $scope)->implode(' · '),
                ];
            })
            ->sortBy('path')
            ->values()
            ->all();
    }
}
