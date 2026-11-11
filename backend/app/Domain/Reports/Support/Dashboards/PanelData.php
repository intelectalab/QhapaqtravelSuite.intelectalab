<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\KpiReport;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PanelData
{
    public const ACTIVE = ['confirmada', 'en_operacion', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'incidencia', 'reprogramada', 'pendiente_disponibilidad'];

    public const OPEN_QUOTES = ['borrador', 'enviada', 'vista', 'negociacion'];

    public const CLOSED_STAGES = ['ganada', 'perdida'];

    public const SEVERITY = ['critica', 'alta', 'media', 'baja'];

    private const MONTHS = 6;

    private ?float $usd = null;

    public function __construct(private readonly TenantContext $context) {}

    public function now(): Carbon
    {
        return Carbon::now($this->context->timezone());
    }

    public function today(): string
    {
        return $this->now()->toDateString();
    }

    public function monthLabel(?Carbon $date = null): string
    {
        return ($date ?? $this->now())->locale('es')->isoFormat('MMMM');
    }

    public function monthStart(): Carbon
    {
        return $this->now()->startOfMonth();
    }

    public function reservations(User $viewer): Builder
    {
        return Portfolio::scope(DB::table('booking_reservations as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id');
    }

    public function months(User $viewer): Collection
    {
        $timezone = $this->context->timezone();
        $start = $this->monthStart()->subMonths(self::MONTHS - 1);
        $month = "to_char(r.created_at at time zone '{$timezone}', 'YYYY-MM')";
        $sold = $this->reservations($viewer)->whereIn('r.status', KpiReport::SOLD)->where('r.created_at', '>=', $start->copy()->utc());
        $sales = (clone $sold)->selectRaw("{$month} as month, sum(r.total_amount * r.fx_rate) as sales, count(*) as total")->groupBy('month')->get()->keyBy('month');
        $costs = (clone $sold)->join('booking_reservation_services as s', 's.reservation_id', '=', 'r.id')->where('s.status', '<>', 'cancelado')
            ->selectRaw("{$month} as month, sum(s.cost_amount * coalesce(s.fx_rate, 1)) as cost")->groupBy('month')->pluck('cost', 'month');
        $leads = Portfolio::scope(DB::table('crm_leads as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')->where('r.status', '<>', 'duplicado')->where('r.created_at', '>=', $start->copy()->utc())
            ->selectRaw("{$month} as month, count(*) as total")->groupBy('month')->pluck('total', 'month');
        $quotes = Portfolio::scope(DB::table('quote_quotes as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')->where('r.created_at', '>=', $start->copy()->utc())
            ->selectRaw("{$month} as month, count(*) as total")->groupBy('month')->pluck('total', 'month');

        return collect(range(0, self::MONTHS - 1))->map(function (int $offset) use ($start, $sales, $costs, $leads, $quotes): array {
            $date = $start->copy()->addMonths($offset);
            $key = $date->format('Y-m');
            $amount = round((float) ($sales[$key]->sales ?? 0), 2);
            $cost = round((float) ($costs[$key] ?? 0), 2);

            return [
                'key' => $key,
                'label' => ucfirst(rtrim($date->locale('es')->isoFormat('MMM'), '.')),
                'sales' => $amount,
                'cost' => $cost,
                'margin' => $amount > 0 && $cost > 0 ? round(($amount - $cost) / $amount * 100, 1) : null,
                'reservations' => (int) ($sales[$key]->total ?? 0),
                'leads' => (int) ($leads[$key] ?? 0),
                'quotes' => (int) ($quotes[$key] ?? 0),
            ];
        })->values();
    }

    public function salesKpis(Collection $months): array
    {
        $current = $months->last();
        $previous = $months->slice(-2, 1)->first();

        return [
            'sales' => ['value' => $current['sales'], 'previous' => $previous['sales'] ?? 0, 'previous_label' => $previous['label'] ?? null],
            'margin' => ['value' => $current['margin'], 'previous' => $previous['margin'] ?? null],
        ];
    }

    public function receivables(User $viewer): Collection
    {
        return Portfolio::scope(
            DB::table('fin_receivables as f')->join('crm_clients as c', 'c.id', '=', 'f.client_id')->whereNull('f.deleted_at')->whereNotIn('f.status', ['pagada', 'cancelada']),
            $viewer,
            'c.owner_id',
        )->orderBy('f.due_date')->get(['f.code', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.fx_rate', 'f.status', 'f.due_date', 'c.name as client', 'c.code as client_code']);
    }

    public function balance(object $row): float
    {
        return ((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1);
    }

    public function overdue(object $row): bool
    {
        return $row->status === 'vencida' || (string) $row->due_date < $this->today();
    }

    public function pen(float $amount, mixed $fx): float
    {
        return $amount * (float) ($fx ?: 1);
    }

    public function openIncidents(?User $viewer = null): Collection
    {
        $query = DB::table('ops_incidents as i')->leftJoin('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->whereNotIn('i.status', ['resuelta', 'cerrada']);
        if ($viewer !== null) {
            $query = Portfolio::scope($query, $viewer, 'r.owner_id');
        }

        return $query->orderByRaw("array_position(array['critica','alta','media','baja']::varchar[], i.severity::varchar)")->orderByDesc('i.created_at')
            ->get(['i.code', 'i.title', 'i.type', 'i.severity', 'i.status', 'r.code as reservation'])
            ->map(fn (object $row): array => ['code' => $row->code, 'title' => $row->title, 'type' => $row->type, 'severity' => $row->severity, 'status' => $row->status, 'reservation' => $row->reservation]);
    }

    public function critical(Collection $incidents): ?array
    {
        return $incidents->firstWhere('severity', 'critica');
    }

    public function services(string $from, string $to, ?User $viewer = null, bool $withProvider = false): Collection
    {
        $query = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'borrador', 'completada'])->where('s.status', '<>', 'cancelado')
            ->whereBetween('s.service_date', [$from, $to])
            ->when($withProvider, fn (Builder $builder) => $builder->whereNotNull('s.provider_id'));
        if ($viewer !== null) {
            $query = Portfolio::scope($query, $viewer, 'r.owner_id');
        }

        return $query->orderBy('s.service_date')->orderBy('s.service_time')
            ->get(['s.id', 's.name', 's.service_date', 's.service_time', 's.status', 's.pax', 's.confirmation_code', 'p.name as provider', 'r.code as reservation']);
    }

    public function serviceRow(object $row): array
    {
        return [
            'id' => $row->id,
            'date' => $row->service_date,
            'time' => $row->service_time === null ? null : substr((string) $row->service_time, 0, 5),
            'name' => $row->name,
            'provider' => $row->provider,
            'reservation' => $row->reservation,
            'pax' => (int) $row->pax,
            'status' => $row->status,
        ];
    }

    public function departures(int $limit = 6): Collection
    {
        return DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'd.guide_id')
            ->whereNull('p.deleted_at')->whereIn('d.status', ['abierta', 'completa'])->where('d.departure_date', '>=', $this->today())
            ->orderBy('d.departure_date')->orderBy('d.departure_time')->limit($limit)
            ->get(['d.ref', 'd.departure_date', 'd.departure_time', 'd.capacity', 'd.sold', 'd.status', 'p.name as product', 'g.full_name as guide'])
            ->map(fn (object $row): array => [
                'ref' => $row->ref,
                'product' => $row->product,
                'date' => $row->departure_date,
                'time' => $row->departure_time === null ? null : substr((string) $row->departure_time, 0, 5),
                'capacity' => (int) $row->capacity,
                'sold' => (int) $row->sold,
                'guide' => $row->guide,
            ]);
    }

    public function passengers(Collection $reservationIds): Collection
    {
        return DB::table('booking_passengers')->whereIn('reservation_id', $reservationIds)->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
    }

    public function quotesFollowUp(User $viewer, ?string $ownerId = null, int $limit = 6): Collection
    {
        return Portfolio::scope(DB::table('quote_quotes as q')->join('crm_clients as c', 'c.id', '=', 'q.client_id'), $viewer, 'q.owner_id')
            ->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')
            ->whereNull('q.deleted_at')->whereIn('q.status', ['enviada', 'vista', 'negociacion'])
            ->when($ownerId !== null, fn (Builder $query) => $query->where('q.owner_id', $ownerId))
            ->orderBy('q.valid_until')->limit($limit)
            ->get(['q.code', 'q.title', 'q.status', 'q.valid_until', 'q.viewed_at', 'q.current_version_no', 'q.currency', 'v.grand_total', 'v.margin_pct', 'c.name as client'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'title' => $row->title,
                'client' => $row->client,
                'status' => $row->status,
                'version' => (int) $row->current_version_no,
                'valid_until' => $row->valid_until,
                'viewed' => $row->viewed_at !== null,
                'total' => round((float) $row->grand_total, 2),
                'currency' => $row->currency,
                'margin' => $row->margin_pct === null ? null : round((float) $row->margin_pct, 1),
            ]);
    }

    public function activities(?string $ownerId, int $limit): Collection
    {
        return DB::table('crm_activities as a')->leftJoin('iam_users as u', 'u.id', '=', 'a.owner_id')->where('a.status', '<>', 'completada')
            ->when($ownerId !== null, fn (Builder $query) => $query->where('a.owner_id', $ownerId))
            ->orderBy('a.due_at')->limit($limit)
            ->get(['a.code', 'a.type', 'a.subject', 'a.due_at', 'a.status', 'u.name as owner'])
            ->map(fn (object $row): array => ['code' => $row->code, 'type' => $row->type, 'subject' => $row->subject, 'due_at' => $row->due_at, 'status' => $row->status, 'owner' => $row->owner]);
    }

    public function channels(User $viewer): array
    {
        return $this->reservations($viewer)->whereIn('r.status', KpiReport::SOLD)->where('r.created_at', '>=', $this->monthStart()->utc())
            ->selectRaw('r.channel as label, sum(r.total_amount * r.fx_rate) as sales, count(*) as total')->groupBy('label')->orderByDesc('sales')->get()
            ->map(fn (object $row): array => ['label' => (string) ($row->label ?: 'Sin canal'), 'sales' => round((float) $row->sales, 2), 'count' => (int) $row->total])->all();
    }

    public function opportunityPen(object $row): float
    {
        if ($row->currency !== 'USD') {
            return (float) $row->amount;
        }

        $this->usd ??= (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? 3.75);

        return (float) $row->amount * $this->usd;
    }

    public function openOpportunities(?string $ownerId): Collection
    {
        return DB::table('crm_opportunities as o')->whereNull('o.deleted_at')->whereNotIn('o.stage', self::CLOSED_STAGES)
            ->when($ownerId !== null, fn (Builder $query) => $query->where('o.owner_id', $ownerId))
            ->get(['o.code', 'o.title', 'o.stage', 'o.amount', 'o.currency', 'o.probability', 'o.expected_close_date', 'o.owner_id'])
            ->map(function (object $row): object {
                $row->amount_pen = $this->opportunityPen($row);

                return $row;
            });
    }
}
