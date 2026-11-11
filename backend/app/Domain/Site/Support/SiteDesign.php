<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use Illuminate\Support\Carbon;

final class SiteDesign
{
    public const FONTS = ['moderna' => 'Moderna', 'clasica' => 'Clásica', 'redondeada' => 'Redondeada', 'editorial' => 'Editorial'];

    public const CORNERS = ['suaves' => 'Suaves', 'rectas' => 'Rectas', 'redondeadas' => 'Muy redondeadas'];

    public const COLOR_SOURCES = ['panel' => 'Los mismos del panel', 'propios' => 'Colores propios del sitio'];

    public const HERO_STYLES = ['noche' => 'Noche andina', 'color' => 'Color sólido', 'imagen' => 'Imagen propia'];

    public const HERO_ALIGN = ['izquierda' => 'A la izquierda', 'centro' => 'Centrado'];

    public const ANNOUNCEMENT_MODES = ['cms' => 'El banner publicado en el CMS', 'propio' => 'Un aviso propio', 'oculto' => 'Sin aviso'];

    public const PROMO_TONES = ['marca' => 'Color principal', 'acento' => 'Color de acento', 'menu' => 'Color oscuro'];

    public const SECTIONS = [
        'destinations' => 'Destinos',
        'featured' => 'Tours y paquetes destacados',
        'promos' => 'Banners promocionales',
        'offers' => 'Ofertas vigentes',
        'departures' => 'Salidas grupales',
        'reasons' => 'Por qué elegirnos',
        'reviews' => 'Opiniones',
        'newsletter' => 'Boletín',
    ];

    public const NAV_LINKS = [
        'destinations' => 'Destinos',
        'tours' => 'Tours',
        'packages' => 'Paquetes',
        'experiences' => 'Experiencias',
        'transfers' => 'Traslados',
        'offers' => 'Ofertas',
        'tailored' => 'Viajes a medida',
        'contact' => 'Contacto',
    ];

    public const SOCIAL = ['facebook' => 'Facebook', 'instagram' => 'Instagram', 'tiktok' => 'TikTok', 'youtube' => 'YouTube', 'whatsapp' => 'WhatsApp'];

    public const LOCALES = ['es', 'en'];

    public const TEXTS = [
        'header.tagline' => 60,
        'header.quote' => 30,
        'header.links.destinations' => 30,
        'header.links.tours' => 30,
        'header.links.packages' => 30,
        'header.links.experiences' => 30,
        'header.links.transfers' => 30,
        'header.links.offers' => 30,
        'header.links.tailored' => 30,
        'header.links.contact' => 30,
        'home.heroTitle' => 90,
        'home.heroBody' => 240,
        'home.destinations.eyebrow' => 40,
        'home.destinations.title' => 90,
        'home.destinations.description' => 200,
        'home.destinations.more' => 40,
        'home.featured.eyebrow' => 40,
        'home.featured.title' => 90,
        'home.featured.description' => 200,
        'home.featured.more' => 40,
        'home.offers.eyebrow' => 40,
        'home.offers.title' => 90,
        'home.offers.description' => 200,
        'home.departures.eyebrow' => 40,
        'home.departures.title' => 90,
        'home.departures.description' => 200,
        'home.departures.more' => 40,
        'home.priceTitle' => 60,
        'home.priceText' => 200,
        'home.formalTitle' => 60,
        'home.reviewsTitle' => 60,
        'home.reviews.eyebrow' => 40,
        'home.reviews.title' => 90,
        'home.reviews.description' => 200,
        'newsletter.title' => 90,
        'newsletter.body' => 240,
        'footer.about' => 240,
        'footer.explore' => 40,
        'footer.help' => 40,
        'footer.contactTitle' => 40,
    ];

    public const MAX_PROMOS = 6;

    private const LINK = '/^(\/[^\s]*|https:\/\/[^\s]+)$/u';

    public static function defaults(): array
    {
        return [
            'theme' => ['colors' => 'panel', 'brand' => '#b3263e', 'accent' => '#26357a', 'menu' => '#141a33', 'font' => 'moderna', 'corners' => 'suaves'],
            'hero' => ['style' => 'noche', 'image_id' => null, 'overlay' => 45, 'align' => 'izquierda', 'show_search' => true, 'show_stats' => true],
            'sections' => array_map(fn (string $id): array => ['id' => $id, 'visible' => true], array_keys(self::SECTIONS)),
            'announcement' => ['mode' => 'cms', 'text' => '', 'link_label' => '', 'link_href' => ''],
            'promos' => [],
            'nav' => [
                'links' => array_map(fn (string $id): array => ['id' => $id, 'visible' => true], array_keys(self::NAV_LINKS)),
                'show_locale' => true,
                'show_theme' => true,
                'show_cart' => true,
                'show_quote' => true,
            ],
            'footer' => ['show_sedes' => true, 'show_fx' => true, 'social' => array_fill_keys(array_keys(self::SOCIAL), '')],
            'seo' => ['title' => '', 'description' => ''],
            'texts' => ['es' => (object) [], 'en' => (object) []],
        ];
    }

