<?php

declare(strict_types=1);

namespace App\Domain\Reports\Actions;

use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
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

    private const MARGIN_FLOOR = '12';

    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
        private readonly GrowthFeatureGate $gate,
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
        $created = 0;
        $today = Carbon::now($this->context->timezone())->toDateString();
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

        $quotes = DB::table('quote_quotes as q')->join('quote_versions as v', 'v.id', '=', 'q.current_version_id')->join('crm_clients as c', 'c.id', '=', 'q.client_id')
            ->whereNull('q.deleted_at')->whereIn('q.status', ['borrador', 'enviada', 'vista', 'negociacion'])->whereNotNull('v.margin_pct')->where('v.margin_pct', '<', self::MARGIN_FLOOR)
            ->orderBy('v.margin_pct')->limit(30)->get(['q.id', 'q.code', 'q.owner_id', 'v.margin_pct', 'v.grand_total', 'v.currency', 'c.name as client']);

        foreach ($quotes as $row) {
            $margin = (string) Decimal::round2((string) $row->margin_pct);
            $created += $this->store('margen_bajo', BigDecimal::of($margin)->isLessThan('5') ? 'alta' : 'media', 'Margen bajo en '.$row->code,
                'La cotización para '.$row->client.' deja '.$margin.' % de margen, por debajo del piso de '.self::MARGIN_FLOOR.' %. Acción sugerida: revisar proveedores o ajustar el markup antes de enviarla.',
                'quote_quote', (string) $row->id, ['code' => $row->code, 'margin_pct' => $margin, 'floor_pct' => self::MARGIN_FLOOR, 'total' => (string) $row->grand_total, 'currency' => $row->currency, 'action' => 'revisar_cotizacion']);
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
