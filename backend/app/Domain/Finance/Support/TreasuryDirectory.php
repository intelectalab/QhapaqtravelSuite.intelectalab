<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Finance\Actions\TreasuryMovementWorkflow;
use App\Domain\Finance\Actions\TreasuryOperations;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class TreasuryDirectory
{
    public const KINDS = ['bank' => 'Banco', 'petty_cash' => 'Caja chica', 'gateway' => 'Pasarela'];

    public const TYPES = [
        'collection' => 'Cobro', 'collection_reversal' => 'Reversión de cobro', 'supplier_payment' => 'Pago a proveedor', 'transfer' => 'Transferencia',
        'petty_expense' => 'Gasto de caja', 'replenishment' => 'Reposición de caja', 'gateway_settlement' => 'Liquidación de pasarela', 'gateway_fee' => 'Comisión de pasarela',
        'count_adjustment' => 'Ajuste de arqueo', 'other_income' => 'Otro ingreso', 'other_expense' => 'Otro egreso',
    ];

    public const CATEGORIES = [
        'in' => ['Intereses bancarios', 'Devolución de proveedor', 'Aporte de capital', 'Préstamo recibido', 'Otros ingresos'],
        'out' => ['Alquileres', 'Planilla', 'Tributos (SUNAT)', 'Servicios TI y licencias', 'Servicios básicos', 'Gastos bancarios / ITF', 'Publicidad', 'Mantenimiento', 'Otros egresos'],
    ];

    public const EXPENSE_CATEGORIES = ['Movilidad local', 'Útiles de oficina', 'Alimentación de grupo / conductores', 'Botiquín y oxígeno', 'Combustible y estacionamiento', 'Courier y envíos', 'Impresiones y fotocopias', 'Trámites notariales', 'Atenciones a clientes', 'Propinas y servicios menores', 'Otros'];

    public const RECEIPTS = ['invoice' => 'Factura', 'sales_receipt' => 'Boleta', 'ticket' => 'Ticket', 'fee_receipt' => 'Recibo por honorarios', 'mobility_sheet' => 'Planilla de movilidad', 'sworn_statement' => 'Declaración jurada'];

    private const COUNT_STATUS = ['signed' => 'Firmado', 'pending_approval' => 'Por aprobar', 'approved' => 'Aprobado', 'validated' => 'Validado'];

    private const COUNT_RESULT = ['balanced' => 'Cuadrado', 'over' => 'Sobrante', 'short' => 'Faltante'];

    private const REPLENISHMENT = ['requested' => 'Solicitada', 'approved' => 'Aprobada', 'paid' => 'Pagada', 'rejected' => 'Rechazada'];

    public function __construct(private readonly Consolidation $money, private readonly TenantContext $context) {}

    public function accounts(): Collection
    {
        $flows = DB::table('fin_treasury_movements')->where('status', 'posted')->groupBy('account_id')
            ->selectRaw("account_id, sum(case when direction = 'in' then amount else 0 end) as inflow, sum(case when direction = 'out' then amount else 0 end) as outflow")
            ->get()->keyBy('account_id');
        $today = $this->money->today();
        $sessions = DB::table('fin_cash_sessions')->where('session_date', $today)->get(['account_id', 'status'])->keyBy('account_id');

        return DB::table('fin_treasury_accounts as a')
            ->leftJoin('iam_sedes as s', 's.id', '=', 'a.sede_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'a.custodian_id')
            ->leftJoin('fin_treasury_accounts as t', 't.id', '=', 'a.settle_to_account_id')
            ->whereNull('a.deleted_at')
            ->orderBy('a.code')
            ->get(['a.id', 'a.code', 'a.kind', 'a.bank', 'a.name', 'a.account_number', 'a.cci', 'a.currency', 'a.fund_amount', 'a.opening_balance', 'a.status', 'a.sede_id', 'a.custodian_id', 's.name as sede', 'u.name as custodian', 't.code as settle_to'])
            ->map(function (object $row) use ($flows, $sessions): array {
                $flow = $flows->get($row->id);
                $balance = round((float) $row->opening_balance + (float) ($flow->inflow ?? 0) - (float) ($flow->outflow ?? 0), 2);
                $session = $sessions->get($row->id);

                return [
                    'code' => $row->code,
                    'kind' => $row->kind,
                    'kind_label' => self::KINDS[$row->kind],
                    'bank' => $row->bank,
                    'name' => $row->name,
                    'number' => $row->account_number,
                    'cci' => $row->cci,
                    'currency' => $row->currency,
                    'balance' => $balance,
                    'balance_pen' => $this->money->pen($balance, $row->currency),
                    'fund' => $row->fund_amount !== null ? (float) $row->fund_amount : null,
                    'sede' => $row->sede,
                    'sede_id' => $row->sede_id,
                    'custodian' => $row->custodian,
                    'custodian_id' => $row->custodian_id,
                    'settle_to' => $row->settle_to,
                    'active' => $row->status === 'active',
                    'session_today' => $row->kind === 'petty_cash' ? ($session === null ? 'none' : ($session->status === 'open' ? 'open' : 'closed')) : null,
                ];
            })->values();
    }

    public function overview(User $viewer): array
    {
        $accounts = $this->accounts();

        $movements = $this->movementQuery()
            ->orderByDesc('m.movement_date')
            ->orderByDesc('m.code')
            ->limit(500)
            ->get()
            ->map(fn (object $row): array => $this->movement($row))
            ->values();
        $audit = DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')->where('e.entity', 'Movimiento de tesorería')->whereIn('e.entity_id', $movements->pluck('code')->all())
            ->orderByDesc('e.occurred_at')->get(['e.id', 'e.entity_id', 'e.action', 'e.before_value', 'e.after_value', 'e.occurred_at', 'u.name as actor']);
        $trail = [];

        foreach ($audit as $event) {
            $trail[(string) $event->entity_id][] = ['code' => (string) $event->id, 'action' => $event->action, 'before' => $event->before_value, 'after' => $event->after_value, 'actor' => $event->actor, 'ip' => null, 'at' => $event->occurred_at];
        }

        $movements = $movements->map(fn (array $row): array => [...$row, 'audit' => $trail[$row['code']] ?? []]);

        $monthStart = $this->money->monthStart();
        $posted = $movements->where('status', 'posted')->where('date', '>=', $monthStart)->whereNotIn('type', ['transfer', 'replenishment', 'gateway_settlement']);

        return [
            'accounts' => $accounts,
            'movements' => $movements,
            'sessions' => $this->sessions(),
            'replenishments' => DB::table('fin_cash_replenishments as r')->join('fin_treasury_accounts as a', 'a.id', '=', 'r.account_id')->leftJoin('iam_users as u', 'u.id', '=', 'r.requested_by')
                ->orderByDesc('r.requested_at')->get(['r.code', 'r.amount', 'r.status', 'r.requested_at', 'r.requested_by as requested_by_id', 'r.note', 'r.reject_reason', 'a.code as account_code', 'a.name as account', 'u.name as requested_by'])
                ->map(fn (object $row): array => ['code' => $row->code, 'amount' => (float) $row->amount, 'status' => $row->status, 'status_label' => self::REPLENISHMENT[$row->status] ?? $row->status, 'requested_at' => $row->requested_at, 'note' => $row->note, 'reject_reason' => $row->reject_reason, 'account' => $row->account, 'account_code' => $row->account_code, 'requested_by' => $row->requested_by, 'requested_by_id' => $row->requested_by_id]),
            'counts' => $this->counts(),
            'alerts' => $this->alerts($accounts),
            'options' => [
                'sedes' => DB::table('iam_sedes')->orderBy('name')->get(['id as value', 'name as label']),
                'custodians' => DB::table('iam_users')->whereNull('deleted_at')->where('status', 'activo')->whereNull('client_id')->whereNull('agency_id')->whereNull('provider_id')->orderBy('name')->get(['id as value', 'name as label']),
                'denominations' => TreasuryOperations::DENOMINATIONS,
                'gateway_fee_pct' => DB::table('fin_treasury_settings')->value('gateway_fee_pct'),
                'max_petty_expense' => DB::table('fin_treasury_settings')->value('max_petty_expense'),
                'threshold_pct' => (int) (DB::table('fin_treasury_settings')->value('replenish_threshold_pct') ?? 40),
                'petty_tolerance' => (string) (DB::table('fin_treasury_settings')->value('petty_tolerance') ?? '0'),
                'expense_categories' => self::EXPENSE_CATEGORIES,
                'reservations' => DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['borrador', 'cancelada'])->orderByDesc('code')->limit(300)->get(['code as value', DB::raw("code || ' · ' || title as label")]),
            ],
            'viewer_id' => $viewer->getKey(),
            'kpis' => [
                'bank_pen' => round($accounts->where('kind', 'bank')->sum('balance_pen'), 2),
                'cash_pen' => round($accounts->where('kind', 'petty_cash')->sum('balance_pen'), 2),
                'gateway_pen' => round($accounts->where('kind', 'gateway')->sum('balance_pen'), 2),
                'total_pen' => round($accounts->sum('balance_pen'), 2),
                'in_month_pen' => round($posted->where('direction', 'in')->sum('pen'), 2),
                'out_month_pen' => round($posted->where('direction', 'out')->sum('pen'), 2),
                'open_sessions' => DB::table('fin_cash_sessions')->where('status', 'open')->count(),
                'projected_30_pen' => $this->projection()['horizons'][0]['closing'] ?? null,
            ],
            'composition' => [
                ['label' => 'Bancos en soles', 'pen' => round($accounts->where('kind', 'bank')->where('currency', 'PEN')->sum('balance_pen'), 2)],
                ['label' => 'Bancos en dólares', 'pen' => round($accounts->where('kind', 'bank')->where('currency', 'USD')->sum('balance_pen'), 2)],
                ['label' => 'Cajas chicas', 'pen' => round($accounts->where('kind', 'petty_cash')->sum('balance_pen'), 2)],
                ['label' => 'Pasarelas en tránsito', 'pen' => round($accounts->where('kind', 'gateway')->sum('balance_pen'), 2)],
            ],
            'balance_history' => $this->balanceHistory($accounts),
            'categories' => self::CATEGORIES,
            'usd_rate' => $this->money->usdRate(),
            'today' => $this->money->today(),
            'can' => ['manage' => $viewer->can('finance.treasury'), 'settings' => $viewer->can('admin.settings.manage'), 'revalue' => $viewer->can('finance.invoicing')],
        ];
    }

    public function movementQuery(array $filters = []): Builder
    {
        return DB::table('fin_treasury_movements as m')
            ->join('fin_treasury_accounts as a', 'a.id', '=', 'm.account_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'm.created_by')
            ->leftJoin('iam_users as v', 'v.id', '=', 'm.voided_by')
            ->leftJoin('fin_payments as p', fn ($join) => $join->on('p.id', '=', 'm.source_id')->whereIn('m.source_type', ['payment', 'payment_reversal']))
            ->leftJoin('fin_payable_payouts as o', fn ($join) => $join->on('o.id', '=', 'm.source_id')->where('m.source_type', 'payout'))
            ->leftJoin('fin_payables as q', fn ($join) => $join->on('q.id', '=', DB::raw('coalesce(o.payable_id, case when m.source_type = \'payable\' then m.source_id end)')))
            ->leftJoin('fin_treasury_transfers as t', 't.id', '=', 'm.transfer_id')
            ->leftJoin('fin_cash_counts as k', fn ($join) => $join->on('k.id', '=', 'm.source_id')->where('m.source_type', 'cash_count'))
            ->leftJoin('fin_cash_replenishments as r', 'r.id', '=', 'm.replenishment_id')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'm.reservation_id')
            ->leftJoin('fin_expense_receipts as e', 'e.movement_id', '=', 'm.id')
            ->when($filters['account'] ?? null, fn (Builder $query, string $account) => $query->where('a.code', $account))
            ->when($filters['type'] ?? null, fn (Builder $query, string $type) => $query->where('m.type', $type))
            ->when($filters['direction'] ?? null, fn (Builder $query, string $direction) => $query->where('m.direction', $direction))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('m.status', $status))
            ->when($filters['from'] ?? null, fn (Builder $query, string $from) => $query->where('m.movement_date', '>=', $from))
            ->when($filters['to'] ?? null, fn (Builder $query, string $to) => $query->where('m.movement_date', '<=', $to))
            ->select(['m.code', 'm.movement_date', 'm.direction', 'm.type', 'm.amount', 'm.currency', 'm.fx_rate', 'm.source_type', 'm.category', 'm.description', 'm.reference', 'm.counterparty', 'm.status', 'm.void_reason', 'm.voided_at', 'm.created_at', 'a.code as account_code', 'a.name as account_name', 'u.name as user_name', 'v.name as voided_name',
                'p.code as payment_code', 'q.code as payable_code', 't.code as transfer_code', 'k.code as count_code', 'r.code as replenishment_code', 'b.code as reservation_code',
                'e.receipt_type', 'e.series_number', 'e.issuer_ruc', 'e.supplier_name', 'e.file_path']);
    }

    public function movement(object $row): array
    {
        return [
            'code' => $row->code,
            'date' => $row->movement_date,
            'direction' => trim((string) $row->direction),
            'type' => $row->type,
            'type_label' => self::TYPES[$row->type] ?? $row->type,
            'amount' => (float) $row->amount,
            'currency' => $row->currency,
            'fx_rate' => $row->fx_rate !== null ? (float) $row->fx_rate : null,
            'pen' => $this->money->pen($row->amount, $row->currency, $row->fx_rate),
            'manual' => $row->source_type === 'manual',
            'voidable' => TreasuryMovementWorkflow::voidable((object) ['source_type' => $row->source_type, 'type' => $row->type, 'replenishment_id' => $row->replenishment_code, 'transfer_id' => $row->transfer_code]),
            'category' => $row->category,
            'description' => $row->description,
            'reference' => $row->reference,
            'counterparty' => $row->counterparty,
            'status' => $row->status,
            'void_reason' => $row->void_reason,
            'voided' => $row->voided_at ? ['at' => $row->voided_at, 'by' => $row->voided_name] : null,
            'created_at' => $row->created_at,
            'origin' => $this->origin($row),
            'reservation' => $row->reservation_code,
            'receipt' => $row->receipt_type ? ['type' => self::RECEIPTS[$row->receipt_type] ?? $row->receipt_type, 'number' => $row->series_number, 'ruc' => $row->issuer_ruc, 'supplier' => $row->supplier_name, 'file' => $row->file_path !== null] : null,
            'account' => ['code' => $row->account_code, 'name' => $row->account_name],
            'user' => $row->user_name ?? 'Sistema',
        ];
    }

    public function ledger(string $code): ?array
    {
        $account = DB::table('fin_treasury_accounts as a')->leftJoin('iam_sedes as s', 's.id', '=', 'a.sede_id')->leftJoin('iam_users as u', 'u.id', '=', 'a.custodian_id')
            ->leftJoin('fin_treasury_accounts as t', 't.id', '=', 'a.settle_to_account_id')
            ->where('a.code', $code)->whereNull('a.deleted_at')
            ->first(['a.*', 's.name as sede', 'u.name as custodian', 't.code as settle_code', 't.name as settle_name']);

        if ($account === null) {
            return null;
        }

        $running = Decimal::of($account->opening_balance);
        $rows = $this->movementQuery()->where('m.account_id', $account->id)->orderBy('m.movement_date')->orderBy('m.code')->get()
            ->map(function (object $row) use (&$running): array {
                if ($row->status === 'posted') {
                    $running = trim($row->direction) === 'in' ? $running->plus((string) $row->amount) : $running->minus((string) $row->amount);
                }

                return [...$this->movement($row), 'amount' => (string) $row->amount, 'balance' => (string) $running->toScale(2)];
            });
        $month = $this->money->monthStart();
        $posted = $rows->where('status', 'posted')->where('date', '>=', $month);

        return [
            'code' => $account->code, 'kind' => $account->kind, 'kind_label' => self::KINDS[$account->kind], 'name' => $account->name, 'bank' => $account->bank,
            'number' => $account->account_number, 'cci' => $account->cci, 'currency' => $account->currency, 'sede' => $account->sede, 'custodian' => $account->custodian,
            'fund' => $account->fund_amount, 'settle_to' => $account->settle_code ? ['code' => $account->settle_code, 'name' => $account->settle_name] : null,
            'opening_balance' => (string) $account->opening_balance, 'opening_date' => $account->opening_date, 'active' => $account->status === 'active',
            'balance' => (string) $running->toScale(2),
            'balance_pen' => $this->money->pen((string) $running->toScale(2), $account->currency),
            'usd_rate' => $account->currency === 'USD' ? $this->money->usdRate() : null,
            'categories' => self::CATEGORIES,
            'month_in' => (string) $posted->where('direction', 'in')->reduce(fn (BigDecimal $sum, array $row) => $sum->plus($row['amount']), BigDecimal::zero()),
            'month_out' => (string) $posted->where('direction', 'out')->reduce(fn (BigDecimal $sum, array $row) => $sum->plus($row['amount']), BigDecimal::zero()),
            'open_session' => DB::table('fin_cash_sessions')->where('account_id', $account->id)->where('status', 'open')->first(['code', 'opened_at', 'opening_amount']),
            'movements' => $rows->reverse()->values(),
        ];
    }

    public function cashFlow(bool $overdue = true, bool $fixed = true): array
    {
        $today = Carbon::parse($this->money->today());
        $todayText = $today->toDateString();
        $end = $today->copy()->addDays(90)->toDateString();
        $balance = $this->accounts()->where('active', true)->sum('balance_pen');
        $settings = DB::table('fin_treasury_settings')->first(['recurring_outflows']);
        $recurring = json_decode((string) ($settings->recurring_outflows ?? '[]'), true) ?: [];
        $receivables = DB::table('fin_receivables as r')->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')->whereNotIn('r.status', ['pagada', 'cancelada'])
            ->get(['r.code', 'r.concept', 'r.amount', 'r.paid_amount', 'r.currency', 'r.fx_rate', 'r.due_date', 'c.name as party']);
        $payables = DB::table('fin_payables as p')->leftJoin('catalog_providers as v', 'v.id', '=', 'p.provider_id')->whereNull('p.deleted_at')->whereNotIn('p.status', ['pagada', 'anulada', 'cancelada'])
            ->get(['p.code', 'p.concept', 'p.amount', 'p.paid_amount', 'p.currency', 'p.fx_rate', 'p.due_date', 'p.scheduled_date', 'v.name as party']);
        $commissions = DB::table('fin_commissions as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.beneficiary_user_id')->leftJoin('channel_b2b_agencies as g', 'g.id', '=', 'm.beneficiary_agency_id')
            ->whereNull('m.deleted_at')->where('m.status', 'aprobada')->get(['m.code', 'm.kind', 'm.amount', 'm.currency', 'm.fx_rate', 'u.name as user_name', 'g.legal_name as agency_name']);
        $items = collect();

        foreach ($receivables as $row) {
            $late = (string) $row->due_date < $todayText;

            if ($late && ! $overdue) {
                continue;
            }

            $left = (float) $row->amount - (float) $row->paid_amount;
            $items->push(['kind' => 'in', 'type' => 'cxc', 'source' => 'Cuota por cobrar', 'code' => $row->code, 'href' => "/finanzas/cobros/{$row->code}", 'concept' => $row->concept, 'party' => $row->party, 'date' => $late ? $todayText : (string) $row->due_date, 'due' => (string) $row->due_date, 'overdue' => $late, 'amount' => round($left, 2), 'currency' => $row->currency, 'pen' => round($left * (float) ($row->fx_rate ?: 1), 2)]);
        }

        foreach ($payables as $row) {
            $due = (string) ($row->scheduled_date ?? $row->due_date);
            $left = (float) $row->amount - (float) $row->paid_amount;
            $items->push(['kind' => 'out', 'type' => 'cxp', 'source' => $row->scheduled_date ? 'Pago programado' : 'Cuenta por pagar', 'code' => $row->code, 'href' => "/finanzas/proveedores/{$row->code}", 'concept' => $row->concept, 'party' => $row->party, 'date' => max($due, $todayText), 'due' => (string) $row->due_date, 'overdue' => (string) $row->due_date < $todayText, 'amount' => round($left, 2), 'currency' => $row->currency, 'pen' => round($left * (float) ($row->fx_rate ?: 1), 2)]);
        }

        $monthEnd = $today->copy()->endOfMonth()->toDateString();

        foreach ($commissions as $row) {
            $items->push(['kind' => 'out', 'type' => 'commission', 'source' => 'Comisión aprobada', 'code' => $row->code, 'href' => "/finanzas/comisiones/{$row->code}", 'concept' => match ($row->kind) {
                'agencia_b2b' => 'Comisión de agencia B2B',
                'vendedor' => 'Comisión de asesor',
                default => (string) $row->kind,
            }, 'party' => $row->user_name ?? $row->agency_name, 'date' => $monthEnd, 'due' => $monthEnd, 'overdue' => false, 'amount' => round((float) $row->amount, 2), 'currency' => $row->currency, 'pen' => round((float) $row->amount * (float) ($row->fx_rate ?: 1), 2)]);
        }

        for ($month = 0; $fixed && $month < 4; $month++) {
            foreach ($recurring as $outflow) {
                $date = $today->copy()->startOfMonth()->addMonths($month)->day(min((int) $outflow['day'], 28))->toDateString();
                if ($date > $todayText && $date <= $end) {
                    $items->push(['kind' => 'out', 'type' => 'fixed', 'source' => 'Egreso fijo', 'code' => null, 'href' => null, 'concept' => $outflow['concept'], 'party' => 'Estimado', 'date' => $date, 'due' => $date, 'overdue' => false, 'amount' => round((float) $outflow['amount'], 2), 'currency' => 'PEN', 'pen' => round((float) $outflow['amount'], 2)]);
                }
            }
        }

        $items = $items->filter(fn (array $item) => $item['date'] <= $end && $item['pen'] > 0)->sortBy('date')->values();
        $signed = fn (Collection $slice, string $type): float => round($slice->where('type', $type)->sum(fn (array $item) => $item['kind'] === 'in' ? $item['pen'] : -$item['pen']), 2);
        $running = round($balance, 2);
        $horizons = collect([[0, 30], [31, 60], [61, 90]])->map(function (array $range) use ($items, $today, $signed, &$running): array {
            $from = $today->copy()->addDays($range[0])->toDateString();
            $to = $today->copy()->addDays($range[1])->toDateString();
            $slice = $items->filter(fn (array $item) => $item['date'] >= $from && $item['date'] <= $to);
            $in = round($slice->where('kind', 'in')->sum('pen'), 2);
            $out = round($slice->where('kind', 'out')->sum('pen'), 2);
            $opening = $running;
            $running = round($running + $in - $out, 2);

            return ['label' => "{$range[0]} a {$range[1]} días", 'days' => $range[1], 'opening' => $opening, 'in' => $in, 'out' => $out, 'net' => round($in - $out, 2), 'closing' => $running,
                'cxc' => $signed($slice, 'cxc'), 'cxp' => $signed($slice, 'cxp'), 'commissions' => $signed($slice, 'commission'), 'fixed' => $signed($slice, 'fixed')];
        });
        $weekly = round($balance, 2);
        $weeks = collect(range(0, 12))->map(function (int $week) use ($items, $today, &$weekly): array {
            $from = $today->copy()->addDays($week * 7)->toDateString();
            $to = $today->copy()->addDays($week * 7 + 6)->toDateString();
            $slice = $items->filter(fn (array $item) => $item['date'] >= $from && $item['date'] <= $to);
            $in = round($slice->where('kind', 'in')->sum('pen'), 2);
            $out = round($slice->where('kind', 'out')->sum('pen'), 2);
            $weekly = round($weekly + $in - $out, 2);

            return ['start' => $from, 'in' => $in, 'out' => $out, 'balance' => $weekly];
        });

        return [
            'opening_pen' => round($balance, 2), 'horizons' => $horizons->values(), 'weeks' => $weeks->values(), 'items' => $items->all(),
            'totals' => ['in' => round($items->where('kind', 'in')->sum('pen'), 2), 'out' => round($items->where('kind', 'out')->sum('pen'), 2)],
            'options' => ['include_overdue' => $overdue, 'include_fixed' => $fixed],
            'usd_rate' => $this->money->usdRate(),
            'risk' => $horizons->first(fn (array $horizon) => $horizon['closing'] < 0),
        ];
    }

    public static function snapshotKey(string $tenantId): string
    {
        return "treasury:cash-flow:{$tenantId}";
    }

    public function projection(): array
    {
        $cached = Cache::get(self::snapshotKey($this->context->idOrFail()));

        return is_array($cached) && str_starts_with((string) ($cached['taken_at'] ?? ''), $this->money->today()) ? $cached : $this->cashFlow();
    }

    private function balanceHistory(Collection $accounts): array
    {
        $today = Carbon::parse($this->money->today());
        $since = $today->copy()->subDays(27)->toDateString();
        $currency = $accounts->pluck('currency', 'code');
        $flows = DB::table('fin_treasury_movements as m')->join('fin_treasury_accounts as a', 'a.id', '=', 'm.account_id')->whereNull('a.deleted_at')->where('m.status', 'posted')->where('m.movement_date', '>', $since)
            ->groupBy('a.code', 'm.movement_date')->selectRaw("a.code, m.movement_date as day, sum(case when m.direction = 'in' then m.amount else -m.amount end) as net")->get();
        $current = (float) $accounts->sum('balance_pen');

        return collect(range(27, 0, -3))->map(function (int $back) use ($today, $flows, $currency, $current): array {
            $day = $today->copy()->subDays($back)->toDateString();
            $after = $flows->filter(fn (object $row): bool => (string) $row->day > $day)->sum(fn (object $row): float => $this->money->pen((float) $row->net, (string) ($currency[$row->code] ?? 'PEN')));

            return ['date' => $day, 'pen' => round($current - $after, 2)];
        })->values()->all();
    }

    public function counts(): array
    {
        return DB::table('fin_cash_counts as c')->join('fin_treasury_accounts as a', 'a.id', '=', 'c.account_id')->leftJoin('iam_users as s', 's.id', '=', 'c.signed_by')->leftJoin('iam_users as w', 'w.id', '=', 'c.witness_id')
            ->orderByDesc('c.counted_at')->limit(50)
            ->get(['c.code', 'c.kind', 'c.counted_at', 'c.counted_amount', 'c.expected_amount', 'c.difference', 'c.result', 'c.status', 'c.note', 'c.signed_by', 'a.code as account_code', 'a.name as account', 's.name as signed_name', 'w.name as witness'])
            ->map(fn (object $row): array => [
                'code' => $row->code, 'kind' => $row->kind, 'at' => $row->counted_at, 'counted' => (string) $row->counted_amount, 'expected' => (string) $row->expected_amount, 'difference' => (string) $row->difference,
                'result' => self::COUNT_RESULT[$row->result] ?? $row->result, 'status' => $row->status, 'status_label' => self::COUNT_STATUS[$row->status] ?? $row->status, 'note' => $row->note,
                'signed_by_id' => $row->signed_by, 'signed_by' => $row->signed_name, 'witness' => $row->witness, 'account' => ['code' => $row->account_code, 'name' => $row->account],
            ])->values()->all();
    }

    private function origin(object $row): ?array
    {
        return match (true) {
            $row->payment_code !== null => ['label' => $row->source_type === 'payment_reversal' ? 'Reversión de pago' : 'Pago de cliente', 'code' => $row->payment_code, 'href' => "/finanzas/pagos/{$row->payment_code}"],
            $row->payable_code !== null => ['label' => 'Cuenta por pagar', 'code' => $row->payable_code, 'href' => "/finanzas/proveedores/{$row->payable_code}"],
            $row->replenishment_code !== null => ['label' => 'Reposición de caja', 'code' => $row->replenishment_code, 'href' => null],
            $row->transfer_code !== null => ['label' => $row->type === 'gateway_settlement' ? 'Liquidación de pasarela' : 'Transferencia', 'code' => $row->transfer_code, 'href' => null],
            $row->count_code !== null => ['label' => 'Arqueo de caja', 'code' => $row->count_code, 'href' => "/finanzas/tesoreria/arqueos/{$row->count_code}/acta"],
            $row->source_type === 'expense' => ['label' => 'Gasto de caja chica', 'code' => null, 'href' => null],
            default => null,
        };
    }

    private function alerts(Collection $accounts): array
    {
        $threshold = (int) (DB::table('fin_treasury_settings')->value('replenish_threshold_pct') ?? 0);
        $openToday = DB::table('fin_cash_sessions as s')->join('fin_treasury_accounts as a', 'a.id', '=', 's.account_id')->where('s.status', 'open')->pluck('a.code')->all();
        $alerts = [];

        foreach ($accounts->where('active', true) as $account) {
            if ($account['kind'] === 'petty_cash' && ! in_array($account['code'], $openToday, true)) {
                $alerts[] = ['tone' => 'warn', 'text' => "{$account['name']}: sin sesión abierta hoy."];
            }
            if ($account['kind'] === 'petty_cash' && $account['fund'] && $account['balance'] < $account['fund'] * $threshold / 100) {
                $alerts[] = ['tone' => 'warn', 'text' => "{$account['name']}: el saldo está bajo el {$threshold} % del fondo. Conviene pedir reposición."];
            }
            if ($account['kind'] === 'gateway' && $account['balance'] > 0) {
                $alerts[] = ['tone' => 'info', 'text' => "{$account['name']}: {$account['currency']} ".number_format($account['balance'], 2).' por liquidar al banco.'];
            }
        }

        $pendingCounts = DB::table('fin_cash_counts')->where('status', 'pending_approval')->count();
        $pendingReplenishments = DB::table('fin_cash_replenishments')->where('status', 'requested')->count();
        if ($pendingCounts > 0) {
            $alerts[] = ['tone' => 'bad', 'text' => $pendingCounts === 1 ? 'Hay 1 arqueo con diferencia por aprobar.' : "Hay {$pendingCounts} arqueos con diferencia por aprobar."];
        }
        if ($pendingReplenishments > 0) {
            $alerts[] = ['tone' => 'warn', 'text' => $pendingReplenishments === 1 ? 'Hay 1 reposición por aprobar.' : "Hay {$pendingReplenishments} reposiciones por aprobar."];
        }

        return $alerts;
    }

    private function sessions(): array
    {
        return DB::table('fin_cash_sessions as s')
            ->join('fin_treasury_accounts as a', 'a.id', '=', 's.account_id')
            ->leftJoin('fin_cash_counts as c', 'c.id', '=', 's.closing_count_id')
            ->leftJoin('iam_users as o', 'o.id', '=', 's.opened_by')
            ->leftJoin('iam_users as x', 'x.id', '=', 's.closed_by')
            ->orderByDesc('s.session_date')
            ->orderBy('a.code')
            ->limit(120)
            ->get(['s.code', 's.session_date', 's.opened_at', 's.closed_at', 's.opening_amount', 's.status', 'a.name as account', 'a.code as account_code', 'o.name as opened_by', 'x.name as closed_by', 'c.code as count_code', 'c.counted_amount', 'c.difference', 'c.result', 'c.status as count_status', 'c.note as count_note'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'date' => $row->session_date,
                'account' => $row->account,
                'account_code' => $row->account_code,
                'opened_by' => $row->opened_by,
                'opened_at' => $row->opened_at,
                'closed_at' => $row->closed_at,
                'closed_by' => $row->closed_by,
                'opening' => (float) $row->opening_amount,
                'status' => $row->status,
                'count' => $row->count_code ? [
                    'code' => $row->count_code,
                    'counted' => (float) $row->counted_amount,
                    'difference' => (float) $row->difference,
                    'result' => self::COUNT_RESULT[$row->result] ?? $row->result,
                    'status' => self::COUNT_STATUS[$row->count_status] ?? $row->count_status,
                    'note' => $row->count_note,
                ] : null,
            ])->values()->all();
    }
}
