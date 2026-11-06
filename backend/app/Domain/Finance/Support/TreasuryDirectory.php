<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class TreasuryDirectory
{
    public const KINDS = ['bank' => 'Banco', 'petty_cash' => 'Caja chica', 'gateway' => 'Pasarela'];

    public const TYPES = [
        'collection' => 'Cobro', 'collection_reversal' => 'Reversión de cobro', 'supplier_payment' => 'Pago a proveedor', 'transfer' => 'Transferencia',
        'petty_expense' => 'Gasto de caja', 'replenishment' => 'Reposición de caja', 'gateway_settlement' => 'Liquidación de pasarela', 'gateway_fee' => 'Comisión de pasarela',
        'count_adjustment' => 'Ajuste de arqueo', 'other_income' => 'Otro ingreso', 'other_expense' => 'Otro egreso',
    ];

    private const COUNT_STATUS = ['signed' => 'Firmado', 'pending_approval' => 'Por aprobar', 'approved' => 'Aprobado', 'validated' => 'Validado'];

    private const COUNT_RESULT = ['balanced' => 'Cuadrado', 'over' => 'Sobrante', 'short' => 'Faltante'];

    private const REPLENISHMENT = ['requested' => 'Solicitada', 'approved' => 'Aprobada', 'paid' => 'Pagada', 'rejected' => 'Rechazada'];

    public function __construct(private readonly Consolidation $money) {}

    public function overview(User $viewer): array
    {
        $flows = DB::table('fin_treasury_movements')->where('status', 'posted')->groupBy('account_id')
            ->selectRaw("account_id, sum(case when direction = 'in' then amount else 0 end) as inflow, sum(case when direction = 'out' then amount else 0 end) as outflow")
            ->get()->keyBy('account_id');
        $accounts = DB::table('fin_treasury_accounts as a')
            ->leftJoin('iam_sedes as s', 's.id', '=', 'a.sede_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'a.custodian_id')
            ->whereNull('a.deleted_at')
            ->orderBy('a.code')
            ->get(['a.id', 'a.code', 'a.kind', 'a.bank', 'a.name', 'a.account_number', 'a.currency', 'a.fund_amount', 'a.opening_balance', 'a.status', 's.name as sede', 'u.name as custodian'])
            ->map(function (object $row) use ($flows): array {
                $flow = $flows->get($row->id);
                $balance = round((float) $row->opening_balance + (float) ($flow->inflow ?? 0) - (float) ($flow->outflow ?? 0), 2);

                return [
                    'code' => $row->code,
                    'kind' => $row->kind,
                    'kind_label' => self::KINDS[$row->kind],
                    'bank' => $row->bank,
                    'name' => $row->name,
                    'number' => $row->account_number,
                    'currency' => $row->currency,
                    'balance' => $balance,
                    'balance_pen' => $this->money->pen($balance, $row->currency),
                    'fund' => $row->fund_amount !== null ? (float) $row->fund_amount : null,
                    'sede' => $row->sede,
                    'custodian' => $row->custodian,
                    'active' => $row->status === 'active',
                ];
            })->values();

        $movements = DB::table('fin_treasury_movements as m')
            ->join('fin_treasury_accounts as a', 'a.id', '=', 'm.account_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'm.created_by')
            ->orderByDesc('m.movement_date')
            ->orderByDesc('m.code')
            ->limit(500)
            ->get(['m.code', 'm.movement_date', 'm.direction', 'm.type', 'm.amount', 'm.currency', 'm.fx_rate', 'm.source_type', 'm.category', 'm.description', 'm.reference', 'm.counterparty', 'm.status', 'm.void_reason', 'a.code as account_code', 'a.name as account_name', 'u.name as user_name'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'date' => $row->movement_date,
                'direction' => $row->direction,
                'type' => $row->type,
                'type_label' => self::TYPES[$row->type] ?? $row->type,
                'amount' => (float) $row->amount,
                'currency' => $row->currency,
                'pen' => $this->money->pen($row->amount, $row->currency, $row->fx_rate),
                'manual' => $row->source_type === 'manual',
                'category' => $row->category,
                'description' => $row->description,
                'reference' => $row->reference,
                'counterparty' => $row->counterparty,
                'status' => $row->status,
                'void_reason' => $row->void_reason,
                'account' => ['code' => $row->account_code, 'name' => $row->account_name],
                'user' => $row->user_name ?? 'Sistema',
            ])->values();

        $monthStart = $this->money->monthStart();
        $posted = $movements->where('status', 'posted')->where('date', '>=', $monthStart)->whereNotIn('type', ['transfer', 'replenishment', 'gateway_settlement']);

        return [
            'accounts' => $accounts,
            'movements' => $movements,
            'sessions' => $this->sessions(),
            'replenishments' => DB::table('fin_cash_replenishments as r')->join('fin_treasury_accounts as a', 'a.id', '=', 'r.account_id')->leftJoin('iam_users as u', 'u.id', '=', 'r.requested_by')
                ->orderByDesc('r.requested_at')->get(['r.code', 'r.amount', 'r.status', 'r.requested_at', 'r.note', 'a.name as account', 'u.name as requested_by'])
                ->map(fn (object $row): array => ['code' => $row->code, 'amount' => (float) $row->amount, 'status' => $row->status, 'status_label' => self::REPLENISHMENT[$row->status] ?? $row->status, 'requested_at' => $row->requested_at, 'note' => $row->note, 'account' => $row->account, 'requested_by' => $row->requested_by]),
            'kpis' => [
                'bank_pen' => round($accounts->where('kind', 'bank')->sum('balance_pen'), 2),
                'cash_pen' => round($accounts->where('kind', 'petty_cash')->sum('balance_pen'), 2),
                'gateway_pen' => round($accounts->where('kind', 'gateway')->sum('balance_pen'), 2),
                'total_pen' => round($accounts->sum('balance_pen'), 2),
                'in_month_pen' => round($posted->where('direction', 'in')->sum('pen'), 2),
                'out_month_pen' => round($posted->where('direction', 'out')->sum('pen'), 2),
                'open_sessions' => DB::table('fin_cash_sessions')->where('status', 'open')->count(),
            ],
            'categories' => DB::table('fin_treasury_movements')->whereNotNull('category')->whereIn('type', ['other_income', 'other_expense'])->distinct()->orderBy('category')->pluck('category'),
            'usd_rate' => $this->money->usdRate(),
            'today' => $this->money->today(),
            'can' => ['manage' => $viewer->can('finance.treasury')],
        ];
    }

    private function sessions(): array
    {
        return DB::table('fin_cash_sessions as s')
            ->join('fin_treasury_accounts as a', 'a.id', '=', 's.account_id')
            ->leftJoin('fin_cash_counts as c', 'c.id', '=', 's.closing_count_id')
            ->leftJoin('iam_users as o', 'o.id', '=', 's.opened_by')
            ->orderByDesc('s.session_date')
            ->orderBy('a.code')
            ->get(['s.code', 's.session_date', 's.opened_at', 's.closed_at', 's.opening_amount', 's.status', 'a.name as account', 'o.name as opened_by', 'c.code as count_code', 'c.counted_amount', 'c.difference', 'c.result', 'c.status as count_status', 'c.note as count_note'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'date' => $row->session_date,
                'account' => $row->account,
                'opened_by' => $row->opened_by,
                'opened_at' => $row->opened_at,
                'closed_at' => $row->closed_at,
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
