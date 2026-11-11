<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class SitePages
{
    private const PROVIDERS = ['tripadvisor' => 'Tripadvisor', 'google' => 'Google', 'facebook' => 'Facebook', 'trustpilot' => 'Trustpilot', 'getyourguide' => 'GetYourGuide', 'viator' => 'Viator'];

    private readonly SitePricing $pricing;

    private readonly SiteAvailability $availability;

    public function __construct(
        private readonly SiteCatalog $catalog,
        private readonly SiteProfile $profile,
    ) {
        $this->pricing = $catalog->pricing();
        $this->availability = $catalog->availability();
    }

    public function home(): array
    {
        $products = $this->catalog->products();
        $featured = $products->where('is_featured', true)->values();
        $featured = $featured->count() >= 3 ? $featured : $featured->concat($products->where('is_featured', false))->take(6);

        return [
            'search' => $this->searchOptions(),
            'destinations' => $this->catalog->destinations()->filter(fn (stdClass $d): bool => $d->products->isNotEmpty())->take(6)->map(fn (stdClass $d): array => $this->destinationCard($d))->values()->all(),
            'featured' => $featured->map(fn (stdClass $p): array => $this->catalog->card($p))->values()->all(),
            'offers' => $this->offers(),
            'departures' => $this->upcomingDepartures(60, 6),
            'reviews' => $this->reviews(null, 6),
            'stats' => [
                'products' => $products->count(),
                'destinations' => $this->catalog->destinations()->filter(fn (stdClass $d): bool => $d->products->isNotEmpty())->count(),
                'departures' => count($this->upcomingDepartures(60, 100)),
            ],
        ];
    }

    public function destinationsIndex(): array
    {
        return [
            'items' => $this->catalog->destinations()->map(fn (stdClass $d): array => $this->destinationCard($d))->values()->all(),
        ];
    }

    public function destination(string $slug): array
    {
        $destination = $this->catalog->destinations()->firstWhere('slug', $slug) ?? throw ApiException::notFound('No encontramos ese destino.');
        $today = $this->catalog->today();
        $months = collect(range(0, 11))->map(function (int $offset) use ($today): array {
            $month = $today->copy()->startOfMonth()->addMonths($offset);
            $season = $this->pricing->seasonFor($month->copy()->day(15)->toDateString());

            return [
                'month' => $month->format('Y-m'),
                'season' => $season ? ['name' => $season->name, 'level' => $this->pricing->level($season), 'factor' => $season->factor] : null,
            ];
        });
        $limit = $today->copy()->addMonths(12)->toDateString();
        $special = $this->pricing->seasons()
            ->filter(fn (stdClass $s): bool => in_array($s->type, ['Fecha especial', 'Feriado'], true) && $s->date_to >= $today->toDateString() && $s->date_from <= $limit)
            ->sortBy('date_from')
            ->map(fn (stdClass $s): array => ['name' => $s->name, 'from' => $s->date_from, 'to' => $s->date_to, 'factor' => $s->factor])
            ->values();

        return [
            'destination' => $this->destinationCard($destination) + [
                'description' => $destination->description,
                'climate' => $destination->climate,
                'lat' => $destination->lat !== null ? (float) $destination->lat : null,
                'lng' => $destination->lng !== null ? (float) $destination->lng : null,
                'faqs' => json_decode((string) $destination->faqs, true) ?: [],
                'content_locale' => $destination->content_locale,
                'region' => Str::of($destination->path)->explode(' / ')->slice(0, -1)->implode(' · '),
            ],
            'months' => $months->all(),
            'special' => $special->all(),
            'products' => $destination->products->map(fn (stdClass $p): array => $this->catalog->card($p))->values()->all(),
            'reviews' => $this->reviews($destination->products->pluck('id')->all(), 3),
        ];
    }

    public function listing(array $filters): array
    {
        $today = $this->catalog->today();
        $fx = $this->profile->usdRate();
        $pax = max(1, min(40, (int) ($filters['viajeros'] ?? 1)));
        $date = $filters['fecha'] ?? null;
        $destination = isset($filters['destino']) ? $this->catalog->destinations()->firstWhere('slug', $filters['destino']) : null;
        $query = isset($filters['q']) ? Str::lower(Str::ascii($filters['q'])) : null;

        $items = $this->catalog->products()
            ->filter(fn (stdClass $p): bool => $destination === null || $this->catalog->belongs($p, $destination->path))
            ->filter(fn (stdClass $p): bool => ! isset($filters['tipo']) || $p->kind === $filters['tipo'])
            ->filter(fn (stdClass $p): bool => ! isset($filters['categoria']) || $p->category_name === $filters['categoria'])
            ->filter(fn (stdClass $p): bool => ! isset($filters['dificultad']) || $p->difficulty === $filters['dificultad'])
            ->filter(fn (stdClass $p): bool => ! isset($filters['idioma']) || in_array($filters['idioma'], $p->languages, true))
            ->filter(fn (stdClass $p): bool => ! isset($filters['modalidad']) || $p->modality === $filters['modalidad'])
            ->filter(fn (stdClass $p): bool => ! isset($filters['duracion']) || $this->durationBucket($p) === $filters['duracion'])
            ->filter(fn (stdClass $p): bool => $query === null || str_contains(Str::lower(Str::ascii($p->name.' '.$p->short_description.' '.$p->destination_name.' '.$p->category_name)), $query))
            ->map(function (stdClass $p) use ($date, $pax, $today, $filters): ?array {
                $card = $this->catalog->card($p);

                if ($date !== null) {
                    $day = $this->availability->day($p, $date, $pax, $today);

                    if (! $this->availability->sellable($day)) {
                        return null;
                    }

                    $card['from'] = ['amount' => $day['price']['adult'], 'currency' => $day['price']['currency']];
                    $card['list'] = $day['price']['list'];
                    $card['on_date'] = ['date' => $date, 'spots' => $day['spots'], 'season' => $day['price']['season']];
                }

                if (isset($filters['viajeros']) && ($pax > (int) $p->maximum_passengers || $pax < (int) $p->minimum_passengers)) {
                    return null;
                }

                return $card['from'] === null ? null : $card;
            })
            ->filter()
            ->filter(fn (array $c): bool => ! isset($filters['precio_min']) || $this->inPen($c['from'], $fx) >= (float) $filters['precio_min'])
            ->filter(fn (array $c): bool => ! isset($filters['precio_max']) || $this->inPen($c['from'], $fx) <= (float) $filters['precio_max'])
            ->values();

        $sorted = match ($filters['orden'] ?? 'recomendados') {
            'precio_asc' => $items->sortBy(fn (array $c): float => $this->inPen($c['from'], $fx)),
            'precio_desc' => $items->sortByDesc(fn (array $c): float => $this->inPen($c['from'], $fx)),
            'duracion' => $items->sortBy('days'),
            'valorados' => $items->sortByDesc(fn (array $c): float => ($c['rating']['avg'] ?? 0) * 1000 + ($c['rating']['count'] ?? 0)),
            default => $items->sortByDesc(fn (array $c): int => ($c['featured'] ? 100 : 0) + count($c['tags'])),
        };

        return [
            'items' => $sorted->values()->all(),
            'total' => $sorted->count(),
            'destination' => $destination ? ['slug' => $destination->slug, 'name' => $destination->name] : null,
            'facets' => $this->facets(),
            'fx' => $fx,
        ];
    }

    public function product(string $slug, int $pax): array
    {
        $product = $this->catalog->product($slug);
        $today = $this->catalog->today();
        $card = $this->catalog->card($product);
        $destination = $this->catalog->destinationFor($product);
        $start = $card['first_date'] ? Carbon::parse($card['first_date']) : $today;
        $policy = DB::table('catalog_product_policies')->where('product_id', $product->id)->first();
        $profilePolicies = $this->profile->show()['policies'];
        $related = DB::table('catalog_product_related')->where('product_id', $product->id)->pluck('related_product_id')->all();
        $relatedProducts = $this->catalog->products()->filter(fn (stdClass $p): bool => in_array($p->id, $related, true));

        if ($relatedProducts->count() < 3 && $destination) {
            $relatedProducts = $relatedProducts->concat($this->catalog->products()->filter(fn (stdClass $p): bool => $p->id !== $product->id && ! in_array($p->id, $related, true) && $this->catalog->belongs($p, $destination->path)));
        }

        $departures = $this->availability->departures($product->id)
            ->filter(fn (stdClass $d): bool => $d->departure_date >= $today->toDateString() && $d->status !== 'cancelada')
            ->map(function (stdClass $d) use ($product, $today): array {
                $day = $this->availability->day($product, $d->departure_date, 1, $today);

                return $this->availability->departure($d, $product) + ['price' => $day['price'] ? ['amount' => $day['price']['adult'], 'currency' => $day['price']['currency']] : null, 'bookable' => $this->availability->sellable($day)];
            })
            ->filter(fn (array $d): bool => $d['bookable'])
            ->take(8)
            ->values();

        return [
            'product' => $card + [
                'description' => $product->long_description ?: $product->short_description,
                'seo' => ['title' => $product->seo_title ?: $product->name, 'description' => $product->seo_description ?: $product->short_description],
                'pickup' => $product->pickup_text,
                'group' => ['min' => (int) $product->minimum_passengers, 'max' => (int) $product->maximum_passengers],
                'ages' => ['min' => (int) $product->minimum_age, 'max' => (int) $product->maximum_age, 'children' => (int) $product->minimum_age < 12, 'infants' => (int) $product->minimum_age === 0],
                'advance_days' => (int) $product->booking_advance_min_days,
                'breadcrumbs' => $this->breadcrumbs($product),
                'promotions' => $product->promotions,
                'media' => DB::table('catalog_product_media')->where('product_id', $product->id)->orderByDesc('is_main')->orderBy('sort_order')->get(['storage_path as url', 'alt_text as alt'])->all(),
            ],
            'itinerary' => $this->translated($product, 'itinerary') ?? $this->itinerary($product->id),
            'inclusions' => $this->translated($product, 'inclusions') ?? DB::table('catalog_product_inclusions')->where('product_id', $product->id)->where('kind', 'include')->orderBy('sort_order')->pluck('text')->all(),
            'exclusions' => $this->translated($product, 'exclusions') ?? DB::table('catalog_product_inclusions')->where('product_id', $product->id)->where('kind', 'exclude')->orderBy('sort_order')->pluck('text')->all(),
            'requirements' => $this->translated($product, 'requirements') ?? DB::table('catalog_product_requirements')->where('product_id', $product->id)->orderBy('created_at')->get(['category', 'text'])->all(),
            'policies' => array_filter([
                'Cancelación' => $policy->cancellation ?? $profilePolicies['cancel'],
                'Cambios de fecha' => $policy->date_change ?? $policy->modification ?? $profilePolicies['modify'],
                'No-show' => $policy->no_show ?? null,
                'Reembolsos' => $policy->refund ?? $profilePolicies['refund'],
                'Anticipación' => $policy?->advance_min ? "Reserva con al menos {$policy->advance_min} de anticipación." : null,
            ]),
            'faqs' => [
                ...$this->translated($product, 'faqs') ?? DB::table('catalog_product_faqs')->where('product_id', $product->id)->orderBy('sort_order')->get(['question as q', 'answer as a'])->map(fn (stdClass $f): array => (array) $f)->all(),
                ...($destination ? json_decode((string) $destination->faqs, true) ?: [] : []),
            ],
            'departures' => $departures->all(),
            'calendar' => [$this->month($product, $start->format('Y-m'), $pax), $this->month($product, $start->copy()->startOfMonth()->addMonth()->format('Y-m'), $pax)],
            'reviews' => $this->reviews([$product->id], 6),
            'related' => $relatedProducts->unique('id')->take(3)->map(fn (stdClass $p): array => $this->catalog->card($p))->values()->all(),
        ];
    }

    public function calendar(string $slug, string $month, int $pax): array
    {
        return $this->month($this->catalog->product($slug), $month, $pax);
    }

    public function availability(string $slug, string $month, int $pax): array
    {
        $product = $this->catalog->product($slug);
        $calendar = $this->month($product, $month, $pax);
        $today = $this->catalog->today();
        $next = null;

        for ($i = 0; $i <= 180 && $next === null; $i++) {
            $date = $today->copy()->addDays($i)->toDateString();
            $day = $this->availability->day($product, $date, $pax, $today);
            $next = $this->availability->sellable($day) ? $date : null;
        }

        return [...$calendar, 'next_available' => $next];
    }

    public function check(string $slug, string $date, int $pax): array
    {
        $product = $this->catalog->product($slug);
        $day = $this->availability->day($product, $date, $pax, $this->catalog->today());
        $sellable = $this->availability->sellable($day);

        return [
            'product' => $product->slug,
            'date' => $date,
            'pax' => $pax,
            'sellable' => $sellable,
            'status' => $day['status'],
            'label' => SiteAvailability::LABELS[$day['status']] ?? $day['status'],
            'spots' => $day['spots'],
            'reason' => $sellable ? null : ($day['note'] ?? (SiteAvailability::LABELS[$day['status']] ?? 'No disponible para esta fecha.')),
            'price' => $day['price'] ? ['adult' => $day['price']['adult'], 'child' => $day['price']['child'], 'currency' => $day['price']['currency']] : null,
        ];
    }

    public function productDepartures(string $slug, ?string $from, ?string $to): array
    {
        $product = $this->catalog->product($slug);
        $today = $this->catalog->today();
        $from = $from && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) ? $from : $today->toDateString();
        $to = $to && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to) ? $to : $today->copy()->addDays(365)->toDateString();
        $items = [];

        foreach ($this->availability->departures($product->id) as $departure) {
            if ($departure->departure_date < $from || $departure->departure_date > $to || $departure->status === 'cancelada') {
                continue;
            }

            $day = $this->availability->day($product, $departure->departure_date, 1, $today);
            $items[] = $this->availability->departure($departure, $product) + [
                'price' => $day['price'] ? ['amount' => $day['price']['adult'], 'currency' => $day['price']['currency']] : null,
                'bookable' => $this->availability->sellable($day),
            ];
        }

        return ['product' => ['slug' => $product->slug, 'name' => $product->name], 'from' => $from, 'to' => $to, 'items' => $items];
    }

    public function guaranteedDepartures(int $limit): array
    {
        return array_slice(array_values(array_filter($this->upcomingDepartures(180, 200), fn (array $departure): bool => (bool) ($departure['guaranteed'] ?? false))), 0, $limit);
    }

    public function publicReviews(?string $slug, ?int $stars, int $limit): array
    {
        $productIds = $slug ? [$this->catalog->product($slug)->id] : null;
        $data = $this->reviews($productIds, 500);
        $own = array_values(array_filter($data['items'], fn (array $item): bool => $item['verified']));
        $filtered = array_values(array_filter($own, fn (array $item): bool => $stars === null || $item['stars'] === $stars));
        $total = count($own);
        $sum = array_sum(array_column($own, 'stars'));
        $distribution = [];

        foreach ([5, 4, 3, 2, 1] as $value) {
            $distribution[$value] = count(array_filter($own, fn (array $item): bool => $item['stars'] === $value));
        }

        return [
            'average' => $total > 0 ? round($sum / $total, 1) : null,
            'count' => $total,
            'distribution' => $distribution,
            'items' => array_slice($filtered, 0, $limit),
        ];
    }

    public function searchOptions(): array
    {
        return [
            'destinations' => $this->catalog->destinations()->filter(fn (stdClass $d): bool => $d->products->isNotEmpty())->map(fn (stdClass $d): array => ['value' => $d->slug, 'label' => $d->name])->values()->all(),
            'kinds' => collect(SiteCatalog::KINDS)->map(fn (array $k, string $key): array => ['value' => $key, 'label' => $k['label']])->values()->all(),
        ];
    }

    public function sedes(): array
    {
        return collect($this->profile->show()['sedes'])->map(fn (array $s): array => ['value' => $s['id'], 'label' => $s['name']])->all();
    }

    private function month(stdClass $product, string $month, int $pax): array
    {
        if (! preg_match('/^\d{4}-\d{2}$/', $month)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El mes no es válido.');
        }

        $today = $this->catalog->today();
        $first = Carbon::parse($month.'-01');
        $days = [];

        for ($date = $first->copy(); $date->month === $first->month; $date->addDay()) {
            $day = $this->availability->day($product, $date->toDateString(), $pax, $today);
            $days[] = [
                'date' => $day['date'],
                'status' => $day['status'],
                'label' => SiteAvailability::LABELS[$day['status']],
                'sellable' => $this->availability->sellable($day),
                'price' => $day['price'] ? $day['price']['adult'] : null,
                'child' => $day['price'] ? $day['price']['child'] : null,
                'list' => $day['price'] ? $day['price']['list'] : null,
                'currency' => $day['price']['currency'] ?? null,
                'season' => $day['price']['season'] ?? null,
                'spots' => $day['spots'],
                'time' => $day['departure']['time'] ?? null,
                'note' => $day['note'],
            ];
        }

        $sellable = collect($days)->where('sellable', true);

        return [
            'month' => $month,
            'pax' => $pax,
            'days' => $days,
            'min' => $sellable->min('price'),
            'currency' => $sellable->first()['currency'] ?? null,
        ];
    }

    private function translated(stdClass $product, string $field): ?array
    {
        $value = $product->translation === null ? null : ($product->translation->{$field} ?? null);
        $decoded = $value === null ? null : json_decode((string) $value, true);

        return is_array($decoded) && $decoded !== [] ? $decoded : null;
    }

    private function itinerary(string $productId): array
    {
        $itinerary = DB::table('catalog_itineraries')->where('product_id', $productId)->orderByDesc('is_default')->value('id');

        if ($itinerary === null) {
            return [];
        }

        $days = DB::table('catalog_itinerary_days')->where('itinerary_id', $itinerary)->orderBy('day_number')->get(['id', 'day_number', 'title']);
        $items = DB::table('catalog_itinerary_items')->whereIn('day_id', $days->pluck('id'))->orderBy('start_time')->get(['day_id', 'start_time', 'activity', 'item_type', 'location']);

        return $days->map(fn (stdClass $day): array => [
            'day' => (int) $day->day_number,
            'title' => $day->title,
            'items' => $items->where('day_id', $day->id)->map(fn (stdClass $i): array => ['time' => $i->start_time ? substr((string) $i->start_time, 0, 5) : null, 'activity' => $i->activity, 'type' => $i->item_type, 'location' => $i->location])->values()->all(),
        ])->all();
    }

    public function offersPage(): array
    {
        $offers = $this->offers();
        $codes = [];
        foreach ($this->catalog->products() as $product) {
            foreach ($product->promotions as $promotion) {
                if ($promotion['code'] !== null) {
                    $codes[] = ['code' => $promotion['code'], 'name' => $promotion['name'], 'value' => $promotion['value'], 'percent' => $promotion['percent'], 'ends_at' => $promotion['ends_at'], 'product' => ['slug' => $product->slug, 'name' => $product->name]];
                }
            }
        }

        return [
            'offers' => $offers,
            'codes' => $codes,
            'departures' => array_values(array_filter($this->upcomingDepartures(90, 12), fn (array $departure): bool => (bool) ($departure['guaranteed'] ?? false))),
        ];
    }

    private function offers(): array
    {
        return $this->catalog->products()
            ->map(fn (stdClass $p): array => ['card' => $this->catalog->card($p), 'promotions' => $p->promotions])
            ->filter(fn (array $o): bool => $o['promotions'] !== [] || $o['card']['list'] !== null)
            ->map(fn (array $o): array => $o['card'] + ['promotion' => $o['promotions'][0] ?? null])
            ->values()
            ->all();
    }

    private function upcomingDepartures(int $days, int $limit): array
    {
        $today = $this->catalog->today();
        $until = $today->copy()->addDays($days)->toDateString();

        return $this->catalog->products()
            ->flatMap(fn (stdClass $p): Collection => $this->availability->departures($p->id)
                ->filter(fn (stdClass $d): bool => $d->status === 'abierta' && $d->departure_date <= $until && $this->availability->free($d) > 0)
                ->map(function (stdClass $d) use ($p, $today): array {
                    $day = $this->availability->day($p, $d->departure_date, 1, $today);

                    return $this->availability->departure($d, $p) + [
                        'product' => ['slug' => $p->slug, 'name' => $p->name, 'destination' => $p->destination_name],
                        'price' => $day['price'] ? ['amount' => $day['price']['adult'], 'currency' => $day['price']['currency']] : null,
                        'bookable' => $this->availability->sellable($day),
                    ];
                }))
            ->filter(fn (array $d): bool => $d['bookable'])
            ->sortBy([['guaranteed', 'desc'], ['date', 'asc']])
            ->take($limit)
            ->sortBy('date')
            ->values()
            ->all();
    }

    private function reviews(?array $productIds, int $limit): array
    {
        $public = $this->catalog->products()->pluck('slug')->all();
        $own = DB::table('crm_own_reviews as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')
            ->whereNull('r.deleted_at')->where('r.status', 'publicada')
            ->when(! OwnReviewSettings::showOnSite(), fn ($q) => $q->whereRaw('false'))
            ->when($productIds !== null, fn ($q) => $q->whereIn('r.product_id', $productIds))
            ->orderByDesc('r.published_at')
            ->get(['r.author_display', 'r.country', 'r.travel_date', 'r.stars', 'r.title', 'r.body', 'r.reply_text', 'r.lang', 'r.is_demo', 'r.published_at', 'p.name as product', 'p.slug']);
        $external = DB::table('channel_external_reviews as e')->join('integration_review_sources as s', 's.id', '=', 'e.source_id')
            ->leftJoin('catalog_products as p', 'p.id', '=', 'e.product_id')
            ->whereIn('s.status', ['conectado'])
            ->when($productIds !== null, fn ($q) => $q->whereIn('e.product_id', $productIds))
            ->orderByDesc('e.review_date')
            ->get(['e.author_display', 'e.review_date', 'e.rating', 'e.title', 'e.body', 'e.reply', 'e.response_status', 'e.lang', 's.provider', 'p.name as product', 'p.slug']);
        $all = $own->map(fn (stdClass $r): array => [
            'author' => $r->author_display, 'country' => $r->country, 'date' => $r->travel_date, 'stars' => (int) $r->stars, 'title' => $r->title,
            'body' => $r->body, 'reply' => $r->reply_text, 'lang' => trim((string) $r->lang), 'source' => 'Viaje verificado', 'verified' => true,
            'product' => $r->product && in_array($r->slug, $public, true) ? ['name' => $r->product, 'slug' => $r->slug] : null,
        ])->concat($external->map(fn (stdClass $r): array => [
            'author' => $r->author_display, 'country' => null, 'date' => $r->review_date, 'stars' => (int) $r->rating, 'title' => $r->title,
            'body' => $r->body, 'reply' => $r->response_status === 'publicada' ? $r->reply : null, 'lang' => trim((string) $r->lang), 'source' => self::PROVIDERS[$r->provider] ?? Str::title($r->provider), 'verified' => false,
            'product' => $r->product && in_array($r->slug, $public, true) ? ['name' => $r->product, 'slug' => $r->slug] : null,
        ]));

        return [
            'average' => $all->isEmpty() ? null : round($all->avg('stars'), 1),
            'count' => $all->count(),
            'verified' => $own->count(),
            'distribution' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn (int $s): array => [$s => $all->where('stars', $s)->count()])->all(),
            'items' => $all->sortByDesc(fn (array $r): string => ($r['verified'] ? '1' : '0').$r['date'])->take($limit)->values()->all(),
        ];
    }

    private function facets(): array
    {
        $products = $this->catalog->products();

        return [
            'destinations' => $this->catalog->destinations()->filter(fn (stdClass $d): bool => $d->products->isNotEmpty())->map(fn (stdClass $d): array => ['value' => $d->slug, 'label' => $d->name, 'count' => $d->products->count()])->values()->all(),
            'kinds' => collect(SiteCatalog::KINDS)->map(fn (array $k, string $key): array => ['value' => $key, 'label' => $this->catalog->locale()->label('kinds', $key, $k['label']), 'count' => $products->where('kind', $key)->count()])->filter(fn (array $k): bool => $k['count'] > 0)->values()->all(),
            'categories' => $products->groupBy('category_name')->map(fn (Collection $g, string $name): array => ['value' => $name, 'label' => $name, 'count' => $g->count()])->sortBy('label')->values()->all(),
            'difficulties' => collect(SiteCatalog::DIFFICULTIES)->map(fn (string $label, string $key): array => ['value' => $key, 'label' => $this->catalog->locale()->label('difficulties', $key, $label), 'count' => $products->where('difficulty', $key)->count()])->filter(fn (array $d): bool => $d['count'] > 0)->values()->all(),
            'languages' => collect(SiteCatalog::LANGUAGES)->map(fn (string $label, string $key): array => ['value' => $key, 'label' => $this->catalog->locale()->label('languages', $key, $label), 'count' => $products->filter(fn (stdClass $p): bool => in_array($key, $p->languages, true))->count()])->filter(fn (array $l): bool => $l['count'] > 0)->values()->all(),
            'modalities' => $products->groupBy('modality')->map(fn (Collection $g, string $name): array => ['value' => $name, 'label' => $name, 'count' => $g->count()])->values()->all(),
            'durations' => collect(SiteCatalog::DURATIONS)->map(fn (string $label, string $key): array => ['value' => $key, 'label' => $this->catalog->locale()->label('durations', $key, $label), 'count' => $products->filter(fn (stdClass $p): bool => $this->durationBucket($p) === $key)->count()])->filter(fn (array $d): bool => $d['count'] > 0)->values()->all(),
            'sorts' => collect(SiteCatalog::SORTS)->map(fn (string $label, string $key): array => ['value' => $key, 'label' => $this->catalog->locale()->label('sorts', $key, $label)])->values()->all(),
        ];
    }

    private function destinationCard(stdClass $destination): array
    {
        $prices = $destination->products->map(fn (stdClass $p): ?array => $this->catalog->card($p)['from'])->filter();
        $pen = $prices->firstWhere('currency', 'PEN');

        return [
            'slug' => $destination->slug,
            'name' => $destination->name,
            'tagline' => $destination->tagline,
            'altitude' => $destination->altitude_text,
            'type' => $destination->type,
            'count' => $destination->products->count(),
            'from' => $pen ? $prices->where('currency', 'PEN')->sortBy('amount')->first() : $prices->sortBy('amount')->first(),
        ];
    }

    private function breadcrumbs(stdClass $product): array
    {
        $parts = explode(' / ', $product->destination_path);
        $crumbs = [];

        for ($i = 1; $i <= count($parts); $i++) {
            $path = implode(' / ', array_slice($parts, 0, $i));
            $match = $this->catalog->destinations()->firstWhere('path', $path);

            if ($match) {
                $crumbs[] = ['name' => $match->name, 'slug' => $match->slug];
            }
        }

        return $crumbs;
    }

    private function durationBucket(stdClass $product): string
    {
        return match (true) {
            $product->days <= 1 => 'corto',
            $product->days <= 4 => 'medio',
            default => 'largo',
        };
    }

    private function inPen(?array $price, float $fx): float
    {
        if ($price === null) {
            return 0.0;
        }

        return $price['currency'] === 'USD' ? $price['amount'] * $fx : $price['amount'];
    }
}
