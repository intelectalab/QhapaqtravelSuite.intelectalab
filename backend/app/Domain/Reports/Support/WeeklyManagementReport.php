<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class WeeklyManagementReport
{
    public const UPCOMING_DAYS = 7;

    public function __construct(private readonly TenantContext $context) {}

    public function build(?CarbonImmutable $today = null): array
    {
        $timezone = $this->context->timezone();
        $today ??= CarbonImmutable::now($timezone)->startOfDay();
        $from = $today->startOfWeek()->subWeek();
        $to = $from->addDays(6);
        $previousFrom = $from->subWeek();
        $current = $this->period($from, $to);
        $previous = $this->period($previousFrom, $previousFrom->addDays(6));
        $tenant = $this->context->tenant();
        $branding = (array) (((array) $tenant->settings)['branding'] ?? []);

        return [
            'agency' => [
                'name' => (string) $tenant->commercial_name,
                'legal_name' => (string) $tenant->legal_name,
                'ruc' => (string) $tenant->ruc,
                'initials' => (string) ($tenant->logo_initials ?: mb_substr((string) $tenant->commercial_name, 0, 2)),
                'brand' => $this->color($branding['brand'] ?? null, '#b3263e'),
                'accent' => $this->color($branding['accent'] ?? null, '#26357a'),
                'ink' => $this->color($branding['menu'] ?? null, '#141a33'),
            ],
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'label' => $this->label($from, $to),
                'previous_label' => $this->label($previousFrom, $previousFrom->addDays(6)),
                'generated_at' => CarbonImmutable::now($timezone)->format('d/m/Y H:i'),
            ],
            'kpis' => [
                $this->kpi('Ventas', $current['sales'], $previous['sales'], 'money'),
                $this->kpi('Reservas vendidas', $current['reservations'], $previous['reservations'], 'count'),
                $this->kpi('Ticket promedio', $current['ticket'], $previous['ticket'], 'money'),
                $this->kpi('Margen bruto', $current['margin_pct'], $previous['margin_pct'], 'percent'),
                $this->kpi('Cobrado', $current['collected'], $previous['collected'], 'money'),
                $this->kpi('Cotizaciones nuevas', $current['quotes'], $previous['quotes'], 'count'),
                $this->kpi('Cotizaciones ganadas', $current['quotes_won'], $previous['quotes_won'], 'count'),
                $this->kpi('Leads nuevos', $current['leads'], $previous['leads'], 'count'),
            ],
            'days' => $this->days($from),
            'channels' => $this->breakdown($from, $to, 'r.channel'),
            'advisors' => $this->advisors($from, $to),
            'products' => $this->products($from, $to),
            'collection' => $this->collection($today),
            'upcoming' => $this->upcoming($today),
            'alerts' => $this->alerts($today),
        ];
    }

    private function period(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$start, $end] = $this->bounds($from, $to);
        $sold = $this->sold()->where('r.created_at', '>=', $start)->where('r.created_at', '<', $end);
        $totals = (clone $sold)->selectRaw('coalesce(sum(r.total_amount * coalesce(r.fx_rate, 1)), 0) as sales, count(*) as total')->first();
        $cost = (string) ((clone $sold)->join('booking_reservation_services as s', 's.reservation_id', '=', 'r.id')->where('s.status', '<>', 'cancelado')->selectRaw('coalesce(sum(s.cost_amount * coalesce(s.fx_rate, 1)), 0) as cost')->value('cost') ?? '0');
        $sales = Decimal::money($totals->sales ?? '0');
        $count = (int) ($totals->total ?? 0);
        $collected = DB::table('fin_payments')->where('status', 'aplicado')->where('kind', 'cobro')->whereBetween('paid_on', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('coalesce(sum(amount * coalesce(fx_rate, 1)), 0) as total')->value('total');
        $quotes = DB::table('quote_quotes')->whereNull('deleted_at')->where('created_at', '>=', $start)->where('created_at', '<', $end);

        return [
            'sales' => $sales,
            'reservations' => $count,
            'ticket' => $count > 0 ? $sales->dividedBy($count, 2, RoundingMode::HALF_UP) : null,
            'margin_pct' => $sales->isPositive() && Decimal::of($cost)->isPositive() ? $sales->minus(Decimal::of($cost))->multipliedBy(100)->dividedBy($sales, 1, RoundingMode::HALF_UP) : null,
            'collected' => Decimal::money($collected ?? '0'),
            'quotes' => (clone $quotes)->count(),
            'quotes_won' => DB::table('quote_quotes')->whereNull('deleted_at')->whereIn('status', ['aprobada', 'convertida'])->where('updated_at', '>=', $start)->where('updated_at', '<', $end)->count(),
            'leads' => DB::table('crm_leads')->whereNull('deleted_at')->where('created_at', '>=', $start)->where('created_at', '<', $end)->count(),
        ];
    }

    private function days(CarbonImmutable $from): array
    {
        $timezone = $this->context->timezone();
        [$start, $end] = $this->bounds($from, $from->addDays(6));
        $sales = $this->sold()->where('r.created_at', '>=', $start)->where('r.created_at', '<', $end)
            ->selectRaw("to_char(r.created_at at time zone '{$timezone}', 'YYYY-MM-DD') as day, sum(r.total_amount * coalesce(r.fx_rate, 1)) as sales, count(*) as total")->groupBy('day')->get()->keyBy('day');
        $max = $sales->reduce(fn (BigDecimal $carry, object $row): BigDecimal => Decimal::of($row->sales)->isGreaterThan($carry) ? Decimal::of($row->sales) : $carry, BigDecimal::zero());

        return collect(range(0, 6))->map(function (int $offset) use ($from, $sales, $max): array {
            $day = $from->addDays($offset);
            $row = $sales->get($day->toDateString());
            $amount = Decimal::money($row->sales ?? '0');

            return [
                'label' => ucfirst(rtrim($day->locale('es')->isoFormat('ddd'), '.')).' '.$day->day,
                'sales' => (string) $amount,
                'count' => (int) ($row->total ?? 0),
                'width' => $max->isPositive() && $amount->isPositive() ? max(2, (int) (string) $amount->multipliedBy(100)->dividedBy($max, 0, RoundingMode::HALF_UP)) : 0,
            ];
        })->all();
    }

    private function breakdown(CarbonImmutable $from, CarbonImmutable $to, string $column): array
    {
        [$start, $end] = $this->bounds($from, $to);

        return $this->sold()->where('r.created_at', '>=', $start)->where('r.created_at', '<', $end)
            ->selectRaw("coalesce({$column}, 'Sin canal') as label, sum(r.total_amount * coalesce(r.fx_rate, 1)) as sales, count(*) as total")->groupBy('label')->orderByDesc('sales')->get()
            ->map(fn (object $row): array => ['label' => (string) $row->label, 'sales' => (string) Decimal::money($row->sales), 'count' => (int) $row->total])->all();
    }

    private function advisors(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$start, $end] = $this->bounds($from, $to);

        return $this->sold()->join('iam_users as u', 'u.id', '=', 'r.owner_id')->where('r.created_at', '>=', $start)->where('r.created_at', '<', $end)
            ->selectRaw('u.name as label, sum(r.total_amount * coalesce(r.fx_rate, 1)) as sales, count(*) as total')->groupBy('u.name')->orderByDesc('sales')->limit(8)->get()
            ->map(fn (object $row): array => ['label' => (string) $row->label, 'sales' => (string) Decimal::money($row->sales), 'count' => (int) $row->total])->all();
    }

    private function products(CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$start, $end] = $this->bounds($from, $to);

        return $this->sold()->join('booking_reservation_services as s', 's.reservation_id', '=', 'r.id')->join('catalog_products as p', 'p.id', '=', 's.product_id')
            ->where('s.status', '<>', 'cancelado')->where('r.created_at', '>=', $start)->where('r.created_at', '<', $end)
            ->selectRaw('p.name as label, sum(s.price_amount * coalesce(s.fx_rate, 1)) as sales, sum(coalesce(s.pax, 0)) as pax')->groupBy('p.name')->orderByDesc('sales')->limit(5)->get()
            ->map(fn (object $row): array => ['label' => (string) $row->label, 'sales' => (string) Decimal::money($row->sales), 'count' => (int) $row->pax])->all();
    }

    private function collection(CarbonImmutable $today): array
    {
        $rows = DB::table('fin_receivables')->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])->get(['amount', 'paid_amount', 'fx_rate', 'due_date']);
        $buckets = ['Por vencer' => BigDecimal::zero(), '1 a 30 días' => BigDecimal::zero(), '31 a 60 días' => BigDecimal::zero(), 'Más de 60 días' => BigDecimal::zero()];
        $counts = array_fill_keys(array_keys($buckets), 0);

        foreach ($rows as $row) {
            $late = (int) CarbonImmutable::parse($row->due_date, $today->getTimezone())->diffInDays($today, false);
            $key = match (true) {
                $late <= 0 => 'Por vencer',
                $late <= 30 => '1 a 30 días',
                $late <= 60 => '31 a 60 días',
                default => 'Más de 60 días',
            };
            $buckets[$key] = $buckets[$key]->plus(Decimal::of($row->amount)->minus(Decimal::of($row->paid_amount))->multipliedBy(Decimal::of($row->fx_rate ?: '1')));
            $counts[$key]++;
        }

        $open = array_reduce($buckets, fn (BigDecimal $sum, BigDecimal $value): BigDecimal => $sum->plus($value), BigDecimal::zero());

        return [
            'open' => (string) Decimal::round2($open),
            'overdue' => (string) Decimal::round2($open->minus($buckets['Por vencer'])),
            'aging' => collect($buckets)->map(fn (BigDecimal $amount, string $label): array => ['label' => $label, 'amount' => (string) Decimal::round2($amount), 'count' => $counts[$label]])->values()->all(),
        ];
    }

    private function upcoming(CarbonImmutable $today): array
    {
        return DB::table('booking_reservations as r')->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')
            ->whereIn('r.status', KpiReport::SOLD)->whereBetween('r.travel_from', [$today->toDateString(), $today->addDays(self::UPCOMING_DAYS)->toDateString()])
            ->orderBy('r.travel_from')->limit(15)
            ->get(['r.code', 'r.title', 'r.travel_from', 'r.status', 'c.name as client'])
            ->map(fn (object $row): array => ['code' => $row->code, 'title' => (string) $row->title, 'client' => (string) ($row->client ?? '—'), 'date' => CarbonImmutable::parse($row->travel_from)->format('d/m'), 'status' => str_replace('_', ' ', (string) $row->status)])->all();
    }

    private function alerts(CarbonImmutable $today): array
    {
        $incidents = DB::table('ops_incidents')->whereIn('status', ['abierta', 'en_proceso'])->count();
        $late = DB::table('ops_incidents')->whereIn('status', ['abierta', 'en_proceso'])->where('sla_due_at', '<', now())->count();
        $claims = DB::table('crm_cases')->where('is_book', true)->whereIn('book_status', ['received', 'in_review'])->where('due_date', '<=', $today->addDays(5)->toDateString())->count();
        $quotes = DB::table('quote_quotes')->whereNull('deleted_at')->whereIn('status', ['enviada', 'vista', 'negociacion'])->count();

        return array_values(array_filter([
            $incidents ? ['label' => 'Incidencias abiertas', 'value' => $incidents, 'note' => $late ? "{$late} con SLA vencido" : 'en plazo', 'tone' => $late ? 'bad' : 'neutral'] : null,
            $claims ? ['label' => 'Reclamos por vencer o vencidos', 'value' => $claims, 'note' => 'responder antes del plazo legal', 'tone' => 'bad'] : null,
            $quotes ? ['label' => 'Cotizaciones esperando respuesta', 'value' => $quotes, 'note' => 'enviadas, vistas o en negociación', 'tone' => 'neutral'] : null,
        ]));
    }

    private function kpi(string $label, BigDecimal|int|null $value, BigDecimal|int|null $previous, string $kind): array
    {
        $change = null;

        if ($value !== null && $previous !== null && ! Decimal::of($previous)->isZero()) {
            $change = $kind === 'percent'
                ? (string) Decimal::of($value)->minus(Decimal::of($previous))->toScale(1, RoundingMode::HALF_UP)
                : (string) Decimal::of($value)->minus(Decimal::of($previous))->multipliedBy(100)->dividedBy(Decimal::of($previous)->abs(), 1, RoundingMode::HALF_UP);
        }

        return ['label' => $label, 'kind' => $kind, 'value' => $value === null ? null : (string) $value, 'previous' => $previous === null ? null : (string) $previous, 'change' => $change];
    }

    private function sold(): Builder
    {
        return DB::table('booking_reservations as r')->whereNull('r.deleted_at')->whereIn('r.status', KpiReport::SOLD);
    }

    private function bounds(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return [$from->startOfDay()->utc(), $to->addDay()->startOfDay()->utc()];
    }

    private function label(CarbonImmutable $from, CarbonImmutable $to): string
    {
        return $from->locale('es')->isoFormat('D [de] MMMM').' al '.$to->locale('es')->isoFormat('D [de] MMMM [de] YYYY');
    }

    private function color(?string $value, string $fallback): string
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1 ? $value : $fallback;
    }
}
