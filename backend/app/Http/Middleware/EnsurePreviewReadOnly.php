<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Channels\Actions\B2bPortalPreview;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

final class EnsurePreviewReadOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user instanceof User ? $user->currentAccessToken() : null;
        $abilities = $token instanceof PersonalAccessToken ? (array) $token->abilities : [];

        if (in_array(B2bPortalPreview::ABILITY, $abilities, true) && ! $request->isMethodSafe()) {
            throw ApiException::forbidden('PREVIEW_READ_ONLY', 'Estás previsualizando el portal en modo solo lectura: no se pueden hacer cambios.');
        }

        return $next($request);
    }
}