    public static function rules(): array
    {
        $hex = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $link = ['nullable', 'string', 'max:200', 'regex:'.self::LINK];
        $in = fn (array $options): string => 'in:'.implode(',', array_keys($options));

        $rules = [
            'design' => ['required', 'array'],
            'design.theme' => ['required', 'array'],
            'design.theme.colors' => ['required', $in(self::COLOR_SOURCES)],
            'design.theme.brand' => $hex,
            'design.theme.accent' => $hex,
            'design.theme.menu' => $hex,
            'design.theme.font' => ['required', $in(self::FONTS)],
            'design.theme.corners' => ['required', $in(self::CORNERS)],
            'design.hero' => ['required', 'array'],
            'design.hero.style' => ['required', $in(self::HERO_STYLES)],
            'design.hero.image_id' => ['nullable', 'uuid', 'required_if:design.hero.style,imagen'],
            'design.hero.overlay' => ['required', 'integer', 'between:0,85'],
            'design.hero.align' => ['required', $in(self::HERO_ALIGN)],
            'design.hero.show_search' => ['required', 'boolean'],
            'design.hero.show_stats' => ['required', 'boolean'],
            'design.sections' => ['required', 'array', 'size:'.count(self::SECTIONS)],
            'design.sections.*.id' => ['required', 'distinct', $in(self::SECTIONS)],
            'design.sections.*.visible' => ['required', 'boolean'],
            'design.announcement' => ['required', 'array'],
            'design.announcement.mode' => ['required', $in(self::ANNOUNCEMENT_MODES)],
            'design.announcement.text' => ['nullable', 'string', 'max:140', 'required_if:design.announcement.mode,propio'],
            'design.announcement.link_label' => ['nullable', 'string', 'max:40', 'required_with:design.announcement.link_href'],
            'design.announcement.link_href' => $link,
            'design.promos' => ['present', 'array', 'max:'.self::MAX_PROMOS],
            'design.promos.*.id' => ['required', 'string', 'max:40', 'distinct'],
            'design.promos.*.title' => ['required', 'string', 'max:80'],
            'design.promos.*.body' => ['nullable', 'string', 'max:200'],
            'design.promos.*.image_id' => ['nullable', 'uuid'],
            'design.promos.*.cta_label' => ['nullable', 'string', 'max:30', 'required_with:design.promos.*.cta_href'],
            'design.promos.*.cta_href' => $link,
            'design.promos.*.tone' => ['required', $in(self::PROMO_TONES)],
            'design.promos.*.starts_on' => ['nullable', 'date_format:Y-m-d'],
            'design.promos.*.ends_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:design.promos.*.starts_on'],
            'design.promos.*.visible' => ['required', 'boolean'],
            'design.nav' => ['required', 'array'],
            'design.nav.links' => ['required', 'array', 'size:'.count(self::NAV_LINKS)],
            'design.nav.links.*.id' => ['required', 'distinct', $in(self::NAV_LINKS)],
            'design.nav.links.*.visible' => ['required', 'boolean'],
            'design.nav.show_locale' => ['required', 'boolean'],
            'design.nav.show_theme' => ['required', 'boolean'],
            'design.nav.show_cart' => ['required', 'boolean'],
            'design.nav.show_quote' => ['required', 'boolean'],
            'design.footer' => ['required', 'array'],
            'design.footer.show_sedes' => ['required', 'boolean'],
            'design.footer.show_fx' => ['required', 'boolean'],
            'design.footer.social' => ['present', 'array'],
            'design.seo' => ['required', 'array'],
            'design.seo.title' => ['nullable', 'string', 'max:70'],
            'design.seo.description' => ['nullable', 'string', 'max:160'],
            'design.texts' => ['present', 'array'],
        ];

        foreach (array_keys(self::SOCIAL) as $network) {
            $rules["design.footer.social.{$network}"] = ['nullable', 'string', 'max:200', 'regex:/^https:\/\/[^\s]+$/u'];
        }

        foreach (self::LOCALES as $locale) {
            $rules["design.texts.{$locale}"] = ['nullable', 'array'];
        }

