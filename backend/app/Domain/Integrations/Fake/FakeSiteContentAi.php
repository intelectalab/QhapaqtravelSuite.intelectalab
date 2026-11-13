<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\SiteContentAi;
use App\Domain\Integrations\Data\AdapterResult;

final class FakeSiteContentAi implements SiteContentAi
{
    private const TONES = [
        'cercano' => 'cálido y directo',
        'profesional' => 'claro y preciso',
        'aventurero' => 'enérgico',
        'lujo' => 'sereno y exclusivo',
        'familiar' => 'tranquilo y cuidadoso',
    ];

    private const OPENINGS = [
        'Una experiencia pensada para disfrutar sin preocupaciones',
        'Una salida para vivir con calma y buena compañía',
        'Un recorrido para conocer el destino a su ritmo',
    ];

    public function write(string $kind, array $source, array $options): array
    {
        $attempt = max(0, (int) ($options['attempt'] ?? 0));
        $after = match ($kind) {
            'meta_seo' => $this->seo($source, $attempt),
            'traducir' => $this->translation($source, (string) ($options['locale'] ?? 'en')),
            'relato_aventura' => $this->story($source, $attempt),
            'articulo' => $this->article($source, $options),
            default => $this->improved($source, $options, $attempt),
        };
        $input = mb_strlen(json_encode($source, JSON_UNESCAPED_UNICODE) ?: '');

        return ['after' => $after, 'model' => 'kipu-fake-writer-1', 'tokens_in' => (int) ceil($input / 4), 'tokens_out' => (int) ceil(mb_strlen(implode(' ', $after)) / 4)];
    }

    public function draw(string $prompt, string $style, int $width, int $height, int $variant): string
    {
        $hue = (abs(crc32($prompt.'|'.$style)) + $variant * 37) % 360;
        $second = ($hue + 30) % 360;
        $sun = 40 + ($hue % 120);

        return '<svg xmlns="http://www.w3.org/2000/svg" width="'.$width.'" height="'.$height.'" viewBox="0 0 200 120" preserveAspectRatio="none">'
            .'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('.$hue.',55%,28%)"/><stop offset="1" stop-color="hsl('.$second.',65%,55%)"/></linearGradient></defs>'
            .'<rect width="200" height="120" fill="url(#g)"/>'
            .'<circle cx="'.$sun.'" cy="34" r="14" fill="#fff" fill-opacity=".35"/>'
            .'<path d="M0 120V80l40-30 30 22 45-44 40 34 45-20v78z" fill="#000" fill-opacity=".25"/>'
            .'<path d="M0 120V98l60-18 50 14 50-12 40 8v30z" fill="#000" fill-opacity=".3"/>'
            .'</svg>';
    }

    public function imageMime(): string
    {
        return 'image/svg+xml';
    }

    public function provider(): string
    {
        return 'fake';
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }

    private function seo(array $source, int $attempt): array
    {
        $name = trim(explode('|', (string) ($source['label'] ?? 'Su tour'))[0]);
        $agency = (string) ($source['agency'] ?? 'Su agencia');
        $hooks = ['salidas diarias, guía profesional y reserva en línea con confirmación inmediata', 'grupos pequeños, guía local y confirmación al momento de reservar'];

        return [
            'title' => mb_substr($name.' | '.$agency, 0, 60),
            'desc' => mb_substr($name.': '.$hooks[$attempt % count($hooks)].'.', 0, 155),
        ];
    }

    private function improved(array $source, array $options, int $attempt): array
    {
        $before = rtrim(trim((string) ($source['before']['text'] ?? '')), '.');
        $includes = array_slice(array_values(array_filter((array) ($source['facts']['includes'] ?? []))), 0, 3);
        $notes = trim((string) ($options['notes'] ?? ''));
        $parts = array_filter([
            $before !== '' ? $before.'.' : null,
            self::OPENINGS[$attempt % count(self::OPENINGS)].($includes !== [] ? ': incluye '.mb_strtolower(implode(', ', $includes)) : '').'.',
            $notes !== '' ? rtrim($notes, '.').'.' : null,
            ! empty($source['facts']['meeting']) ? 'Punto de encuentro: '.$source['facts']['meeting'].'.' : null,
        ]);

        return ['text' => implode(' ', $parts)];
    }

    private function translation(array $source, string $locale): array
    {
        $name = (string) ($source['label'] ?? '');
        $text = $locale === 'pt'
            ? $name.': passeio com guia profissional, transporte e entradas conforme o programa. Reserve online com confirmação imediata.'
            : $name.': guided experience with a professional guide, transport and entrance fees as listed in the program. Book online with instant confirmation.';

        return ['text' => $text];
    }

    private function story(array $source, int $attempt): array
    {
        $city = (string) ($source['facts']['city'] ?? 'Cusco');
        $quote = trim((string) ($source['facts']['quote'] ?? ''));
        $openings = ['Llegaron a '.$city.' con ganas de verlo todo y se fueron con una historia que todavía cuentan.', 'En '.$city.' el viaje empezó antes del amanecer y terminó con una historia para contar.'];

        return ['text' => implode(' ', array_filter([
            $openings[$attempt % count($openings)],
            $quote !== '' ? '«'.$quote.'», nos escribieron al volver.' : null,
            'Así fue su viaje, contado con su permiso.',
        ]))];
    }

    private function article(array $source, array $options): array
    {
        $topic = trim((string) ($options['notes'] ?? '')) ?: 'Qué hacer en '.((string) ($source['facts']['city'] ?? 'Cusco')).' en 3 días';
        $tone = self::TONES[(string) ($options['tone'] ?? '')] ?? 'claro y preciso';
        $tours = array_slice(array_values(array_filter((array) ($source['facts']['tours'] ?? []))), 0, 3);
        $lines = ['# '.$topic, '', 'Borrador con introducción, secciones con subtítulos y preguntas frecuentes, en tono '.$tone.'.'];

        foreach ($tours as $tour) {
            $lines[] = '- '.$tour;
        }

        $lines[] = '';
        $lines[] = 'Revise cifras, horarios y precios antes de publicar.';

        return ['title' => mb_substr($topic, 0, 120), 'text' => implode("\n", $lines)];
    }
}
