<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Adapters;

use Illuminate\Support\Carbon;

final class FxPublication
{
    public static function rate(mixed $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '' || ! is_numeric($value) || (float) $value <= 0) {
            return null;
        }

        return sprintf('%.6f', round((float) $value, 3));
    }

    public static function source(string $provider, string $publishedOn, string $requested): string
    {
        return $publishedOn === $requested ? $provider : $provider.' · publicado el '.Carbon::parse($publishedOn)->format('d/m/Y');
    }
}
