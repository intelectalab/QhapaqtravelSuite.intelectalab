<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Finance\Actions\TreasuryOperations;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
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

    public const RECEIPTS = ['invoice' => 'Factura', 'sales_receipt' => 'Boleta', 'ticket' => 'Ticket', 'fee_receipt' => 'Recibo por honorarios', 'mobility_sheet' => 'Planilla de movilidad', 'sworn_statement' => 'Declaración jurada'];

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
            ->leftJoin('iam_users as v', 'v.id', '=', 'm.voided_by')
            ->leftJoin('fin_payments as p', fn ($join) => $join->on('p.id', '=', 'm.source_id')->whereIn('m.source_type', ['payment', 'payment_reversal']))
            ->leftJoin('fin_payable_payouts as o', fn ($join) => $join->on('o.id', '=', 'm.source_id')->where('m.source_type', 'payout'))
            ->leftJoin('fin_payables as q', fn ($join) => $join->on('q.id', '=', DB::raw('coalesce(o.payable_id, case when m.source_type = \'payable\' then m.source_id end)')))
            ->leftJoin('fin_treasury_transfers as t', 't.id', '=', 'm.transfer_id')
            ->leftJoin('fin_cash_counts as k', fn ($join) => $join->on('k.id', '=', 'm.source_id')->where('m.source_type', 'cash_count'))
            ->leftJoin('fin_cash_replenishments as r', 'r.id', '=', 'm.replenishment_id')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'm.reservation_id')
            ->leftJoin('fin_expense_receipts as e', 'e.movement_id', '=', 'm.id')
            ->orderByDesc('m.movement_date')
            ->orderByDesc('m.code')
            ->limit(500)
            ->get(['m.code', 'm.movement_date', 'm.direction', 'm.type', 'm.amount', 'm.currency', 'm.fx_rate', 'm.source_type', 'm.category', 'm.description', 'm.reference', 'm.counterparty', 'm.status', 'm.void_reason', 'm.voided_at', 'm.created_at', 'a.code as account_code', 'a.name as account_name', 'u.name as user_name', 'v.name as voided_name',
                'p.code as payment_code', 'q.code as payable_code', 't.code as transfer_code', 'k.code as count_code', 'r.code as replenishment_code', 'b.code as reservation_code',
                'e.receipt_type', 'e.series_number', 'e.issuer_ruc', 'e.supplier_name', 'e.file_path'])
            ->map(fn (object $row): array => [
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
            ])->values();

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
            ],
            'categories' => self::CATEGORIES,
            'usd_rate' => $this->money->usdRate(),
            'today' => $this->money->today(),
            'can' => ['manage' => $viewer->can('finance.treasury'), 'settings' => $viewer->can('admin.settings.manage'), 'revalue' => $viewer->can('finance.invoicing')],
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
        $rows = DB::table('fin_treasury_movements as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.created_by')
            ->where('m.account_id', $account->id)->orderBy('m.movement_date')->orderBy('m.code')
            ->get(['m.code', 'm.movement_date', 'm.direction', 'm.type', 'm.amount', 'm.category', 'm.description', 'm.reference', 'm.counterparty', 'm.source_type', 'm.status', 'u.name as user_name'])
            ->map(function (object $row) use (&$running): array {
                if ($row->status === 'posted') {
                    $running = trim($row->direction) === 'in' ? $running->plus((string) $row->amount) : $running->minus((string) $row->amount);
                }

                return [
                    'code' => $row->code, 'date' => $row->movement_date, 'direction' => trim($row->direction), 'type' => $row->type, 'type_label' => self::TYPES[$row->type] ?? $row->type,
                    'amount' => (string) $row->amount, 'category' => $row->category, 'description' => $row->description, 'reference' => $row->reference, 'counterparty' => $row->counterparty,
                    'manual' => $row->source_type === 'manual', 'status' => $row->status, 'balance' => (string) $running->toScale(2), 'user' => $row->user_name ?? 'Sistema',
                ];
            });
        $month = $this->money->monthStart();
        $posted = $rows->where('status', 'posted')->where('date', '>=', $month);

        return [
            'code' => $account->code, 'kind' => $account->kind, 'kind_label' => self::KINDS[$account->kind], 'name' => $account->name, 'bank' => $account->bank,
            'number' => $account->account_number, 'cci' => $account->cci, 'currency' => $account->currency, 'sede' => $account->sede, 'custodian' => $account->custodian,
            'fund' => $account->fund_amount, 'settle_to' => $account->settle_code ? ['code' => $account->settle_code, 'name' => $account->settle_name] : null,
            'opening_balance' => (string) $account->opening_balance, 'opening_date' => $account->opening_date, 'active' => $account->status === 'active',
            'balance' => (string) $running->toScale(2),
            'month_in' => (string) $posted->where('direction', 'in')->reduce(fn (BigDecimal $sum, array $row) => $sum->plus($row['amount']), BigDecimal::zero()),
            'month_out' => (string) $posted->where('direction', 'out')->reduce(fn (BigDecimal $sum, array $row) => $sum->plus($row['amount']), BigDecimal::zero()),
            'open_session' => DB::table('fin_cash_sessions')->where('account_id', $account->id)->where('status', 'open')->first(['code', 'opened_at', 'opening_amount']),
            'movements' => $rows->reverse()->values(),
        ];
    }

    public function cashFlow(User $viewer): array
    {
        $today = Carbon::parse($this->money->today());
        $balance = collect($this->overview($viewer)['accounts'])->where('active', true)->sum('balance_pen');
        $settings = DB::table('fin_treasury_settings')->first(['recurring_outflows']);
        $recurring = json_decode((string) ($settings->recurring_outflows ?? '[]'), true) ?: [];
        $receivables = DB::table('fin_receivables')->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])->get(['code', 'concept', 'amount', 'paid_amount', 'fx_rate', 'due_date']);
        $payables = DB::table('fin_payables')->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'anulada', 'cancelada'])->get(['code', 'concept', 'amount', 'paid_amount', 'fx_rate', 'due_date']);
        $items = collect();

        foreach ($receivables as $row) {
            $items->push(['kind' => 'in', 'source' => 'Cuota por cobrar', 'code' => $row->code, 'concept' => $row->concept, 'date' => max((string) $row->due_date, $today->toDateString()), 'overdue' => (string) $row->due_date < $today->toDateString(), 'pen' => round(((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1), 2)]);
        }

        foreach ($payables as $row) {
            $items->push(['kind' => 'out', 'source' => 'Cuenta por pagar', 'code' => $row->code, 'concept' => $row->concept, 'date' => max((string) $row->due_date, $today->toDateString()), 'overdue' => (string) $row->due_date < $today->toDateString(), 'pen' => round(((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1), 2)]);
        }

        for ($month = 0; $month < 3; $month++) {
            foreach ($recurring as $outflow) {
                $date = $today->copy()->startOfMonth()->addMonths($month)->day(min((int) $outflow['day'], 28));
                if ($date->gte($today) && $date->lte($today->copy()->addDays(90))) {
                    $items->push(['kind' => 'out', 'source' => 'Egreso fijo', 'code' => null, 'concept' => $outflow['concept'], 'date' => $date->toDateString(), 'overdue' => false, 'pen' => (float) $outflow['amount']]);
                }
            }
        }

        $items = $items->filter(fn (array $item) => $item['date'] <= $today->copy()->addDays(90)->toDateString() && $item['pen'] > 0)->sortBy('date')->values();
        $running = $balance;
        $horizons = collect([[0, 30], [31, 60], [61, 90]])->map(function (array $range) use ($items, $today, &$running): array {
            $slice = $items->filter(fn (array $item) => $today->diffInDays(Carbon::parse($item['date'])) >= $range[0] && $today->diffInDays(Carbon::parse($item['date'])) <= $range[1]);
            $in = round($slice->where('kind', 'in')->sum('pen'), 2);
            $out = round($slice->where('kind', 'out')->sum('pen'), 2);
            $running = round($running + $in - $out, 2);

            return ['label' => "{$range[0]} a {$range[1]} días", 'in' => $in, 'out' => $out, 'net' => round($in - $out, 2), 'closing' => $running];
        });

        return ['opening_pen' => round($balance, 2), 'horizons' => $horizons->values(), 'items' => $items->all(), 'risk' => $horizons->first(fn (array $horizon) => $horizon['closing'] < 0)];
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
            ->orderByDesc('s.session_date')
            ->orderBy('a.code')
            ->get(['s.code', 's.session_date', 's.opened_at', 's.closed_at', 's.opening_amount', 's.status', 'a.name as account', 'a.code as account_code', 'o.name as opened_by', 'c.code as count_code', 'c.counted_amount', 'c.difference', 'c.result', 'c.status as count_status', 'c.note as count_note'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'date' => $row->session_date,
                'account' => $row->account,
                'account_code' => $row->account_code,
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
