<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PayableDirectory
{
    public const COST_TYPES = [
        'costo_adicional' => 'Costo adicional',
        'ajuste_tarifa' => 'Ajuste de tarifa',
        'penalidad_proveedor' => 'Penalidad del proveedor',
        'gasto_operativo_destino' => 'Gasto operativo en destino',
    ];

    public const PAYOUT_METHODS = [
        'transferencia' => 'Transferencia',
        'transferencia_cci' => 'Transferencia interbancaria (CCI)',
        'cheque_gerencia' => 'Cheque de gerencia',
        'efectivo_caja_chica' => 'Efectivo de caja chica',
        'cargo_bancario' => 'Cargo bancario',
    ];

    public function __construct(private readonly Consolidation $money) {}

    public static function status(string $stored, float $amount, float $paid, string $due, bool $approved, string $today): string
    {
        return match (true) {
            $stored === 'cancelada' => 'cancelada',
            $amount - $paid <= ReceivableLedger::TOLERANCE => 'pagada',
            $due < $today => 'vencida',
            $paid > 0 => 'parcial',
            $approved => 'aprobada',
            default => 'abierta',
        };
    }

    public function overview(User $viewer): array
    {
        $today = $this->money->today();
        $rows = DB::table('fin_payables as p')
            ->join('catalog_providers as v', 'v.id', '=', 'p.provider_id')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'p.reservation_id')
            ->leftJoin('booking_reservation_services as s', 's.id', '=', 'p.reservation_service_id')
            ->leftJoin('fin_treasury_accounts as t', 't.id', '=', 'p.scheduled_bank_account_id')
            ->whereNull('p.deleted_at')
            ->orderBy('p.due_date')
            ->get(['p.code', 'p.lock_version', 'p.kind', 'p.cost_type', 'p.concept', 'p.amount', 'p.paid_amount', 'p.currency', 'p.fx_rate', 'p.due_date', 'p.status', 'p.approved_at', 'p.supplier_doc_number', 'p.evidence_note', 'p.observation', 'p.scheduled_date', 't.code as scheduled_account', 'v.ref as provider_ref', 'v.name as provider_name', 'v.status as provider_status', 'b.code as reservation_code', 'b.title as reservation_title', 's.name as service_name', 's.code as service_code', 's.service_date', 's.status as service_status'])
            ->map(function (object $row) use ($today): array {
                $amount = (float) $row->amount;
                $paid = (float) $row->paid_amount;
                $balance = round($amount - $paid, 2);
                $status = self::status($row->status, $amount, $paid, $row->due_date, $row->approved_at !== null, $today);

                return [
                    'code' => $row->code,
                    'lock_version' => (int) $row->lock_version,
                    'kind' => $row->kind,
                    'cost_type' => $row->cost_type,
                    'concept' => $row->concept,
                    'amount' => $amount,
                    'paid' => $paid,
                    'amount_pen' => $this->money->pen($amount, $row->currency, $row->fx_rate),
                    'paid_pen' => $this->money->pen($paid, $row->currency, $row->fx_rate),
                    'balance' => $status === 'cancelada' ? 0.0 : $balance,
                    'balance_pen' => $status === 'cancelada' ? 0.0 : $this->money->pen($balance, $row->currency, $row->fx_rate),
                    'currency' => $row->currency,
                    'fx_rate' => $row->fx_rate !== null ? (float) $row->fx_rate : null,
                    'due_date' => $row->due_date,
                    'days_overdue' => $status === 'vencida' ? (int) Carbon::parse($row->due_date)->diffInDays(Carbon::parse($today)) : 0,
                    'status' => $status,
                    'approved' => $row->approved_at !== null,
                    'supplier_doc' => $row->supplier_doc_number,
                    'evidence' => $row->evidence_note,
                    'observation' => $row->observation,
                    'scheduled_date' => $row->scheduled_date,
                    'scheduled_account' => $row->scheduled_account,
                    'provider' => ['ref' => $row->provider_ref, 'name' => $row->provider_name, 'status' => $row->provider_status],
                    'reservation' => $row->reservation_code ? ['code' => $row->reservation_code, 'title' => $row->reservation_title] : null,
                    'service' => $row->service_code ? ['code' => $row->service_code, 'name' => $row->service_name, 'date' => $row->service_date, 'status' => $row->service_status] : null,
                    'managed' => $row->kind === 'servicio' && $row->service_code !== null,
                ];
            })->values();

        $open = $rows->whereNotIn('status', ['pagada', 'cancelada']);
        $week = Carbon::parse($today)->addDays(7)->toDateString();
        $paidMonth = DB::table('fin_payable_payouts as o')->join('fin_payables as p', 'p.id', '=', 'o.payable_id')->where('o.paid_on', '>=', $this->money->monthStart())->get(['o.amount', 'p.currency', 'o.fx_rate']);

        return [
            'rows' => $rows,
            'kpis' => [
                'payable_pen' => round($open->sum('balance_pen'), 2),
                'payable_count' => $open->count(),
                'overdue_pen' => round($open->where('status', 'vencida')->sum('balance_pen'), 2),
                'overdue_count' => $open->where('status', 'vencida')->count(),
                'to_approve' => $open->where('approved', false)->count(),
                'due_week_pen' => round($open->where('due_date', '<=', $week)->where('status', '<>', 'vencida')->sum('balance_pen'), 2),
                'scheduled_week_pen' => round($open->filter(fn (array $row): bool => $row['scheduled_date'] !== null && $row['scheduled_date'] <= $week)->sum('balance_pen'), 2),
                'scheduled_week_count' => $open->filter(fn (array $row): bool => $row['scheduled_date'] !== null && $row['scheduled_date'] <= $week)->count(),
                'paid_month_pen' => round($paidMonth->sum(fn (object $row): float => $this->money->pen($row->amount, $row->currency, $row->fx_rate)), 2),
            ],
            'by_provider' => $open->groupBy(fn (array $row): string => $row['provider']['name'])
                ->map(fn ($items, string $name): array => ['name' => $name, 'pen' => round($items->sum('balance_pen'), 2), 'count' => $items->count()])
                ->sortByDesc('pen')->take(6)->values(),
            'options' => [
                'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->orderBy('name')->get(['ref as value', 'name as label']),
                'reservations' => DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['borrador', 'cancelada'])->orderByDesc('code')->get(['code as value', 'title', 'currency'])
                    ->map(fn (object $row): array => ['value' => $row->value, 'label' => "{$row->value} · {$row->title}", 'currency' => $row->currency]),
                'cost_types' => collect(self::COST_TYPES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
                'payout_methods' => collect(self::PAYOUT_METHODS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
                'bank_accounts' => FinanceDetails::bankAccounts(),
            ],
            'today' => $today,
            'usd_rate' => $this->money->usdRate(),
            'can' => [
                'manage' => $viewer->can('finance.payables'),
                'operate' => $viewer->can('finance.payables') && $viewer->can('finance.payments.register'),
            ],
        ];
    }
}
