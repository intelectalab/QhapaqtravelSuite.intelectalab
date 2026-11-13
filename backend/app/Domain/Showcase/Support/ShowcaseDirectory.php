<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ShowcaseDirectory
{
    public const LISTING_STATUSES = ['borrador', 'en_revision', 'publicado', 'rechazado', 'despublicado'];

    public const BOOKING_STATUSES = ['confirmada', 'asistio', 'no_show', 'cancelada'];

    public const AGENCY_STATUSES = ['en_revision', 'activa', 'suspendida', 'rechazada'];

    private const LISTING_COLUMNS = ['l.id', 'l.code', 'l.agency_id', 'l.slug', 'l.title', 'l.city', 'l.zone', 'l.theme', 'l.duration_hours', 'l.meeting_point', 'l.model', 'l.price', 'l.currency', 'l.capacity', 'l.tenant_product_ref', 'l.status', 'l.reject_reason', 'l.featured_until', 'l.rating', 'l.reviews', 'l.published_at', 'l.created_at', 'l.updated_at', 'a.code as agency_code', 'a.name as agency_name', 'a.slug as agency_slug', 'a.city as agency_city', 'a.status as agency_status', 'a.rating as agency_rating', 'a.reviews as agency_reviews', 'a.tenant_id as agency_tenant_id'];

    public function publicListings(array $filters): array
    {
        $query = $this->listings()->where('l.status', 'publicado')->where('a.status', 'activa')
            ->when($filters['city'] ?? null, fn (Builder $q, string $city) => $q->where('l.city', $city))
            ->when($filters['zone'] ?? null, fn (Builder $q, string $zone) => $q->where('l.zone', $zone))
            ->when($filters['theme'] ?? null, fn (Builder $q, string $theme) => $q->where('l.theme', $theme))
            ->when($filters['lang'] ?? null, fn (Builder $q, string $lang) => $q->whereRaw('? = any(l.languages)', [$lang]))
            ->when(in_array($filters['model'] ?? null, ['propina', 'pago'], true), fn (Builder $q) => $q->where('l.model', $filters['model']));
        $rows = $this->ranked($query)->get();

        return [
            'items' => $rows->map(fn (object $row) => $this->listing($row))->values()->all(),
            'cities' => $this->db()->table('platform_showcase_listings')->where('status', 'publicado')->distinct()->orderBy('city')->pluck('city')->all(),
            'themes' => $this->db()->table('platform_showcase_listings')->where('status', 'publicado')->whereNotNull('theme')->distinct()->orderBy('theme')->pluck('theme')->all(),
            'brand' => ['name' => ShowcaseRules::BRAND, 'domain' => ShowcaseRules::DOMAIN],
        ];
    }

    public function publicOverview(): array
    {
        $db = $this->db();
        $live = fn () => $db->table('platform_showcase_listings as l')->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')->where('l.status', 'publicado')->where('a.status', 'activa');
        $cities = $live()->groupBy('l.city')->selectRaw('l.city, count(*) as tours, count(distinct l.zone) as zones, round(avg(l.rating) filter (where l.reviews > 0), 1) as rating')->orderByDesc('tours')->get();
        $month = $this->funnel()['months'][0] ?? null;

        return [
            'brand' => ['name' => ShowcaseRules::BRAND, 'domain' => ShowcaseRules::DOMAIN],
            'cities' => $cities->map(fn (object $c) => ['id' => $c->city, 'tours' => (int) $c->tours, 'zones' => (int) $c->zones, 'rating' => $c->rating === null ? null : (float) $c->rating])->values()->all(),
            'themes' => $live()->whereNotNull('l.theme')->distinct()->orderBy('l.theme')->pluck('l.theme')->all(),
            'stats' => [
                'month_visits' => $month['visita'] ?? 0,
                'month_bookings' => $month['reserva'] ?? 0,
                'agencies' => $db->table('platform_showcase_agencies')->where('status', 'activa')->count(),
                'cities' => $cities->count(),
                'tours' => (int) $cities->sum('tours'),
            ],
            'rules' => $this->commercialTerms(),
            'benefits' => ShowcaseRules::BENEFITS,
            'plans' => $db->table('plans')->where('status', 'active')->orderBy('rank')->get(['code', 'name', 'price_month', 'currency'])
                ->map(fn (object $p) => ['code' => $p->code, 'name' => $p->name, 'price_month' => Decimal::toApi(Decimal::money($p->price_month)), 'currency' => $p->currency, 'commission_pct' => ShowcaseRules::commissionFor((string) $p->code)])->values()->all(),
            'pass' => ['days' => 30, 'price' => '149.00', 'currency' => 'PEN'],
            'addons' => $db->table('addons')->orderBy('label')->get(['code', 'label', 'billing_mode', 'price_once', 'price_month'])
                ->map(fn (object $a) => ['code' => $a->code, 'label' => $a->label, 'billing_mode' => $a->billing_mode, 'price_once' => $a->price_once === null ? null : Decimal::toApi(Decimal::money($a->price_once)), 'price_month' => $a->billing_mode === 'unico' || $a->price_month === null ? null : Decimal::toApi(Decimal::money($a->price_month))])->values()->all(),
        ];
    }

    public function publicListing(string $slug): array
    {
        $row = $this->listings()->where('l.slug', $slug)->where('l.status', 'publicado')->where('a.status', 'activa')->first() ?? throw ApiException::notFound('La publicación no existe o ya no está disponible.');
        $attendance = $this->attendance([(string) $row->id])[(string) $row->id] ?? null;

        return [
            ...$this->listing($row),
            'attendance_rate' => $attendance,
            'agency_site' => $this->agencySite($row->agency_tenant_id),
            'booking_rules' => ['max_pax' => 30, 'free' => $row->model === 'propina'],
        ];
    }

    public function listingRow(string $slug): object
    {
        return $this->listings()->where('l.slug', $slug)->first() ?? throw ApiException::notFound('La publicación no existe.');
    }

    public function agencyFor(string $tenantId): ?object
    {
        return $this->db()->table('platform_showcase_agencies')->where('tenant_id', $tenantId)->first();
    }

    public function agencyListings(string $tenantId): array
    {
        $agency = $this->agencyFor($tenantId);
        $rows = $agency === null ? collect() : $this->listings()->where('l.agency_id', $agency->id)->orderByDesc('l.created_at')->get();
        $bookings = $agency === null ? collect() : $this->bookingsOf($agency->id)->get();
        $plan = ShowcaseRules::planOf($tenantId);
        $month = Carbon::now('America/Lima')->format('Y-m');
        $monthFee = $bookings->filter(fn (object $b) => substr((string) $b->service_date, 0, 7) === $month && $b->status !== 'cancelada')
            ->reduce(fn ($sum, object $b) => $sum->plus(Decimal::money($b->fee_amount)), Decimal::money(0));
        $closed = $bookings->whereIn('status', ['asistio', 'no_show']);

        return [
            'agency' => $agency === null ? null : $this->agency($agency),
            'plan' => ['code' => $plan, 'label' => ShowcaseRules::PLAN_LABELS[$plan], 'commission_pct' => ShowcaseRules::commissionFor($plan), 'has_plan' => $plan !== 'none'],
            'rules' => $this->commercialTerms(),
            'benefits' => ShowcaseRules::BENEFITS,
            'kpis' => [
                'published' => $rows->where('status', 'publicado')->count(),
                'in_review' => $rows->where('status', 'en_revision')->count(),
                'bookings' => $bookings->where('status', '<>', 'cancelada')->count(),
                'pax' => (int) $bookings->where('status', '<>', 'cancelada')->sum('pax'),
                'attendance_pct' => $closed->count() > 0 ? (int) round(100 * $closed->where('status', 'asistio')->count() / $closed->count()) : null,
                'month_fee' => Decimal::toApi($monthFee),
            ],
            'items' => $rows->map(fn (object $row) => [...$this->listing($row), 'can_pause' => $row->status === 'publicado', 'can_resume' => $row->status === 'despublicado' && $row->published_at !== null])->values()->all(),
            'options' => ['themes' => ['Historia', 'Gastronomía', 'Arte urbano', 'Naturaleza', 'Cultura viva', 'Aventura'], 'languages' => ['es', 'en', 'pt', 'fr', 'de']],
        ];
    }

    public function agencyBookings(string $tenantId, array $filters = []): array
    {
        $agency = $this->agencyFor($tenantId);
        $rows = $agency === null ? collect() : $this->bookingsOf($agency->id)
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('b.status', $status))
            ->orderByDesc('b.service_date')->orderByDesc('b.created_at')->get();
        $today = Carbon::today('America/Lima')->toDateString();

        return [
            'items' => $rows->map(fn (object $row) => [...$this->booking($row), 'can_mark' => $row->status === 'confirmada' && (string) $row->service_date <= $today])->values()->all(),
            'kpis' => collect(self::BOOKING_STATUSES)->mapWithKeys(fn (string $status) => [$status => $rows->where('status', $status)->count()])->all(),
        ];
    }

    public function agencyFees(string $tenantId): array
    {
        $agency = $this->agencyFor($tenantId);
        $plan = ShowcaseRules::planOf($tenantId);

        if ($agency === null) {
            return ['months' => [], 'plan' => $plan, 'rules' => $this->commercialTerms()];
        }

        $rows = $this->db()->table('platform_showcase_bookings as b')->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')
            ->where('l.agency_id', $agency->id)
            ->selectRaw("to_char(b.service_date, 'YYYY-MM') as month")
            ->selectRaw("count(*) filter (where b.status <> 'cancelada') as bookings")
            ->selectRaw("coalesce(sum(b.pax) filter (where b.status = 'asistio'), 0) as attendees")
            ->selectRaw("count(*) filter (where b.fee_basis = 'cupo_gratis' and b.status <> 'cancelada') as free_used")
            ->selectRaw("coalesce(sum(b.fee_amount) filter (where b.fee_basis = 'por_asistente' and b.status <> 'cancelada'), 0) as attendee_fees")
            ->selectRaw("coalesce(sum(b.fee_amount) filter (where b.fee_basis = 'comision' and b.status <> 'cancelada'), 0) as commissions")
            ->selectRaw("coalesce(sum(b.amount) filter (where b.fee_basis = 'comision' and b.status <> 'cancelada'), 0) as paid_sales")
            ->groupByRaw("to_char(b.service_date, 'YYYY-MM')")->orderByDesc('month')->get();

        return [
            'plan' => $plan,
            'rules' => $this->commercialTerms(),
            'months' => $rows->map(fn (object $row) => [
                'month' => $row->month,
                'bookings' => (int) $row->bookings,
                'attendees' => (int) $row->attendees,
                'free_used' => min((int) $row->free_used, ShowcaseRules::FREE_MONTHLY_BOOKINGS),
                'free_quota' => ShowcaseRules::FREE_MONTHLY_BOOKINGS,
                'attendee_fees' => Decimal::toApi(Decimal::money($row->attendee_fees)),
                'commissions' => Decimal::toApi(Decimal::money($row->commissions)),
                'paid_sales' => Decimal::toApi(Decimal::money($row->paid_sales)),
                'total' => Decimal::toApi(Decimal::money($row->attendee_fees)->plus(Decimal::money($row->commissions))),
                'currency' => ShowcaseRules::FEE_CURRENCY,
            ])->values()->all(),
        ];
    }

    public function moderation(): array
    {
        $listings = $this->listings()->whereIn('l.status', ['en_revision', 'rechazado'])->orderBy('l.created_at')->get();
        $agencies = $this->db()->table('platform_showcase_agencies')->orderByRaw("case status when 'en_revision' then 0 when 'activa' then 1 when 'suspendida' then 2 else 3 end")->orderBy('name')->get();
        $stats = $this->db()->table('platform_showcase_listings as l')->leftJoin('platform_showcase_bookings as b', 'b.listing_id', '=', 'l.id')
            ->groupBy('l.agency_id')
            ->selectRaw('l.agency_id, count(distinct l.id) as listings, count(b.id) filter (where b.status <> \'cancelada\') as bookings, coalesce(sum(b.fee_amount) filter (where b.status <> \'cancelada\'), 0) as fees')
            ->get()->keyBy('agency_id');
        $month = $this->funnel()['months'][0] ?? null;

        return [
            'brand' => ['name' => ShowcaseRules::BRAND, 'domain' => ShowcaseRules::DOMAIN],
            'kpis' => [
                'pending_listings' => $listings->where('status', 'en_revision')->count(),
                'pending_agencies' => $agencies->where('status', 'en_revision')->count(),
                'agencies' => $agencies->count(),
                'published' => $this->db()->table('platform_showcase_listings')->where('status', 'publicado')->count(),
                'month_visits' => $month['visita'] ?? 0,
                'month_bookings' => $month['reserva'] ?? 0,
                'fees' => Decimal::toApi($stats->reduce(fn ($sum, object $row) => $sum->plus(Decimal::money($row->fees)), Decimal::money(0))),
            ],
            'listings' => $listings->map(fn (object $row) => $this->listing($row))->values()->all(),
            'agencies' => $agencies->map(fn (object $row) => [
                ...$this->agency($row),
                'listings' => (int) ($stats[$row->id]->listings ?? 0),
                'bookings' => (int) ($stats[$row->id]->bookings ?? 0),
                'fees' => Decimal::toApi(Decimal::money($stats[$row->id]->fees ?? 0)),
                'plan' => ShowcaseRules::PLAN_LABELS[ShowcaseRules::planOf($row->tenant_id)],
            ])->values()->all(),
        ];
    }

    public function funnel(): array
    {
        $rows = $this->db()->table('platform_funnel_events')
            ->selectRaw("to_char(occurred_at at time zone 'America/Lima', 'YYYY-MM') as month, kind, count(*) as total")
            ->groupByRaw("to_char(occurred_at at time zone 'America/Lima', 'YYYY-MM'), kind")->get();
        $months = $rows->groupBy('month')->sortKeysDesc()->map(function ($items, $month): array {
            $counts = collect(FunnelRecorder::KINDS)->mapWithKeys(fn (string $kind) => [$kind => (int) ($items->firstWhere('kind', $kind)->total ?? 0)])->all();

            return ['month' => $month, ...$counts, 'conversion_pct' => $counts['visita'] > 0 ? round(100 * $counts['reserva'] / $counts['visita'], 1) : null];
        })->values()->all();

        return ['months' => $months, 'steps' => FunnelRecorder::KINDS];
    }

    public function posts(bool $published): array
    {
        $rows = $this->db()->table('platform_blog_posts as p')->leftJoin('platform_users as u', 'u.id', '=', 'p.author_id')
            ->when($published, fn (Builder $q) => $q->where('p.status', 'publicado'))
            ->orderByRaw('p.published_at desc nulls first')->orderByDesc('p.created_at')
            ->get(['p.id', 'p.slug', 'p.title', 'p.excerpt', 'p.city', 'p.focus_keyword', 'p.status', 'p.word_count', 'p.seo_score', 'p.published_at', 'p.created_at', 'p.updated_at', DB::raw('array_to_json(p.linked_listing_ids) as linked'), 'u.name as author', DB::raw($published ? 'null as body' : 'p.body')]);

        return [
            'items' => $rows->map(fn (object $row) => $this->post($row, ! $published))->values()->all(),
            'kpis' => collect(['borrador', 'en_revision', 'publicado', 'archivado'])->mapWithKeys(fn (string $status) => [$status => $rows->where('status', $status)->count()])->all(),
            'rules' => ['min_words' => ShowcaseRules::BLOG_MIN_WORDS, 'min_listings' => ShowcaseRules::BLOG_MIN_LISTINGS],
            'listings' => $published ? [] : $this->db()->table('platform_showcase_listings')->where('status', 'publicado')->orderBy('city')->orderBy('title')->get(['id', 'code', 'title', 'city'])->map(fn (object $row) => ['id' => $row->id, 'code' => $row->code, 'title' => $row->title, 'city' => $row->city])->all(),
        ];
    }

    public function publicPost(string $slug): array
    {
        $row = $this->db()->table('platform_blog_posts as p')->leftJoin('platform_users as u', 'u.id', '=', 'p.author_id')->where('p.slug', $slug)->where('p.status', 'publicado')
            ->first(['p.id', 'p.slug', 'p.title', 'p.excerpt', 'p.body', 'p.city', 'p.focus_keyword', 'p.status', 'p.word_count', 'p.seo_score', 'p.published_at', 'p.created_at', 'p.updated_at', DB::raw('array_to_json(p.linked_listing_ids) as linked'), 'u.name as author'])
            ?? throw ApiException::notFound('El artículo no existe.');
        $linked = PgArray::parse($row->linked);
        $tours = $linked === [] ? collect() : $this->listings()->whereIn('l.id', $linked)->where('l.status', 'publicado')->where('a.status', 'activa')->get();

        return [...$this->post($row, true), 'tours' => $tours->map(fn (object $tour) => $this->listing($tour))->values()->all()];
    }

    public function listing(object $row): array
    {
        $today = Carbon::today('America/Lima')->toDateString();

        return [
            'id' => $row->id,
            'code' => $row->code,
            'slug' => $row->slug,
            'title' => $row->title,
            'city' => $row->city,
            'zone' => $row->zone,
            'theme' => $row->theme,
            'languages' => PgArray::parse($row->languages_json ?? null),
            'start_times' => PgArray::parse($row->times_json ?? null),
            'highlights' => PgArray::parse($row->highlights_json ?? null),
            'duration_hours' => (float) $row->duration_hours,
            'meeting_point' => $row->meeting_point,
            'model' => $row->model,
            'price' => Decimal::toApi(Decimal::money($row->price)),
            'currency' => $row->currency,
            'capacity' => (int) $row->capacity,
            'status' => $row->status,
            'reject_reason' => $row->reject_reason,
            'featured' => $row->featured_until !== null && (string) $row->featured_until >= $today,
            'featured_until' => $row->featured_until,
            'rating' => $row->rating === null ? null : (float) $row->rating,
            'reviews' => (int) $row->reviews,
            'tenant_product_ref' => $row->tenant_product_ref,
            'published_at' => $row->published_at ? Carbon::parse($row->published_at)->toIso8601String() : null,
            'updated_at' => Carbon::parse($row->updated_at)->toIso8601String(),
            'agency' => ['code' => $row->agency_code, 'name' => $row->agency_name, 'slug' => $row->agency_slug, 'city' => $row->agency_city, 'verified' => $row->agency_status === 'activa', 'rating' => $row->agency_rating === null ? null : (float) $row->agency_rating, 'reviews' => (int) $row->agency_reviews],
        ];
    }

    public function agency(object $row): array
    {
        return [
            'id' => $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'slug' => $row->slug,
            'city' => $row->city,
            'ruc' => $row->ruc,
            'email' => $row->email,
            'phone' => $row->phone,
            'license_ref' => $row->license_ref,
            'status' => $row->status,
            'verified_at' => $row->verified_at ? Carbon::parse($row->verified_at)->toIso8601String() : null,
            'rating' => $row->rating === null ? null : (float) $row->rating,
            'reviews' => (int) $row->reviews,
            'has_account' => $row->tenant_id !== null,
            'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
        ];
    }

    public function booking(object $row): array
    {
        return [
            'code' => $row->code,
            'listing' => ['code' => $row->listing_code, 'title' => $row->listing_title, 'model' => $row->listing_model],
            'service_date' => (string) $row->service_date,
            'start_time' => $row->start_time,
            'traveler_name' => $row->traveler_name,
            'traveler_email' => $row->traveler_email,
            'pax' => (int) $row->pax,
            'language' => $row->language,
            'status' => $row->status,
            'amount' => $row->amount === null ? null : Decimal::toApi(Decimal::money($row->amount)),
            'currency' => $row->currency,
            'commission_pct' => $row->commission_pct === null ? null : (string) $row->commission_pct,
            'fee_amount' => Decimal::toApi(Decimal::money($row->fee_amount)),
            'fee_basis' => $row->fee_basis,
            'source' => $row->source,
            'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
        ];
    }

    public function commercialTerms(): array
    {
        return [
            'free_monthly_bookings' => ShowcaseRules::FREE_MONTHLY_BOOKINGS,
            'fee_per_attendee' => ShowcaseRules::FEE_PER_ATTENDEE,
            'fee_currency' => ShowcaseRules::FEE_CURRENCY,
            'commission_pct' => ShowcaseRules::COMMISSION_PCT,
        ];
    }

    public function listings(): Builder
    {
        return $this->db()->table('platform_showcase_listings as l')->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')
            ->select([...self::LISTING_COLUMNS, DB::raw('array_to_json(l.languages) as languages_json'), DB::raw('array_to_json(l.start_times) as times_json'), DB::raw('array_to_json(l.highlights) as highlights_json')]);
    }

    private function ranked(Builder $query): Builder
    {
        return $query->orderByRaw('(l.featured_until is not null and l.featured_until >= current_date) desc')
            ->orderByDesc('l.reviews')
            ->orderByRaw("coalesce((select count(*) filter (where b.status = 'asistio')::numeric / nullif(count(*) filter (where b.status in ('asistio', 'no_show')), 0) from platform_showcase_bookings b where b.listing_id = l.id), 0) desc")
            ->orderBy('l.title');
    }

    private function attendance(array $listingIds): array
    {
        return $this->db()->table('platform_showcase_bookings')->whereIn('listing_id', $listingIds)->groupBy('listing_id')
            ->selectRaw("listing_id, count(*) filter (where status = 'asistio') as went, count(*) filter (where status in ('asistio', 'no_show')) as closed")
            ->get()->mapWithKeys(fn (object $row) => [(string) $row->listing_id => (int) $row->closed > 0 ? (int) round(100 * (int) $row->went / (int) $row->closed) : null])->all();
    }

    private function agencySite(?string $tenantId): ?string
    {
        if ($tenantId === null || ShowcaseRules::planOf($tenantId) === 'none') {
            return null;
        }

        $tenant = $this->db()->table('tenants')->where('id', $tenantId)->first(['custom_domain', 'subdomain']);

        return $tenant?->custom_domain ?: ($tenant?->subdomain ? $tenant->subdomain.'.'.config('sites.domain') : null);
    }

    private function bookingsOf(string $agencyId): Builder
    {
        return $this->db()->table('platform_showcase_bookings as b')->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')
            ->where('l.agency_id', $agencyId)
            ->select(['b.*', 'l.code as listing_code', 'l.title as listing_title', 'l.model as listing_model']);
    }

    private function post(object $row, bool $withBody): array
    {
        return [
            'id' => $row->id,
            'slug' => $row->slug,
            'title' => $row->title,
            'excerpt' => $row->excerpt,
            'body' => $withBody ? $row->body : null,
            'city' => $row->city,
            'focus_keyword' => $row->focus_keyword,
            'status' => $row->status,
            'word_count' => (int) $row->word_count,
            'seo_score' => $row->seo_score === null ? null : (int) $row->seo_score,
            'published_at' => $row->published_at ? Carbon::parse($row->published_at)->toIso8601String() : null,
            'linked_listing_ids' => PgArray::parse($row->linked),
            'author' => $row->author,
            'updated_at' => Carbon::parse($row->updated_at)->toIso8601String(),
        ];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
