<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Support\SiteDesign;

final class ThemeTokens
{
    public const MIN_CONTRAST = 4.5;

    public const RADIUS_MAX = 28;

    public const CORNER_PX = ['rectas' => 4, 'suaves' => 12, 'redondeadas' => 24];

    public static function fromDesign(array $design): array
    {
        return [
            'side' => $design['theme']['menu'],
            'accent' => $design['theme']['brand'],
            'sun' => $design['andes']['gold'],
            'radius' => self::CORNER_PX[$design['theme']['corners']] ?? 12,
            'sections' => $design['sections'],
        ];
    }

    public static function rules(): array
    {
        $hex = ['sometimes', 'required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];

        return [
            'side' => $hex,
            'accent' => $hex,
            'sun' => $hex,
            'radius' => ['sometimes', 'required', 'integer', 'between:0,'.self::RADIUS_MAX],
            'sections' => ['sometimes', 'array', 'size:'.count(SiteDesign::SECTIONS)],
            'sections.*.id' => ['required', 'distinct', 'in:'.implode(',', array_keys(SiteDesign::SECTIONS))],
            'sections.*.visible' => ['required', 'boolean'],
        ];
    }

    public static function messages(): array
    {
        return [
            'side.regex' => 'El color de marca debe tener el formato #RRGGBB.',
            'accent.regex' => 'El color de botones y enlaces debe tener el formato #RRGGBB.',
            'sun.regex' => 'El color de acento debe tener el formato #RRGGBB.',
            'radius.between' => 'El redondeo de las tarjetas va de 0 a '.self::RADIUS_MAX.' px.',
            'sections.size' => 'Envía todas las secciones de la portada, cada una con su visibilidad.',
            'sections.*.id.in' => 'Esa sección no existe en el sitio.',
            'sections.*.id.distinct' => 'Hay secciones repetidas.',
        ];
    }

    public static function ensureContrast(array $tokens): void
    {
        if (isset($tokens['accent']) && SiteDesign::contrast(strtolower($tokens['accent']), '#ffffff') < self::MIN_CONTRAST) {
            throw ApiException::unprocessable('THEME_CONTRAST', 'El color de botones y enlaces tiene contraste '.number_format(SiteDesign::contrast(strtolower($tokens['accent']), '#ffffff'), 1, ',', '').':1 sobre blanco; el mínimo es 4,5:1. Elige un tono más oscuro.', ['field' => 'accent']);
        }

        if (isset($tokens['sun']) && SiteDesign::andesErrors(['gold' => $tokens['sun']]) !== []) {
            throw ApiException::unprocessable('THEME_CONTRAST', 'El color de acento es muy oscuro para el texto de los botones. Elige un tono más claro.', ['field' => 'sun']);
        }
    }

    public static function toChanges(array $tokens): array
    {
        $changes = ['theme' => [], 'andes' => []];

        if (isset($tokens['side']) || isset($tokens['accent'])) {
            $changes['theme']['colors'] = 'propios';
        }

        if (isset($tokens['side'])) {
            $changes['theme']['menu'] = strtolower($tokens['side']);
        }

        if (isset($tokens['accent'])) {
            $changes['theme']['brand'] = strtolower($tokens['accent']);
        }

        if (isset($tokens['sun'])) {
            $changes['andes']['gold'] = strtolower($tokens['sun']);
        }

        if (isset($tokens['radius'])) {
            $changes['theme']['corners'] = self::corners((int) $tokens['radius']);
        }

        if (isset($tokens['sections'])) {
            $changes['sections'] = array_map(fn (array $section): array => ['id' => (string) $section['id'], 'visible' => (bool) $section['visible']], array_values($tokens['sections']));
        }

        return $changes;
    }

    public static function corners(int $radius): string
    {
        return match (true) {
            $radius <= 4 => 'rectas',
            $radius <= 16 => 'suaves',
            default => 'redondeadas',
        };
    }
}
