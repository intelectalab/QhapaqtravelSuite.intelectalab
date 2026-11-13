<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\SalesAssistant;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\AiCompletion;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Str;

final class FakeSalesAssistant implements SalesAssistant
{
    public const MODEL = 'kipu-simulado-1';

    private const SAMPLE_NAMES = ['City tour', 'Excursión de día completo', 'Paquete', 'Trekking', 'Traslado privado', 'Tour gastronómico'];

    public function complete(string $kind, string $prompt, array $context): AiCompletion
    {
        $destination = $this->destination($prompt, $context);
        $days = $this->number($prompt, '/(\d{1,2})\s*d[ií]as?/iu', 3, 1, 15);
        $pax = $this->number($prompt, '/(\d{1,2})\s*(pax|personas|pasajeros|adultos|viajeros)/iu', (int) ($context['client']['pax'] ?? 2), 1, 40);
        $products = array_values(array_filter($context['products'] ?? [], fn (array $product): bool => $destination === null || Str::lower(Str::ascii((string) $product['destination'])) === Str::lower(Str::ascii($destination))));
        $place = $destination ?? 'el destino elegido';
        $client = trim((string) ($context['client']['name'] ?? ''));

        $output = match ($kind) {
            'itinerary' => $this->itinerary($days, $place, $products),
            'quote_draft' => $this->quoteDraft($days, $pax, $place, $products),
            'reply_draft' => ['text' => ($client !== '' ? "Hola {$client}, " : 'Hola, ').'gracias por escribirnos. Te preparamos una propuesta de '.$days.' días en '.$place.' para '.$pax.' '.($pax === 1 ? 'persona' : 'personas').'. ¿Te la enviamos con el precio por persona y las fechas disponibles?'],
            default => ['text' => 'Resumen: '.Str::limit(preg_replace('/\s+/u', ' ', trim($prompt)) ?? '', 260)],
        };

        return $this->completion($prompt, $output);
    }

    public function extractProducts(string $sourceType, string $source, array $context): AiCompletion
    {
        $products = $sourceType === 'csv' ? $this->fromCsv($source) : $this->fromDocument($source, $context);

        return $products === []
            ? AiCompletion::failed('No encontramos productos en el archivo. Revisa que tenga columnas de nombre, destino, días y precio.')
            : $this->completion($source, ['products' => $products]);
    }

    public function provider(): string
    {
        return 'fake';
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }

    private function itinerary(int $days, string $place, array $products): array
    {
        $plan = [];

        for ($day = 1; $day <= $days; $day++) {
            $product = $products === [] ? null : $products[($day - 1) % count($products)];
            $plan[] = [
                'day' => $day,
                'title' => $product !== null ? $product['name'] : ($day === 1 ? "Llegada a {$place}" : "Día libre en {$place}"),
                'product_code' => $product['code'] ?? null,
                'detail' => $product !== null ? 'Servicio del catálogo: '.$product['name'].'.' : ($day === 1 ? 'Traslado y tiempo para aclimatarse.' : 'Tiempo libre para recorrer a su ritmo.'),
            ];
        }

        return ['title' => "{$days} días en {$place}", 'days' => $plan, 'notes' => 'Borrador generado a partir del pedido. Revísalo antes de aplicarlo.'];
    }

    private function quoteDraft(int $days, int $pax, string $place, array $products): array
    {
        $items = array_map(fn (array $product): array => ['product_code' => $product['code'], 'name' => $product['name'], 'quantity' => $pax], array_slice($products, 0, 3));

        return ['title' => "Propuesta de {$days} días en {$place}", 'pax' => $pax, 'items' => $items, 'notes' => $items === [] ? 'No hay productos activos para ese destino en el catálogo.' : 'Precios según la tarifa vigente al aplicar.'];
    }

