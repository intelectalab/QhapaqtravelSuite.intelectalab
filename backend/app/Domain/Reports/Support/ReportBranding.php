<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Platform\Models\Tenant;

final class ReportBranding
{
    public static function for(Tenant $tenant): array
    {
        $branding = (array) (((array) $tenant->settings)['branding'] ?? []);

        return [
            'name' => (string) $tenant->commercial_name,
            'legal_name' => (string) $tenant->legal_name,
            'ruc' => (string) $tenant->ruc,
            'initials' => (string) ($tenant->logo_initials ?: mb_substr((string) $tenant->commercial_name, 0, 2)),
            'brand' => self::color($branding['brand'] ?? null, '#b3263e'),
            'accent' => self::color($branding['accent'] ?? null, '#26357a'),
            'ink' => self::color($branding['menu'] ?? null, '#141a33'),
        ];
    }

    private static function color(mixed $value, string $fallback): string
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1 ? $value : $fallback;
    }
}
