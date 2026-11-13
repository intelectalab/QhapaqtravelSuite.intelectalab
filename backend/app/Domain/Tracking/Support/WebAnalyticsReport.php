<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class WebAnalyticsReport
{
    public const TIMEZONE = 'America/Lima';

    private const METRICS = 'coalesce(sum(visits),0) as visits, coalesce(sum(visitors),0) as visitors, coalesce(sum(pageviews),0) as pageviews, coalesce(sum(bounces),0) as bounces, coalesce(sum(engaged_seconds),0) as engaged, coalesce(sum(conversions),0) as conversions, coalesce(sum(revenue),0) as revenue';

    public const DEVICES = ['movil' => 'Móvil', 'escritorio' => 'Escritorio', 'tablet' => 'Tablet', 'otro' => 'Otro'];

    public function __construct(private readonly CookielessCounter $counter) {}

    public static function period(array $input, int $retentionDays): array
    {
        $data = Validator::make($input, [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'days' => ['nullable', 'integer', 'in:7,30,90,365'],
            'compare' => ['nullable', 'boolean'],
            'site' => ['nullable', 'in:vitrina,blog'],
            'agency' => ['nullable', 'string', 'max:40'],
        ], [
            'from.*' => 'La fecha inicial debe tener el formato AAAA-MM-DD.',
            'to.*' => 'La fecha final debe tener el formato AAAA-MM-DD.',
            'days.in' => 'Elige un periodo de 7, 30, 90 o 365 días.',
        ])->validate();
        $today = CarbonImmutable::now(self::TIMEZONE)->startOfDay();
        $to = isset($data['to']) ? CarbonImmutable::parse($data['to'], self::TIMEZONE) : $today;
        $from = isset($data['from']) ? CarbonImmutable::parse($data['from'], self::TIMEZONE) : $to->subDays((int) ($data['days'] ?? 30) - 1);

        if ($from->greaterThan($to)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La fecha inicial debe ser anterior a la final.', ['field' => 'from']);
        }

        $floor = $today->subDays($retentionDays - 1);

        return [
            'from' => $from->lessThan($floor) ? $floor : $from,
            'to' => $to,
            'compare' => filter_var($data['compare'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'site' => $data['site'] ?? null,
            'agency' => $data['agency'] ?? null,
            'clamped' => $from->lessThan($floor),
            'retention_days' => $retentionDays,
        ];
    }

    public function overview(AnalyticsScope $scope, array $period): array
    {
        $current = $this->totals($scope, $period['from'], $period['to'], $period);
        $days = $period['from']->diffInDays($period['to']) + 1;
        $previous = $period['compare'] ? $this->totals($scope, $period['from']->subDays($days), $period['from']->subDay(), $period) : null;
        $byDay = $this->query($scope, $period['from'], $period['to'], $period)->selectRaw('day, '.self::METRICS)->groupBy('day')->get()->keyBy(fn (object $row) => substr((string) $row->day, 0, 10));
        $trend = collect(CarbonPeriod::create($period['from'], $period['to']))->map(function ($day) use ($byDay): array {
            $key = $day->format('Y-m-d');
            $row = $byDay[$key] ?? null;

            return ['day' => $key, 'visits' => (int) ($row->visits ?? 0), 'visitors' => (int) ($row->visitors ?? 0), 'pageviews' => (int) ($row->pageviews ?? 0), 'conversions' => (int) ($row->conversions ?? 0)];
        })->values();

        return [
            'period' => ['from' => $period['from']->toDateString(), 'to' => $period['to']->toDateString(), 'days' => $days, 'clamped' => $period['clamped'], 'retention_days' => $period['retention_days']],
            'kpis' => $current,
            'previous' => $previous,
            'trend' => $trend,
            'realtime' => $this->counter->live($scope->liveKey($period['site'])),
        ];
    }

    public function pages(AnalyticsScope $scope, array $period): array
    {
        return $this->query($scope, $period['from'], $period['to'], $period)->selectRaw('path, '.self::METRICS)->groupBy('path')->orderByDesc('pageviews')->limit(100)->get()
            ->map(fn (object $row) => ['path' => $row->path, ...$this->metrics($row)])->values()->all();
    }

    public function sources(AnalyticsScope $scope, array $period): array
    {
        return $this->query($scope, $period['from'], $period['to'], $period)->selectRaw('source, medium, campaign, '.self::METRICS)->groupBy('source', 'medium', 'campaign')->orderByDesc('visits')->limit(100)->get()
            ->map(fn (object $row) => ['source' => $row->source, 'medium' => $row->medium, 'campaign' => $row->campaign === '' ? null : $row->campaign, ...$this->metrics($row)])->values()->all();
    }

    public function devices(AnalyticsScope $scope, array $period): array
    {
        return [
            'devices' => $this->query($scope, $period['from'], $period['to'], $period)->selectRaw('device, '.self::METRICS)->groupBy('device')->orderByDesc('visits')->get()
                ->map(fn (object $row) => ['device' => $row->device, 'label' => self::DEVICES[$row->device] ?? $row->device, ...$this->metrics($row)])->values()->all(),
            'countries' => $this->query($scope, $period['from'], $period['to'], $period)->selectRaw('country, '.self::METRICS)->groupBy('country')->orderByDesc('visits')->limit(30)->get()
                ->map(fn (object $row) => ['country' => $row->country, ...$this->metrics($row)])->values()->all(),
        ];
    }

    public function daily(AnalyticsScope $scope, array $period): Collection
    {
        return $this->query($scope, $period['from'], $period['to'], $period)->selectRaw('day, '.self::METRICS)->groupBy('day')->orderBy('day')->get();
    }

    public function agencies(array $period): array
    {
        $scope = AnalyticsScope::platform();
        $rows = $this->query($scope, $period['from'], $period['to'], $period)->whereNotNull('agency_id')->selectRaw('agency_id, '.self::METRICS)->groupBy('agency_id')->get()->keyBy('agency_id');
        $trend = $this->query($scope, $period['to']->subDays(13), $period['to'], $period)->whereNotNull('agency_id')->selectRaw('agency_id, day, sum(visits) as visits')->groupBy('agency_id', 'day')->get()->groupBy('agency_id');
        $agencies = DB::connection('pgsql_platform')->table('platform_showcase_agencies as a')->leftJoin('tenants as t', 't.id', '=', 'a.tenant_id')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')
            ->get(['a.id', 'a.code', 'a.name', 'a.city', 'a.status', 'p.name as plan']);

        return $agencies->map(function (object $agency) use ($rows, $trend, $period): array {
            $row = $rows[$agency->id] ?? null;
            $days = ($trend[$agency->id] ?? collect())->keyBy(fn (object $item) => substr((string) $item->day, 0, 10));

            return [
                'code' => $agency->code,
                'name' => $agency->name,
                'city' => $agency->city,
                'status' => $agency->status,
                'plan' => $agency->plan ?? 'Vitrina gratis',
                ...($row ? $this->metrics($row) : $this->metrics((object) [])),
                'trend' => collect(CarbonPeriod::create($period['to']->subDays(13), $period['to']))->map(fn ($day) => (int) ($days[$day->format('Y-m-d')]->visits ?? 0))->values()->all(),
            ];
        })->sortByDesc('visits')->values()->all();
    }

    private function totals(AnalyticsScope $scope, CarbonImmutable $from, CarbonImmutable $to, array $period): array
    {
        return $this->metrics($this->query($scope, $from, $to, $period)->selectRaw(self::METRICS)->first() ?? (object) []);
    }

    private function metrics(object $row): array
    {
        $visits = (int) ($row->visits ?? 0);
        $pageviews = (int) ($row->pageviews ?? 0);
        $conversions = (int) ($row->conversions ?? 0);

        return [
            'visits' => $visits,
            'visitors' => (int) ($row->visitors ?? 0),
            'pageviews' => $pageviews,
            'bounces' => (int) ($row->bounces ?? 0),
            'engaged_seconds' => (int) ($row->engaged ?? 0),
            'conversions' => $conversions,
            'revenue' => number_format((float) ($row->revenue ?? 0), 2, '.', ''),
            'bounce_rate' => $visits > 0 ? round(100 * (int) ($row->bounces ?? 0) / $visits, 1) : 0.0,
            'avg_seconds' => $visits > 0 ? (int) round((int) ($row->engaged ?? 0) / $visits) : 0,
            'pages_per_visit' => $visits > 0 ? round($pageviews / $visits, 2) : 0.0,
            'conversion_rate' => $visits > 0 ? round(100 * $conversions / $visits, 2) : 0.0,
        ];
    }

    private function query(AnalyticsScope $scope, CarbonImmutable $from, CarbonImmutable $to, array $period): Builder
    {
        $agency = $period['agency'] ?? null;

        return $this->db($scope)->table($scope->table)
            ->whereBetween('day', [$from->toDateString(), $to->toDateString()])
            ->when($scope->isPlatform() && ($period['site'] ?? null), fn (Builder $q) => $q->where('site', $period['site']))
            ->when($scope->isPlatform() && $agency, fn (Builder $q) => $q->whereIn('agency_id', DB::connection('pgsql_platform')->table('platform_showcase_agencies')->where('code', $agency)->orWhere('slug', $agency)->select('id')));
    }

    private function db(AnalyticsScope $scope): ConnectionInterface
    {
        return DB::connection($scope->connection);
    }
}
