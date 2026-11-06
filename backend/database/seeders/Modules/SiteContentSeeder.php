<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class SiteContentSeeder
{
    use SeedsTenant;

    private const DIFFICULTY = ['Fácil' => 'facil', 'Moderada' => 'moderada', 'Moderada a exigente' => 'moderada_exigente', 'Exigente' => 'exigente'];

    private const EDITORIAL = [
        'CUS-MAPI-FD' => ['Moderada', ['ES', 'EN', 'DE', 'FR'], 'Recojo en hoteles del Centro Histórico de Cusco a las 04:10'],
        'CUS-PKG-5D4N' => ['Fácil', ['ES', 'EN'], 'Recepción en el aeropuerto de Cusco (día 1)'],
        'CUS-HUM-FD' => ['Moderada a exigente', ['ES', 'EN'], 'Punto de encuentro en Plaza Regocijo, Cusco (04:30)'],
        'CUS-TRF-APT' => ['Fácil', ['ES', 'EN'], 'Aeropuerto Alejandro Velasco Astete o su hotel'],
        'CUS-GAS-EXP' => ['Fácil', ['ES', 'EN'], 'Mercado San Pedro, puerta principal (09:00)'],
        'ICA-PAR-FD' => ['Fácil', ['ES', 'EN'], 'Recojo en hoteles de Miraflores y Barranco, Lima (04:00)'],
        'PER-CIR-10D' => ['Moderada', ['ES', 'EN'], 'Recepción en el aeropuerto de Lima (día 1)'],
    ];

    private const DESTINATIONS = [
        ['D03', 'cusco', 'Capital histórica del Imperio inca', '3 399 m s. n. m.',
            'Cusco combina calles incas y coloniales, barrios bohemios como San Blas y la puerta de entrada al Valle Sagrado y Machu Picchu. Es la base ideal para aclimatarse y organizar excursiones de uno o varios días.',
            'Estación seca de mayo a octubre (días soleados, noches frías); lluvias de diciembre a marzo. Temperaturas entre 2 °C y 20 °C.',
            [['¿Cuántos días necesito en Cusco?', 'Recomendamos al menos 4 días: uno de aclimatación y city tour, uno para el Valle Sagrado y uno para Machu Picchu.'], ['¿Cómo evito el mal de altura?', 'Descanse el primer día, hidrátese, coma ligero y evite el alcohol las primeras 24 horas. Programe las caminatas de altura después del segundo día.'], ['¿Necesito comprar el Boleto Turístico?', 'Los paquetes que lo requieren ya lo incluyen. Para visitas libres puede adquirirlo en la ciudad.']]],
        ['D06', 'machu-picchu', 'Maravilla del mundo moderno', '2 430 m s. n. m.',
            'La ciudadela inca se visita por circuitos con horario de ingreso y entrada nominativa. Se llega en tren desde Ollantaytambo o Poroy hasta Aguas Calientes y luego en bus a la ciudadela.',
            'Clima subtropical de montaña. Abril a octubre con menos lluvia; enero a marzo con lluvias intensas y posible neblina por la mañana.',
            [['¿Las entradas son nominativas?', 'Sí. Se emiten con nombre y documento de cada pasajero; lleve el mismo documento el día de la visita.'], ['¿Puedo subir a Huayna Picchu?', 'Requiere una entrada especial con cupos limitados. Consúltenos con anticipación.'], ['¿Qué pasa si llueve?', 'La visita se realiza igual. Lleve poncho o casaca impermeable.']]],
        ['D05', 'valle-sagrado', 'Pueblos andinos y andenes incas', '2 870 m s. n. m.',
            'Pisac, Chinchero, Moray, Maras y Ollantaytambo conforman un valle fértil a menor altura que Cusco, ideal para aclimatarse y conocer comunidades tejedoras.',
            'Más templado que Cusco. Temporada seca de mayo a octubre.',
            [['¿Conviene dormir en el valle?', 'Sí, especialmente si su tren a Machu Picchu sale de Ollantaytambo temprano.']]],
        ['D11', 'arequipa', 'La Ciudad Blanca y el vuelo del cóndor', '2 335 m s. n. m.',
            'Arequipa, con su centro histórico de sillar, es punto de partida al Cañón del Colca, uno de los más profundos del mundo, donde se observa el vuelo del cóndor andino.',
            'Soleado casi todo el año. Lluvias moderadas de enero a marzo.',
            [['¿Cuántos días para el Colca?', 'El programa más común es de 2 días y 1 noche desde Arequipa.']]],
        ['D16', 'paracas', 'Fauna marina y desierto', 'Nivel del mar',
            'A 3.5 horas de Lima, Paracas ofrece paseos a las Islas Ballestas para ver lobos marinos y pingüinos de Humboldt, y la Reserva Nacional con paisajes desérticos frente al mar.',
            'Cálido y seco todo el año; viento fuerte por las tardes. Los paseos en lancha salen por la mañana.',
            [['¿Se puede hacer en un día desde Lima?', 'Sí, el full day sale de madrugada y retorna por la noche.'], ['¿El paseo en lancha se cancela?', 'Solo por disposición de Capitanía por oleaje; en ese caso se reprograma o se reembolsa.']]],
        ['D09', 'lago-titicaca', 'El lago navegable más alto del mundo', '3 812 m s. n. m.',
            'Islas flotantes de los Uros, Taquile y Amantaní, con turismo vivencial en comunidades quechuas y aimaras.',
            'Frío y seco de mayo a setiembre; lluvias de diciembre a marzo.',
            [['¿Se puede combinar con Cusco?', 'Sí, en bus turístico de día completo o en tren panorámico.']]],
        ['D18', 'amazonia', 'Selva tropical y biodiversidad', '100–200 m s. n. m.',
            'Iquitos y Tambopata ofrecen lodges en la selva, caminatas nocturnas, observación de aves y navegación por ríos amazónicos.',
            'Cálido y húmedo todo el año; mayor nivel de ríos de diciembre a mayo.',
            [['¿Necesito vacunas?', 'Se recomienda la vacuna contra la fiebre amarilla al menos 10 días antes del viaje.']]],
    ];

    private array $products = [];

    private array $destinations = [];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $tenantId = $this->tenant->getKey();
        $this->products = DB::table('catalog_products')->where('tenant_id', $tenantId)->pluck('id', 'code')->all();
        $this->destinations = DB::table('catalog_destinations')->where('tenant_id', $tenantId)->pluck('id', 'ref')->all();
        $kit = collect(KitSeeds::read('products'));
        $byKitId = $kit->mapWithKeys(fn (array $seed): array => [$seed['id'] => $this->products[$seed['code']] ?? null])->all();

        foreach ($kit as $seed) {
            $productId = $this->products[$seed['code']] ?? null;

            if ($productId === null) {
                continue;
            }

            $this->secondary($productId, $seed['secondary'] ?? []);
            $this->faqs($productId, $seed['faqs'] ?? []);
            $this->related($productId, $seed['related'] ?? [], $byKitId);
            $this->promotions($productId, $seed['promotions'] ?? []);
            $this->editorial($productId, $seed);
        }

        $this->destinationContents();
    }

    private function secondary(string $productId, array $refs): void
    {
        foreach ($refs as $ref) {
            if (isset($this->destinations[$ref])) {
                $this->upsert('catalog_product_destinations', ['product_id' => $productId, 'destination_id' => $this->destinations[$ref]], ['role' => 'secondary']);
            }
        }
    }

    private function faqs(string $productId, array $faqs): void
    {
        foreach (array_values($faqs) as $index => $faq) {
            $this->upsert('catalog_product_faqs', ['product_id' => $productId, 'question' => $faq['q']], ['answer' => $faq['a'], 'sort_order' => $index + 1]);
        }
    }

    private function related(string $productId, array $related, array $byKitId): void
    {
        foreach ($related as $item) {
            $relatedId = $byKitId[$item['productId']] ?? null;

            if ($relatedId !== null && $relatedId !== $productId) {
                $this->upsert('catalog_product_related', ['product_id' => $productId, 'related_product_id' => $relatedId], ['relation' => $item['relation']]);
            }
        }
    }

    private function promotions(string $productId, array $promotions): void
    {
        foreach ($promotions as $promo) {
            $this->upsert('catalog_product_promotions', ['product_id' => $productId, 'ref' => $promo['id']], [
                'name' => $promo['name'],
                'kind' => $promo['kind'],
                'value' => $promo['value'],
                'channel' => $promo['channel'],
                'promo_code' => ($promo['code'] ?? '') !== '' ? strtoupper($promo['code']) : null,
                'min_pax' => $promo['kind'] === 'Descuento por cantidad' ? 4 : null,
                'date_from' => $this->day($promo['from']),
                'date_to' => $this->day($promo['to']),
                'status' => $promo['status'] === 'activa' ? 'activa' : 'inactiva',
                'campaign_id' => isset($promo['campaignId']) ? $this->idByCode('mkt_campaigns', $promo['campaignId']) : null,
            ]);
        }
    }

    private function editorial(string $productId, array $seed): void
    {
        $editorial = self::EDITORIAL[$seed['code']] ?? null;
        $pickup = $editorial[2] ?? ($seed['pickup']['points'][0] ?? null);
        $values = array_filter([
            'difficulty' => $editorial ? self::DIFFICULTY[$editorial[0]] : null,
            'guide_languages' => $editorial ? '{'.implode(',', $editorial[1]).'}' : null,
            'pickup_text' => $pickup ? mb_substr($pickup, 0, 200) : null,
        ], fn ($value) => $value !== null);

        if ($values !== []) {
            DB::table('catalog_products')->where('id', $productId)->update($values);
        }
    }

    private function destinationContents(): void
    {
        foreach (self::DESTINATIONS as [$ref, $slug, $tagline, $altitude, $description, $climate, $faqs]) {
            $destinationId = $this->destinations[$ref] ?? null;

            if ($destinationId === null) {
                continue;
            }

            $this->upsert('catalog_destination_contents', ['destination_id' => $destinationId, 'locale' => 'es'], [
                'slug' => $slug,
                'tagline' => $tagline,
                'description' => $description,
                'climate' => $climate,
                'altitude_text' => $altitude,
                'faqs' => json_encode(array_map(fn (array $faq): array => ['q' => $faq[0], 'a' => $faq[1]], $faqs), JSON_UNESCAPED_UNICODE),
            ]);
        }
    }
}
