<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RequireApiScope
{
    public function handle(Request $request, Closure $next, string ...$scopes): Response
    {
        $key = $request->attributes->get(AuthenticateApiKey::ATTRIBUTE);

        if (! is_array($key) && AuthenticateApiKey::sharesSession($request)) {
            return $next($request);
        }

        if (! is_array($key)) {
            throw ApiException::unauthorized('API_KEY_INVALID', 'Esta ruta se usa con una llave de API.');
        }

        if (array_diff($scopes, $key['scopes']) !== []) {
            throw ApiException::forbidden('API_KEY_SCOPE', 'La llave no tiene el permiso que pide esta ruta. Crea una llave con ese alcance.', array_values($scopes));
        }

        return $next($request);
    }
}
