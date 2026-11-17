<?php

declare(strict_types=1);

namespace App\Domain\Shared\Audit;

final class AuditActorName
{
    public static function of(?string $name, ?string $type, ?string $role, ?string $fallback = null): ?string
    {
        return $name ?? match ($type) {
            'api_client' => $role ?: 'Integración por API',
            'system' => 'Sistema',
            default => $fallback,
        };
    }
}
