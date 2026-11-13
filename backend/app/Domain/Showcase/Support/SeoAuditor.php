<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

final class SeoAuditor
{
    public const CHECKS = [
        'title' => 'Título entre 30 y 60 caracteres',
        'description' => 'Meta descripción entre 70 y 160 caracteres',
        'h1' => 'Un solo H1',
        'words' => 'Texto con 300 palabras o más',
        'alt' => 'Imágenes con texto alternativo',
        'schema' => 'Datos estructurados (schema.org)',
        'canonical' => 'URL canónica',
        'speed' => 'Velocidad móvil de 80 o más',
        'keyword' => 'Palabra clave definida',
    ];

    public static function audit(array $page): array
    {
        $title = mb_strlen((string) ($page['title'] ?? ''));
        $description = mb_strlen((string) ($page['meta_description'] ?? ''));
        $passed = [
            'title' => $title >= 30 && $title <= 60,
            'description' => $description >= 70 && $description <= 160,
            'h1' => (int) ($page['h1_count'] ?? 0) === 1,
            'words' => (int) ($page['word_count'] ?? 0) >= 300,
            'alt' => (int) ($page['images'] ?? 0) === (int) ($page['images_with_alt'] ?? 0),
            'schema' => ($page['schema_types'] ?? []) !== [],
            'canonical' => ! blank($page['canonical_url'] ?? null),
            'speed' => (int) ($page['speed_mobile'] ?? 0) >= 80,
            'keyword' => ! blank($page['focus_keyword'] ?? null),
        ];
        $issues = array_map(fn (string $key) => ['code' => $key, 'label' => self::CHECKS[$key]], array_keys(array_filter($passed, fn (bool $ok) => ! $ok)));

        return ['score' => (int) round(100 * count(array_filter($passed)) / count($passed)), 'issues' => $issues];
    }
}