    private function fromCsv(string $csv): array
    {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $csv) ?: []), fn (string $line): bool => $line !== ''));

        if (count($lines) < 2) {
            return [];
        }

        $separator = substr_count($lines[0], ';') > substr_count($lines[0], ',') ? ';' : ',';
        $header = array_map(fn (string $cell): string => Str::lower(Str::ascii(trim($cell))), str_getcsv($lines[0], $separator, '"', '\\'));
        $column = fn (array $names): ?int => collect($header)->search(fn (string $cell): bool => in_array($cell, $names, true)) ?: (in_array($header[0], $names, true) ? 0 : null);
        $map = [
            'name' => $column(['nombre', 'name', 'producto']),
            'destination' => $column(['destino', 'destination', 'ciudad']),
            'duration_days' => $column(['dias', 'duracion', 'duration', 'days']),
            'price' => $column(['precio', 'price', 'tarifa']),
            'currency' => $column(['moneda', 'currency']),
        ];

        if ($map['name'] === null) {
            return [];
        }

        $products = [];

        foreach (array_slice($lines, 1, 200) as $index => $line) {
            $cells = str_getcsv($line, $separator, '"', '\\');
            $name = trim((string) ($cells[$map['name']] ?? ''));

            if ($name === '') {
                continue;
            }

            $price = $map['price'] !== null ? preg_replace('/[^0-9.]/', '', (string) ($cells[$map['price']] ?? '')) : '';
            $products[] = [
                'key' => 'P'.($index + 1),
                'name' => Str::limit($name, 150, ''),
                'destination' => $map['destination'] !== null ? trim((string) ($cells[$map['destination']] ?? '')) : null,
                'duration_days' => $map['duration_days'] !== null ? max(1, (int) ($cells[$map['duration_days']] ?? 1)) : 1,
                'price' => $price !== '' && is_numeric($price) ? $price : null,
                'currency' => $map['currency'] !== null ? Str::upper(trim((string) ($cells[$map['currency']] ?? 'PEN'))) ?: 'PEN' : 'PEN',
                'confidence' => 0.97,
            ];
        }

        return $products;
    }

    private function fromDocument(string $source, array $context): array
    {
        $destinations = array_values($context['destinations'] ?? []) ?: ['Cusco'];
        $seed = crc32($source);
        $products = [];

        for ($index = 0; $index < 3; $index++) {
            $destination = $destinations[($seed + $index) % count($destinations)];
            $days = (($seed >> ($index + 1)) % 5) + 1;
            $products[] = [
                'key' => 'P'.($index + 1),
                'name' => self::SAMPLE_NAMES[($seed + $index * 3) % count(self::SAMPLE_NAMES)].' '.$destination.($days > 1 ? " {$days} días" : ''),
                'destination' => $destination,
                'duration_days' => $days,
                'price' => (string) (90 + (($seed >> $index) % 40) * 25),
                'currency' => 'PEN',
                'confidence' => round(0.7 + ((($seed >> ($index + 2)) % 25) / 100), 2),
            ];
        }

        return $products;
    }

    private function destination(string $prompt, array $context): ?string
    {
        $haystack = Str::lower(Str::ascii($prompt));

        foreach ($context['destinations'] ?? [] as $name) {
            if (str_contains($haystack, Str::lower(Str::ascii((string) $name)))) {
                return (string) $name;
            }
        }

        return null;
    }

    private function number(string $prompt, string $pattern, int $default, int $min, int $max): int
    {
        return preg_match($pattern, $prompt, $match) === 1 ? max($min, min($max, (int) $match[1])) : max($min, min($max, $default));
    }

    private function completion(string $input, array $output): AiCompletion
    {
        $tokensIn = (int) ceil(mb_strlen($input) / 4) + 40;
        $tokensOut = (int) ceil(strlen((string) json_encode($output, JSON_UNESCAPED_UNICODE)) / 4);
        $cost = BigDecimal::of($tokensIn)->multipliedBy('0.000003')->plus(BigDecimal::of($tokensOut)->multipliedBy('0.000015'))->toScale(4, RoundingMode::HALF_UP);

        return new AiCompletion(true, $output, $tokensIn, $tokensOut, (string) $cost, self::MODEL);
    }
}
