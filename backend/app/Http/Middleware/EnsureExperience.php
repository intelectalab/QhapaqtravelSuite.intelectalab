<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class EnsureExperience
{
    public const SHARED = 'shared';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $next($request);
        }

        $required = self::requiredFor((string) $request->route()?->getName());

        if ($required === self::SHARED) {
            return $next($request);
        }

        $access = RoleExperience::for($user);

        if ($access['experience'] !== $required) {
            throw $required === 'backoffice'
                ? ApiException::forbidden('SEC-BR-05', "Esta pantalla pertenece al back-office interno de la agencia y no está disponible para usuarios externos ({$access['role']}).")
                : ApiException::forbidden('EXPERIENCE_MISMATCH', 'Esta sección pertenece a un portal externo y no está disponible desde el back-office.');
        }

        return $next($request);
    }

    public static function requiredFor(string $routeName): string
    {
        foreach (config('access.experience_routes', []) as $experience => $prefixes) {
            foreach ($prefixes as $prefix) {
                if ($routeName === $prefix || (str_ends_with($prefix, '.') && Str::startsWith($routeName, $prefix))) {
                    return $experience;
                }
            }
        }

        return 'backoffice';
    }
}