        return $rules;
    }

    public static function messages(): array
    {
        return [
            'design.theme.*.regex' => 'Los colores deben tener el formato #RRGGBB.',
            'design.hero.image_id.required_if' => 'Sube o elige la imagen de la portada.',
            'design.hero.overlay.*' => 'El oscurecido de la imagen va de 0 a 85 %.',
            'design.announcement.text.required_if' => 'Escribe el texto del aviso.',
            'design.announcement.text.max' => 'El aviso admite hasta 140 caracteres.',
            'design.announcement.link_label.required_with' => 'Ponle un texto al enlace del aviso.',
            'design.announcement.link_href.regex' => 'El enlace debe empezar con / (una página del sitio) o con https://.',
            'design.promos.max' => 'Puedes tener hasta '.self::MAX_PROMOS.' banners.',
            'design.promos.*.title.required' => 'Cada banner necesita un título.',
            'design.promos.*.title.max' => 'El título del banner admite hasta 80 caracteres.',
            'design.promos.*.body.max' => 'El texto del banner admite hasta 200 caracteres.',
            'design.promos.*.cta_label.required_with' => 'Ponle un texto al botón del banner.',
            'design.promos.*.cta_href.regex' => 'El enlace del banner debe empezar con / o con https://.',
            'design.promos.*.ends_on.after_or_equal' => 'El banner no puede terminar antes de empezar.',
            'design.footer.social.*.regex' => 'Las redes sociales deben ser enlaces https://.',
            'design.seo.title.max' => 'El título para buscadores admite hasta 70 caracteres.',
            'design.seo.description.max' => 'La descripción para buscadores admite hasta 160 caracteres.',
        ];
    }

    public static function textErrors(array $texts): array
    {
        $errors = [];

        foreach ($texts as $locale => $values) {
            if (! in_array($locale, self::LOCALES, true)) {
                $errors["design.texts.{$locale}"] = ['Ese idioma no está disponible en el sitio.'];

                continue;
            }

            foreach ((array) $values as $key => $value) {
                if (! array_key_exists((string) $key, self::TEXTS)) {
                    $errors["design.texts.{$locale}.{$key}"] = ['Ese texto no se puede personalizar.'];
                } elseif (! is_string($value) && $value !== null) {
                    $errors["design.texts.{$locale}.{$key}"] = ['El texto debe ser una frase.'];
                } elseif (is_string($value) && mb_strlen($value) > self::TEXTS[$key]) {
                    $errors["design.texts.{$locale}.{$key}"] = ['Este texto admite hasta '.self::TEXTS[$key].' caracteres.'];
                }
            }
        }

        return $errors;
    }

    public static function normalize(array $design): array
    {
        $defaults = self::defaults();
        $theme = [...$defaults['theme'], ...array_intersect_key((array) ($design['theme'] ?? []), $defaults['theme'])];

        foreach (['brand', 'accent', 'menu'] as $color) {
            $theme[$color] = strtolower((string) $theme[$color]);
        }

        $hero = [...$defaults['hero'], ...array_intersect_key((array) ($design['hero'] ?? []), $defaults['hero'])];
        $hero['overlay'] = (int) $hero['overlay'];
        $hero['image_id'] = $hero['image_id'] ?: null;

        foreach (['show_search', 'show_stats'] as $flag) {
            $hero[$flag] = (bool) $hero[$flag];
        }

        $announcement = [...$defaults['announcement'], ...array_intersect_key((array) ($design['announcement'] ?? []), $defaults['announcement'])];
        $announcement = array_map(fn (mixed $value): string => trim((string) $value), $announcement);

        $nav = (array) ($design['nav'] ?? []);
        $footer = (array) ($design['footer'] ?? []);
        $social = [];

        foreach (array_keys(self::SOCIAL) as $network) {
            $social[$network] = trim((string) ($footer['social'][$network] ?? ''));
        }

        return [
            'theme' => $theme,
            'hero' => $hero,
            'sections' => self::ordered((array) ($design['sections'] ?? []), array_keys(self::SECTIONS)),
            'announcement' => $announcement,
            'promos' => array_values(array_map(fn (array $promo): array => [
                'id' => (string) $promo['id'],
                'title' => trim((string) $promo['title']),
                'body' => trim((string) ($promo['body'] ?? '')),
                'image_id' => ($promo['image_id'] ?? null) ?: null,
                'cta_label' => trim((string) ($promo['cta_label'] ?? '')),
                'cta_href' => trim((string) ($promo['cta_href'] ?? '')),
                'tone' => (string) $promo['tone'],
                'starts_on' => ($promo['starts_on'] ?? null) ?: null,
                'ends_on' => ($promo['ends_on'] ?? null) ?: null,
                'visible' => (bool) $promo['visible'],
            ], array_slice((array) ($design['promos'] ?? []), 0, self::MAX_PROMOS))),
            'nav' => [
                'links' => self::ordered((array) ($nav['links'] ?? []), array_keys(self::NAV_LINKS)),
                'show_locale' => (bool) ($nav['show_locale'] ?? true),
                'show_theme' => (bool) ($nav['show_theme'] ?? true),
                'show_cart' => (bool) ($nav['show_cart'] ?? true),
                'show_quote' => (bool) ($nav['show_quote'] ?? true),
            ],
            'footer' => ['show_sedes' => (bool) ($footer['show_sedes'] ?? true), 'show_fx' => (bool) ($footer['show_fx'] ?? true), 'social' => $social],
            'seo' => ['title' => trim((string) ($design['seo']['title'] ?? '')), 'description' => trim((string) ($design['seo']['description'] ?? ''))],
            'texts' => self::texts((array) ($design['texts'] ?? [])),
        ];
    }

    public static function fill(?array $stored): array
    {
        if ($stored === null || $stored === []) {
            return self::defaults();
        }

        $merged = array_replace_recursive(self::defaults(), $stored);
        $merged['sections'] = $stored['sections'] ?? self::defaults()['sections'];
        $merged['promos'] = $stored['promos'] ?? [];
        $merged['nav']['links'] = $stored['nav']['links'] ?? self::defaults()['nav']['links'];
        $merged['texts'] = $stored['texts'] ?? [];

        return self::normalize($merged);
    }

    public static function forVisitors(array $design, Carbon $today): array
    {
        $date = $today->toDateString();
        $design['promos'] = array_values(array_filter($design['promos'], fn (array $promo): bool => $promo['visible']
            && ($promo['starts_on'] === null || $promo['starts_on'] <= $date)
            && ($promo['ends_on'] === null || $promo['ends_on'] >= $date)));

        return $design;
    }

    public static function images(array $design): array
    {
        return array_values(array_unique(array_filter([$design['hero']['image_id'] ?? null, ...array_column($design['promos'] ?? [], 'image_id')])));
    }

    public static function areas(array $before, array $after): array
    {
        $labels = ['theme' => 'Marca y estilo', 'hero' => 'Portada', 'sections' => 'Secciones de la portada', 'announcement' => 'Aviso superior', 'promos' => 'Banners', 'nav' => 'Menú', 'footer' => 'Pie de página', 'seo' => 'Buscadores', 'texts' => 'Textos'];
        $changed = [];

        foreach ($labels as $key => $label) {
            if (json_encode($before[$key] ?? null) !== json_encode($after[$key] ?? null)) {
                $changed[] = $label;
            }
        }

        return $changed;
    }

    public static function catalog(): array
    {
        $options = fn (array $map): array => array_map(fn (string $value, string $label): array => ['value' => $value, 'label' => $label], array_keys($map), $map);

        return [
            'fonts' => $options(self::FONTS),
            'corners' => $options(self::CORNERS),
            'color_sources' => $options(self::COLOR_SOURCES),
            'hero_styles' => $options(self::HERO_STYLES),
            'hero_align' => $options(self::HERO_ALIGN),
            'announcement_modes' => $options(self::ANNOUNCEMENT_MODES),
            'promo_tones' => $options(self::PROMO_TONES),
            'sections' => $options(self::SECTIONS),
            'nav_links' => $options(self::NAV_LINKS),
            'social' => $options(self::SOCIAL),
            'texts' => array_map(fn (string $key, int $max): array => ['key' => $key, 'max' => $max], array_keys(self::TEXTS), self::TEXTS),
            'max_promos' => self::MAX_PROMOS,
        ];
    }

    private static function ordered(array $items, array $ids): array
    {
        $seen = [];
        $result = [];

        foreach ($items as $item) {
            $id = (string) ($item['id'] ?? '');

            if (in_array($id, $ids, true) && ! isset($seen[$id])) {
                $seen[$id] = true;
                $result[] = ['id' => $id, 'visible' => (bool) ($item['visible'] ?? true)];
            }
        }

        foreach ($ids as $id) {
            if (! isset($seen[$id])) {
                $result[] = ['id' => $id, 'visible' => true];
            }
        }

        return $result;
    }

    private static function texts(array $texts): array
    {
        $result = [];

        foreach (self::LOCALES as $locale) {
            $values = [];

            foreach ((array) ($texts[$locale] ?? []) as $key => $value) {
                $value = trim((string) $value);

                if ($value !== '' && array_key_exists((string) $key, self::TEXTS)) {
                    $values[(string) $key] = $value;
                }
            }

            ksort($values);
            $result[$locale] = $values === [] ? (object) [] : $values;
        }

        return $result;
    }
}
