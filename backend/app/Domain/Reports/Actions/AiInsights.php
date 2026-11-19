<?php

declare(strict_types=1);

namespace App\Domain\Reports\Actions;

use App\Domain\Crm\Support\SalesTargetDirectory;
use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Support\QuoteApprovalPolicy;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AiInsights
{
    public const RULE = 'R-AI-INSIGHTS';

    public const KINDS = ['margen_bajo' => 'Margen bajo', 'proveedor_caro' => 'Proveedor caro', 'meta_en_riesgo' => 'Meta en riesgo', 'cobranza_atrasada' => 'Cobranza atrasada', 'demanda_alta' => 'Demanda alta'];

    public const STATUSES = ['nueva' => 'Nueva', 'vista' => 'Vista', 'resuelta' => 'Resuelta', 'descartada' => 'Descartada'];

    public const SEVERITIES = ['alta' => 'Alta', 'media' => 'Media', 'baja' => 'Baja'];

    public const COST_KINDS = ['margen_bajo', 'proveedor_caro'];

    public const EXPENSIVE_GAP_PCT = '15';

    public const TARGET_SEVERITY = ['en_riesgo' => 'media', 'critico' => 'alta'];

    public const DEMAND_OCCUPANCY_PCT = 85;

    public const DEMAND_QUOTES = 5;

    public const DEMAND_WINDOW_DAYS = 7;

    private const MARGIN_CRITICAL = '5';

    private const EXPENSIVE_CRITICAL_PCT = '40';

    private const DEMAND_HORIZON_DAYS = 60;

    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
        private readonly GrowthFeatureGate $gate,
        private readonly QuoteApprovalPolicy $approval,
        private readonly SalesTargetDirectory $targets,
    ) {}

    public function list(Request $request, User $viewer): array
    {
        $this->gate->require(self::RULE);

        if (Cache::add($this->context->key('insights', Carbon::now($this->context->timezone())->toDateString()), true, now()->addDay())) {
            $this->generate();
        }

        $filters = CursorPage::filters($request);
        $query = $this->visible($viewer);
        $kpis = $this->kpis(clone $query);

        if (isset($filters['status']) && isset(self::STATUSES[$filters['status']])) {
            $query->where('i.status', $filters['status']);
        } elseif (! isset($filters['status'])) {
            $query->whereIn('i.status', ['nueva', 'vista']);
        }

        if (isset($filters['kind']) && isset(self::KINDS[$filters['kind']])) {
            $query->where('i.kind', $filters['kind']);
        }

        if (isset($filters['severity']) && isset(self::SEVERITIES[$filters['severity']])) {
            $query->where('i.severity', $filters['severity']);
        }

        return CursorPage::respond($request, $query, ['generated_at' => 'i.generated_at', 'severity' => DB::raw("case i.severity when 'alta' then 3 when 'media' then 2 else 1 end")], '-severity,-generated_at', fn (object $row): array => $this->row($row), [
            'kpis' => $kpis,
            'kinds' => collect(self::KINDS)->reject(fn (string $label, string $kind) => ! $this->seesCosts($viewer) && in_array($kind, self::COST_KINDS, true))->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'statuses' => collect(self::STATUSES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
        ]);
    }

    public function resolve(string $id, string $status, User $viewer): array
    {
        $this->gate->require(self::RULE);

        return DB::transaction(function () use ($id, $status, $viewer): array {
            $insight = Str::isUuid($id) ? $this->visible($viewer)->where('i.id', $id)->lockForUpdate()->first() : null;

            if ($insight === null) {
                throw ApiException::notFound('La alerta no existe.');
            }

            if (! in_array($insight->status, ['nueva', 'vista'], true)) {
                throw ApiException::conflict('INSIGHT_CLOSED', 'La alerta ya está '.mb_strtolower(self::STATUSES[$insight->status]).'.');
            }

            DB::table('report_ai_insights')->where('id', $insight->id)->update(['status' => $status, 'resolved_at' => in_array($status, ['resuelta', 'descartada'], true) ? now() : null]);
            $this->audit->log('Alerta IA', (string) $insight->id, $status === 'vista' ? 'ver' : ($status === 'resuelta' ? 'resolver' : 'descartar'), $insight->status, $status.' · '.$insight->title, actor: $viewer);

            return $this->row($this->visible($viewer)->where('i.id', $insight->id)->first());
        });
    }

    public function generate(): int
    {
        $today = Carbon::now($this->context->timezone())->toDateString();

        return $this->overdueReceivables($today) + $this->lowMargins() + $this->expensiveSuppliers($today) + $this->targetsAtRisk($today) + $this->highDemand($today);
    }

    private function overdueReceivables(string $today): int
    {
        $created = 0;
        $receivables = DB::table('fin_receivables as f')->join('crm_clients as c', 'c.id', '=', 'f.client_id')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')
            ->whereNull('f.deleted_at')->where('f.status', 'vencida')->whereColumn('f.paid_amount', '<', 'f.amount')
            ->orderBy('f.due_date')->limit(50)->get(['f.id', 'f.code', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'c.name as client', 'r.code as reservation']);

        foreach ($receivables as $row) {
            $balance = Decimal::round2(BigDecimal::of((string) $row->amount)->minus((string) $row->paid_amount));
            $days = (int) Carbon::parse((string) $row->due_date)->diffInDays(Carbon::parse($today));
            $created += $this->store('cobranza_atrasada', $days > 15 || $balance->isGreaterThan('3000') ? 'alta' : 'media', 'Cobranza atrasada en '.$row->code,
                $row->client.' debe '.Decimal::display($balance, (string) $row->currency).' de la reserva '.$row->reservation.' desde el '.Carbon::parse((string) $row->due_date)->format('d/m/Y').' ('.$days.' '.($days === 1 ? 'día' : 'días').'). Acción sugerida: enviar un link de pago o llamar al cliente.',
                'fin_receivable', (string) $row->id, ['code' => $row->code, 'reservation' => $row->reservation, 'balance' => (string) $balance, 'currency' => $row->currency, 'days_overdue' => $days, 'action' => 'link_de_pago']);
        }

        return $created;
    }

    private function lowMargins(): int
    {
        $created = 0;
        $floor = (string) Decimal::round2($this->approval->limits()['margin_floor']);
        $quotes = DB::table('quote_quotes as q')->join('quote_versions as v', 'v.id', '=', 'q.current_version_id')->join('crm_clients as c', 'c.id', '=', 'q.client_id')
            ->whereNull('q.deleted_at')->whereIn('q.status', ['borrador', 'enviada', 'vista', 'negociacion'])->whereNotNull('v.margin_pct')->where('v.margin_pct', '<', $floor)
            ->orderBy('v.margin_pct')->limit(30)->get(['q.id', 'q.code', 'q.owner_id', 'v.margin_pct', 'v.grand_total', 'v.currency', 'c.name as client']);

        foreach ($quotes as $row) {
            $margin = (string) Decimal::round2((string) $row->margin_pct);
            $created += $this->store('margen_bajo', BigDecimal::of($margin)->isLessThan(self::MARGIN_CRITICAL) ? 'alta' : 'media', 'Margen bajo en '.$row->code,
                'La cotización para '.$row->client.' deja '.$margin.' % de margen, por debajo del margen mínimo de '.$floor.' % que fijaste en Configuración. Acción sugerida: revisar proveedores o ajustar el markup antes de enviarla.',
                'quote_quote', (string) $row->id, ['code' => $row->code, 'margin_pct' => $margin, 'floor_pct' => $floor, 'total' => (string) $row->grand_total, 'currency' => $row->currency, 'action' => 'revisar_cotizacion']);
        }

        return $created;
    }

    private function expensiveSuppliers(string $today): int
    {
        $services = DB::table('catalog_services as s')->join('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->whereNull('s.deleted_at')->whereNull('p.deleted_at')->where('s.status', 'activo')->where('p.status', 'activo')->where('s.valid_to', '>=', $today)->whereNotNull('p.city')
            ->get(['s.id', 's.ref', 's.name', 's.type', 's.unit', 's.cost', 's.currency', 'p.id as provider_id', 'p.name as provider', 'p.city', 'p.stars']);
        $found = collect();

        foreach ($services->groupBy(fn (object $row): string => implode('|', [$row->type, $row->unit, trim((string) $row->currency), mb_strtolower(trim((string) $row->city)), (string) $row->stars])) as $group) {
            foreach ($group as $row) {
                $cheapest = $group->where('provider_id', '<>', $row->provider_id)->filter(fn (object $other): bool => BigDecimal::of((string) $other->cost)->isPositive())->sortBy(fn (object $other): float => (float) $other->cost)->first();

                if ($cheapest === null) {
                    continue;
                }

                $gap = BigDecimal::of((string) $row->cost)->minus((string) $cheapest->cost)->multipliedBy(100)->dividedBy((string) $cheapest->cost, 1, RoundingMode::HALF_UP);

                if ($gap->isGreaterThan(self::EXPENSIVE_GAP_PCT)) {
                    $found->push(['row' => $row, 'cheapest' => $cheapest, 'gap' => $gap]);
                }
            }
        }

        $created = 0;

        foreach ($found->sortByDesc(fn (array $item): float => $item['gap']->toFloat())->take(30) as ['row' => $row, 'cheapest' => $cheapest, 'gap' => $gap]) {
            $currency = trim((string) $row->currency);
            $created += $this->store('proveedor_caro', $gap->isGreaterThan(self::EXPENSIVE_CRITICAL_PCT) ? 'alta' : 'media', 'Proveedor caro: '.$row->name,
                $row->provider.' cobra '.Decimal::display((string) $row->cost, $currency).' por '.$row->unit.', '.$gap.' % más que '.$cheapest->provider.' ('.Decimal::display((string) $cheapest->cost, $currency).') por un servicio de '.mb_strtolower((string) $row->type).' en '.$row->city.'. Acción sugerida: negociar la tarifa o usar el otro proveedor en los productos.',
                'catalog_service', (string) $row->id, ['code' => $row->ref, 'provider' => $row->provider, 'cost' => (string) $row->cost, 'currency' => $currency, 'unit' => $row->unit, 'alternative' => $cheapest->ref, 'alternative_provider' => $cheapest->provider, 'alternative_cost' => (string) $cheapest->cost, 'gap_pct' => (string) $gap, 'threshold_pct' => self::EXPENSIVE_GAP_PCT, 'action' => 'revisar_proveedor']);
        }

        return $created;
    }

    private function targetsAtRisk(string $today): int
    {
        $created = 0;
        $date = Carbon::parse($today, $this->context->timezone());
        $targets = DB::table('crm_sales_targets')->where('status', 'vigente')->where('period_from', '<=', $today)->where('period_to', '>=', $today)->orderBy('period_to')->get();

        foreach ($targets as $row) {
            $standing = $this->targets->standing($row, $date);
            $severity = self::TARGET_SEVERITY[$standing['health']] ?? null;

            if ($severity === null) {
                continue;
            }

            $created += $this->store('meta_en_riesgo', $severity, 'Meta en riesgo: '.$standing['scope'].' · '.$standing['period'],
                'Lleva '.Decimal::display((string) $standing['sales'], 'PEN').' de '.Decimal::display((string) $standing['goal'], 'PEN').' ('.$standing['progress_pct'].' %). Con las oportunidades que cierran en el periodo proyecta el '.$standing['projection_pct'].' % y '.($standing['days_left'] === 1 ? 'queda 1 día' : 'quedan '.$standing['days_left'].' días').'. Acción sugerida: revisar el pipeline con el equipo y priorizar las oportunidades más probables.',
                'crm_sales_target', (string) $row->id, ['code' => $row->code, 'scope' => $standing['scope'], 'period' => $standing['period'], 'sales' => (string) $standing['sales'], 'goal' => (string) $standing['goal'], 'progress_pct' => $standing['progress_pct'], 'projection_pct' => $standing['projection_pct'], 'health' => $standing['health'], 'action' => 'revisar_meta']);
        }

        return $created;
    }

    private function highDemand(string $today): int
    {
        $created = 0;
        $until = Carbon::parse($today)->addDays(self::DEMAND_HORIZON_DAYS)->toDateString();
        $departures = DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')->whereNull('p.deleted_at')
            ->whereIn('d.status', ['abierta', 'completa'])->whereBetween('d.departure_date', [$today, $until])->whereRaw('d.sold * 100 >= d.capacity * ?', [self::DEMAND_OCCUPANCY_PCT])
            ->orderBy('d.departure_date')->limit(30)->get(['d.id', 'd.departure_date', 'd.capacity', 'd.sold', 'p.code', 'p.name']);

        foreach ($departures as $row) {
            $pct = (int) floor((int) $row->sold * 100 / max(1, (int) $row->capacity));
            $created += $this->store('demanda_alta', (int) $row->sold >= (int) $row->capacity ? 'alta' : 'media', 'Demanda alta: '.$row->name.' del '.Carbon::parse((string) $row->departure_date)->format('d/m/Y'),
                'La salida tiene '.$row->sold.' de '.$row->capacity.' cupos vendidos ('.$pct.' %). Acción sugerida: abrir otra salida o pedir más cupos al proveedor.',
                'catalog_departure', (string) $row->id, ['code' => $row->code, 'date' => $row->departure_date, 'sold' => (int) $row->sold, 'capacity' => (int) $row->capacity, 'occupancy_pct' => $pct, 'threshold_pct' => self::DEMAND_OCCUPANCY_PCT, 'action' => 'abrir_salida']);
        }

        $quoted = DB::table('quote_items as i')->join('quote_versions as v', 'v.id', '=', 'i.quote_version_id')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->join('catalog_products as p', 'p.id', '=', 'i.product_id')
            ->whereNull('q.deleted_at')->whereNull('p.deleted_at')->where('q.created_at', '>=', Carbon::parse($today, $this->context->timezone())->subDays(self::DEMAND_WINDOW_DAYS - 1)->startOfDay()->utc())
            ->groupBy('p.id', 'p.code', 'p.name')->havingRaw('count(distinct q.id) >= ?', [self::DEMAND_QUOTES])
            ->selectRaw('p.id, p.code, p.name, count(distinct q.id) as quotes')->orderByDesc('quotes')->limit(20)->get();

        foreach ($quoted as $row) {
            $created += $this->store('demanda_alta', 'media', 'Demanda alta: '.$row->name,
                'Se cotizó en '.$row->quotes.' propuestas en los últimos '.self::DEMAND_WINDOW_DAYS.' días. Acción sugerida: revisar cupos y salidas antes de que se agoten, o ajustar el precio.',
                'catalog_product', (string) $row->id, ['code' => $row->code, 'quotes' => (int) $row->quotes, 'window_days' => self::DEMAND_WINDOW_DAYS, 'threshold' => self::DEMAND_QUOTES, 'action' => 'revisar_producto']);
        }

        return $created;
    }

    private function store(string $kind, string $severity, string $title, string $detail, string $sourceType, string $sourceId, array $metric): int
    {
        $exists = DB::table('report_ai_insights')->where('kind', $kind)->where('source_id', $sourceId)
            ->where(fn (Builder $scope) => $scope->whereIn('status', ['nueva', 'vista'])->orWhere('resolved_at', '>', now()->subDays(30)))->exists();

        if ($exists) {
            return 0;
        }

        DB::table('report_ai_insights')->insert([
            'tenant_id' => $this->context->idOrFail(),
            'kind' => $kind,
            'severity' => $severity,
            'title' => mb_substr($title, 0, 160),
            'detail' => $detail,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'metric' => json_encode($metric, JSON_UNESCAPED_UNICODE),
            'status' => 'nueva',
            'generated_at' => now(),
        ]);

        return 1;
    }

    private function visible(User $viewer): Builder
    {
        return DB::table('report_ai_insights as i')
            ->where(fn (Builder $scope) => $scope->whereNull('i.audience_user_id')->orWhere('i.audience_user_id', $viewer->getKey()))
            ->when(! $this->seesCosts($viewer), fn (Builder $scope) => $scope->whereNotIn('i.kind', self::COST_KINDS))
            ->select(['i.id', 'i.kind', 'i.severity', 'i.title', 'i.detail', 'i.source_type', 'i.source_id', 'i.metric', 'i.status', 'i.generated_at', 'i.resolved_at']);
    }

    private function seesCosts(User $viewer): bool
    {
        return $viewer->can('finance.profitability') || $viewer->can('catalog.products.view_profitability');
    }

    private function kpis(Builder $query): array
    {
        $rows = $query->reorder()->select(['i.status', 'i.kind', 'i.severity', DB::raw('count(*) as total')])->groupBy('i.status', 'i.kind', 'i.severity')->get();
        $open = $rows->whereIn('status', ['nueva', 'vista']);

        return [
            'open' => (int) $open->sum('total'),
            'new' => (int) $rows->where('status', 'nueva')->sum('total'),
            'high' => (int) $open->where('severity', 'alta')->sum('total'),
            'resolved' => (int) $rows->where('status', 'resuelta')->sum('total'),
            'by_kind' => collect(self::KINDS)->map(fn (string $label, string $kind) => (int) $open->where('kind', $kind)->sum('total'))->all(),
        ];
    }

    private function row(object $row): array
    {
        $metric = (array) json_decode((string) $row->metric, true);

        return [
            'id' => $row->id,
            'kind' => $row->kind,
            'kind_label' => self::KINDS[$row->kind] ?? $row->kind,
            'severity' => $row->severity,
            'severity_label' => self::SEVERITIES[$row->severity] ?? $row->severity,
            'title' => $row->title,
            'detail' => $row->detail,
            'source' => ['type' => $row->source_type, 'code' => $metric['code'] ?? null],
            'metric' => $metric,
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'generated_at' => Carbon::parse((string) $row->generated_at)->toIso8601String(),
            'resolved_at' => $row->resolved_at ? Carbon::parse((string) $row->resolved_at)->toIso8601String() : null,
        ];
    }
}
