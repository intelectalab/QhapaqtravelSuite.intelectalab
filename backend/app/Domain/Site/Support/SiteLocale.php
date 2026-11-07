<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use Illuminate\Http\Request;

final class SiteLocale
{
    public const BASE = 'es';

    public const LOCALES = ['es', 'en'];

    public function __construct(private readonly Request $request) {}

    public function current(): string
    {
        $value = mb_strtolower(trim((string) ($this->request->query('locale') ?? $this->request->header('X-Site-Locale', self::BASE))));
        $value = substr($value, 0, 2);

        return in_array($value, self::LOCALES, true) ? $value : self::BASE;
    }

    private const EN = [
        'kinds' => ['tours' => 'Tours and day trips', 'paquetes' => 'Packages and circuits', 'experiencias' => 'Experiences', 'traslados' => 'Transfers'],
        'difficulties' => ['facil' => 'Easy', 'moderada' => 'Moderate', 'moderada_exigente' => 'Moderate to challenging', 'exigente' => 'Challenging'],
        'languages' => ['ES' => 'Spanish', 'EN' => 'English', 'DE' => 'German', 'FR' => 'French', 'PT' => 'Portuguese', 'IT' => 'Italian'],
        'durations' => ['corto' => 'Up to 1 day', 'medio' => '2 to 4 days', 'largo' => '5 days or more'],
        'sorts' => ['recomendados' => 'Recommended', 'precio_asc' => 'Price: low to high', 'precio_desc' => 'Price: high to low', 'duracion' => 'Duration', 'valorados' => 'Top rated'],
        'tags' => ['offer' => 'Deal', 'guaranteed' => 'Guaranteed departure', 'last' => 'Last spots', 'featured' => 'Recommended'],
    ];

    public function translated(): bool
    {
        return $this->current() !== self::BASE;
    }

    public function label(string $group, string $key, string $spanish): string
    {
        return $this->translated() ? (self::EN[$group][$key] ?? $spanish) : $spanish;
    }

    public function duration(string $unit, float $value, string $number): string
    {
        if (! $this->translated()) {
            return match ($unit) {
                'horas' => $number.' h',
                'noches' => $number.($value === 1.0 ? ' noche' : ' noches'),
                default => $value >= 2 ? $number.' días / '.((int) $value - 1).($value - 1 === 1.0 ? ' noche' : ' noches') : '1 día',
            };
        }

        return match ($unit) {
            'horas' => $number.' h',
            'noches' => $number.($value === 1.0 ? ' night' : ' nights'),
            default => $value >= 2 ? $number.' days / '.((int) $value - 1).($value - 1 === 1.0 ? ' night' : ' nights') : '1 day',
        };
    }
}
