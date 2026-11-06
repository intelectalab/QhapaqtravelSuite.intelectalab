<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsurePlatformUser
{
    public function handle(Request $request, Closure $next, string $stage = 'verified', ?string $permission = null): Response
    {
        $user = $request->user();

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden('PLATFORM_ONLY', 'Esta sección es solo para la administración de la plataforma.');
        }

        $token = $user->currentAccessToken();

        if ($stage === 'verified' && (! $token instanceof AccessToken || ! $token->isMfaVerified())) {
            throw ApiException::forbidden('MFA_REQUIRED', 'Falta confirmar el código de verificación en dos pasos.');
        }

        if ($permission !== null && ! $user->hasPlatformPermission($permission)) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu usuario de plataforma no tiene permiso para esta acción.', [$permission]);
        }

        return $next($request);
    }
}
