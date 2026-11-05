<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureMfaVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user instanceof User ? $user->currentAccessToken() : null;

        if ($user instanceof User && $token instanceof AccessToken && $user->needsMfa() && ! $token->isMfaVerified()) {
            throw ApiException::forbidden('MFA_REQUIRED', 'Falta confirmar el código de verificación en dos pasos.');
        }

        return $next($request);
    }
}
