<?php

declare(strict_types=1);

namespace Database\Support;

use RuntimeException;

final class KitSeeds
{
    public static function read(string $name): array
    {
        $path = base_path("../docs/kit/seeds/{$name}.json");

        if (! is_file($path)) {
            throw new RuntimeException("No se encontró docs/kit/seeds/{$name}.json.");
        }

        return json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
    }
}
