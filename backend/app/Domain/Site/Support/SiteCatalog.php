<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SiteCatalog
{
    public const KINDS = [
        'tours' => ['label' => 'Tours y excursiones', 'types' => ['TOUR', 'EXCURSIÓN', 'ACTIVIDAD', 'ENTRADA/TICKET']],
        'paquetes' => ['label' => 'Paquetes y circuitos', 'types' => ['PAQUETE', 'CIRCUITO', 'PROGRAMA TURÍSTICO', 'SERVICIO COMBINADO']],
        'experiencias' => ['label' => 'Experiencias', 'types' => ['EXPERIENCIA']],
        'traslados' => ['label' => 'Traslados', 'types' => ['TRASLADO', 'TRANSPORTE']],
    ];

    public const DIFFICULTIES = ['facil' => 'Fácil', 'moderada' => 'Moderada', 'moderada_exigente' => 'Moderada a exigente', 'exigente' => 'Exigente'];

    public const LANGUAGES = ['ES' => 'Español', 'EN' => 'Inglés', 'DE' => 'Alemán', 'FR' => 'Francés', 'PT' => 'Portugués', 'IT' => 'Italiano'];

    public const DURATIONS = ['corto' => 'Hasta 1 día', 'medio' => '2 a 4 días', 'largo' => '5 días o más'];

    public const SORTS = ['recomendados' => 'Recomendados', 'precio_asc' => 'Precio: menor a mayor', 'precio_desc' => 'Precio: mayor a menor', 'duracion' => 'Duración', 'valorados' => 'Mejor valorados'];

    private const HORIZON = 150;

    private ?Collection $products = null;

    private ?Collection $destinations = null;

    private array $memberships = [];

    private array $cards = [];

    private readonly SitePricing $pricing;

    public function __construct(
        private readonly SiteProfile $profile,
        private readonly SiteAvailability $availability,
        private readonly SiteLocale $locale,
    ) {
        $this->pricing = $availability->pricing();
    }

    public function pricing(): SitePricing
    {
        return $this->pricing;
    }

    public function locale(): SiteLocale
    {
        return $this->locale;
    }

    public function availability(): SiteAvailability
    {
        return $this->availability;
    }

    public function today(): Carbon
    {
        return $this->profile->today();
    }

    public function products(): Collection
    {
        if ($this->products !== null) {
            return $this->products;
        }

        $today = $this->today()->toDateString();
        $rows = DB::table('catalog_products as p')
            ->join('catalog_product_types as t', 't.id', '=', 'p.product_type_id')
            ->join('catalog_product_categories as c', 'c.id', '=', 'p.category_id')
            ->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->whereNull('p.deleted_at')->where('p.status', 'ACTIVE')->whereNotNull('p.slug')
            ->whereExists(fn ($q) => $q->from('catalog_product_channels as ch')->whereColumn('ch.product_id', 'p.id')->where('ch.channel', 'ecommerce')->where('ch.is_published', true))
            ->whereExists(fn ($q) => $q->from('catalog_rates as r')->whereColumn('r.product_id', 'p.id')->where('r.status', 'vigente')->where('r.valid_to', '>=', $today)->whereIn('r.channel', ['E-commerce', 'Directo', 'Todos']))
            ->orderByDesc('p.is_featured')->orderBy('p.name')
            ->get([
                'p.id', 'p.code', 'p.slug', 'p.name', 'p.short_description', 'p.long_description', 'p.duration_value', 'p.duration_unit', 'p.modality',
                'p.minimum_passengers', 'p.maximum_passengers', 'p.minimum_age', 'p.maximum_age', 'p.booking_advance_min_days', 'p.booking_advance_max_days',
                'p.operating_weekdays', 'p.is_featured', 'p.difficulty', 'p.guide_languages', 'p.pickup_text', 'p.availability_model', 'p.seo_title', 'p.seo_description',
                't.name as type_name', 'c.name as category_name', 'd.id as destination_id', 'd.name as destination_name', 'd.path as destination_path',
            ]);

        $ids = $rows->pluck('id')->all();
        $this->pricing->load($ids);
        $this->availability->load($ids, $today, $this->today()->addDays(400)->toDateString());
        $secondary = DB::table('catalog_product_destinations as pd')->join('catalog_destinations as d', 'd.id', '=', 'pd.destination_id')
            ->whereIn('pd.product_id', $ids)->get(['pd.product_id', 'd.path']);
        $own = DB::table('crm_own_reviews')->whereNull('deleted_at')->where('status', 'publicada')->whereIn('product_id', $ids)
            ->groupBy('product_id')->selectRaw('product_id, avg(stars) as avg, count(*) as total')->get()->keyBy('product_id');
        $external = DB::table('channel_external_reviews')->whereIn('product_id', $ids)
            ->groupBy('product_id')->selectRaw('product_id, avg(rating) as avg, count(*) as total')->get()->keyBy('product_id');
        $promos = $this->promotions($ids);
        $locale = $this->locale->current();
        $translations = $this->locale->translated()
            ? DB::table('catalog_product_translations')->whereIn('product_id', $ids)->where('locale', $locale)->get()->keyBy('product_id')
            : collect();

        return $this->products = $rows->map(function (stdClass $row) use ($secondary, $own, $external, $promos, $translations, $locale): stdClass {
            $row->translation = $translations->get($row->id);
            $row->content_locale = $row->translation ? $locale : SiteLocale::BASE;
            if ($row->translation) {
                $row->name = $row->translation->name;
                $row->short_description = $row->translation->short ?: $row->short_description;
                $row->long_description = $row->translation->long ?: $row->long_description;
                $row->seo_title = $row->translation->seo_title ?: $row->seo_title;
                $row->seo_description = $row->translation->seo_description ?: $row->seo_description;
            }
            $row->paths = [$row->destination_path, ...$secondary->where('product_id', $row->id)->pluck('path')->all()];
            $row->kind = $this->kindOf($row->type_name);
            $row->languages = array_values(array_filter(explode(',', trim((string) $row->guide_languages, '{}'))));
            $row->rating = isset($own[$row->id])
                ? ['avg' => round((float) $own[$row->id]->avg, 1), 'count' => (int) $own[$row->id]->total, 'verified' => true]
                : (isset($external[$row->id]) ? ['avg' => round((float) $external[$row->id]->avg, 1), 'count' => (int) $external[$row->id]->total, 'verified' => false] : null);
            $row->promotions = $promos->get($row->id, collect())->values()->all();
            $row->days = $this->durationDays($row);

            return $row;
        });
    }

    public function product(string $slug): stdClass
    {
        return $this->products()->firstWhere('slug', $slug) ?? throw ApiException::notFound('Este producto no está disponible para la venta en línea.');
    }

    public function destinations(): Collection
    {
        return $this->destinations ??= DB::table('catalog_destination_contents as dc')
            ->join('catalog_destinations as d', 'd.id', '=', 'dc.destination_id')
            ->whereNull('d.deleted_at')->where('dc.locale', 'es')
            ->get(['d.id', 'd.ref', 'd.name', 'd.type', 'd.path', 'd.lat', 'd.lng', 'dc.slug', 'dc.tagline', 'dc.description', 'dc.climate', 'dc.altitude_text', 'dc.faqs'])
            ->map(function (stdClass $row): stdClass {
                $translation = $this->locale->translated() ? DB::table('catalog_destination_contents')->where('destination_id', $row->id)->where('locale', $this->locale->current())->first(['tagline', 'description', 'climate', 'altitude_text', 'faqs']) : null;
                $row->content_locale = $translation ? $this->locale->current() : SiteLocale::BASE;
                if ($translation) {
                    foreach (['tagline', 'description', 'climate', 'altitude_text', 'faqs'] as $field) {
                        $row->{$field} = $translation->{$field} ?? $row->{$field};
                    }
                }
                $row->products = $this->products()->filter(fn (stdClass $product): bool => $this->belongs($product, $row->path))->values();

                return $row;
            })
            ->sortBy([fn (stdClass $a, stdClass $b): int => $b->products->count() <=> $a->products->count(), fn (stdClass $a, stdClass $b): int => strcmp($a->name, $b->name)])
            ->values();
    }

    public function card(stdClass $product): array
    {
        if (isset($this->cards[$product->id])) {
            return $this->cards[$product->id];
        }

        $today = $this->today();
        $from = null;
        $list = null;
        $firstSellable = null;

        for ($i = 0; $i <= self::HORIZON; $i++) {
            $date = $today->copy()->addDays($i)->toDateString();
            $day = $this->availability->day($product, $date, 1, $today);

            if (! $this->availability->sellable($day)) {
                continue;
            }

            $firstSellable ??= $date;

            if ($from === null || $day['price']['adult'] < $from['amount']) {
                $from = ['amount' => $day['price']['adult'], 'currency' => $day['price']['currency']];
                $list = $day['price']['list'];
            }
        }

        $next = $this->availability->departures($product->id)->first(fn (stdClass $d): bool => $this->availability->sellable($this->availability->day($product, $d->departure_date, 1, $today)));
        $nextDeparture = $next ? $this->availability->departure($next, $product) : null;
        $destination = $this->destinationFor($product);

        return $this->cards[$product->id] = [
            'slug' => $product->slug,
            'name' => $product->name,
            'summary' => $product->short_description,
            'content_locale' => $product->content_locale,
            'type' => $product->type_name,
            'kind' => $product->kind,
            'category' => $product->category_name,
            'destination' => ['name' => $product->destination_name, 'slug' => $destination?->slug],
            'duration' => $this->durationLabel($product),
            'days' => $product->days,
            'modality' => $product->modality,
            'difficulty' => $product->difficulty && isset(self::DIFFICULTIES[$product->difficulty]) ? $this->locale->label('difficulties', $product->difficulty, self::DIFFICULTIES[$product->difficulty]) : null,
            'languages' => $product->languages,
            'rating' => $product->rating,
            'from' => $from,
            'list' => $list,
            'first_date' => $firstSellable,
            'next_departure' => $nextDeparture,
            'daily' => ! $this->availability->usesDepartures($product->id),
            'featured' => (bool) $product->is_featured,
            'tags' => $this->tags($product, $list, $nextDeparture),
        ];
    }

    public function destinationFor(stdClass $product): ?stdClass
    {
        return $this->destinations()
            ->filter(fn (stdClass $d): bool => $product->destination_path === $d->path || str_starts_with($product->destination_path, $d->path.' / '))
            ->sortByDesc(fn (stdClass $d): int => strlen($d->path))
            ->first();
    }

    public function belongs(stdClass $product, string $path): bool
    {
        $key = $product->id.'|'.$path;

        return $this->memberships[$key] ??= collect($product->paths)->contains(fn (string $p): bool => $p === $path || str_starts_with($p, $path.' / '));
    }

    public function durationLabel(stdClass $product): string
    {
        $value = (float) $product->duration_value;
        $number = fmod($value, 1.0) === 0.0 ? (string) (int) $value : (string) $value;

        return $this->locale->duration((string) $product->duration_unit, $value, $number);
    }

    public function kindOf(string $type): string
    {
        foreach (self::KINDS as $key => $kind) {
            if (in_array($type, $kind['types'], true)) {
                return $key;
            }
        }

        return 'tours';
    }

    public function promotions(array $productIds): Collection
    {
        $today = $this->today()->toDateString();

        return DB::table('catalog_product_promotions')->whereNull('deleted_at')->where('status', 'activa')
            ->whereIn('product_id', $productIds)->whereIn('channel', ['Todos', 'E-commerce'])
            ->where('date_from', '<=', $today)->where('date_to', '>=', $today)
            ->orderByDesc('value')
            ->get(['product_id', 'name', 'kind', 'value', 'promo_code', 'min_pax', 'date_to'])
            ->map(fn (stdClass $p): array => [
                'product_id' => $p->product_id,
                'name' => $p->name,
                'kind' => $p->kind,
                'value' => (float) $p->value,
                'percent' => in_array($p->kind, ['Descuento %', 'Descuento por cantidad', 'Código promocional', 'Promoción por temporada', 'Promoción por canal', 'Promoción por fecha'], true),
                'code' => $p->promo_code,
                'min_pax' => $p->min_pax ? (int) $p->min_pax : null,
                'ends_at' => $p->date_to,
            ])
            ->groupBy('product_id')
            ->map(fn (Collection $items): Collection => $items->map(fn (array $p): array => array_diff_key($p, ['product_id' => true])));
    }

    private function tags(stdClass $product, ?float $list, ?array $next): array
    {
        $tags = [];

        if ($product->promotions !== [] || $list !== null) {
            $tags[] = ['key' => 'offer', 'label' => $this->locale->label('tags', 'offer', 'Oferta')];
        }

        if ($next && $next['guaranteed']) {
            $tags[] = ['key' => 'guaranteed', 'label' => $this->locale->label('tags', 'guaranteed', 'Salida garantizada')];
        }

        if ($next && $next['spots'] > 0 && $next['spots'] <= 4) {
            $tags[] = ['key' => 'last', 'label' => $this->locale->label('tags', 'last', 'Últimos cupos')];
        }

        if ($product->is_featured) {
            $tags[] = ['key' => 'featured', 'label' => $this->locale->label('tags', 'featured', 'Recomendado')];
        }

        return $tags;
    }

    private function durationDays(stdClass $product): float
    {
        $value = (float) $product->duration_value;

        return match ($product->duration_unit) {
            'horas' => min(1.0, $value / 24),
            'noches' => $value + 1,
            default => $value,
        };
    }
}
