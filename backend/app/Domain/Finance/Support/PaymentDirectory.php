<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class PaymentDirectory
{
    public function __construct(private readonly Consolidation $money, private readonly PaymentMethods $methods) {}

    public function overview(User $viewer): array
    {
        $labels = $this->methods->labels();
        $monthStart = $this->money->monthStart();
        $today = $this->money->today();
        $open = DB::table('fin_receivables')->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])
            ->get(['code', 'reservation_id', 'currency', 'amount', 'paid_amount', 'due_date', 'concept'])
            ->groupBy(fn (object $row): string => $row->reservation_id.'|'.$row->currency);
        $lines = DB::table('fin_bank_lines')->whereNotNull('matched_payment_id')->pluck('code', 'matched_payment_id');

        $rows = DB::table('fin_payments as p')
            ->join('booking_reservations as b', 'b.id', '=', 'p.reservation_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'b.client_id')
            ->leftJoin('fin_receivables as r', 'r.id', '=', 'p.receivable_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'p.registered_by')
            ->orderByDesc('p.paid_on')
            ->orderByDesc('p.created_at')
            ->get(['p.id', 'p.code', 'p.lock_version', 'p.kind', 'p.source', 'p.method', 'p.amount', 'p.currency', 'p.fx_rate', 'p.paid_on', 'p.reference', 'p.note', 'p.status', 'p.reject_reason', 'p.revert_reason', 'p.reverted_at', 'p.retries', 'p.reservation_id', 'b.code as reservation_code', 'b.title as reservation_title', 'c.name as client_name', 'r.code as receivable_code', 'u.name as registered_by'])
            ->map(function (object $row) use ($labels, $open, $today, $lines): array {
                $candidates = $row->kind === 'cobro' && in_array($row->status, ['pendiente', 'confirmado'], true) ? $this->candidates($open->get($row->reservation_id.'|'.$row->currency)?->all() ?? [], (float) $row->amount, $today) : [];

                return [
                    'code' => $row->code,
                    'lock_version' => (int) $row->lock_version,
                    'kind' => $row->kind,
                    'source' => $row->source,
                    'method' => $labels[$row->method] ?? $row->method,
                    'amount' => (float) $row->amount,
                    'currency' => $row->currency,
                    'fx_rate' => $row->fx_rate !== null ? (float) $row->fx_rate : null,
                    'pen' => $this->money->pen($row->amount, $row->currency, $row->fx_rate),
                    'paid_on' => $row->paid_on,
                    'reference' => $row->reference,
                    'note' => $row->note,
                    'status' => $row->status,
                    'reason' => $row->status === 'rechazado' ? $row->reject_reason : ($row->status === 'revertido' ? $row->revert_reason : null),
                    'retries' => (int) $row->retries,
                    'receivable' => $row->receivable_code,
                    'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title],
                    'client' => $row->client_name,
                    'registered_by' => $row->registered_by ?? 'Sistema',
                    'bank_line' => $lines[$row->id] ?? null,
                    'apply_to' => $candidates,
                ];
            })->values();

        $month = $rows->where('paid_on', '>=', $monthStart);

        return [
            'rows' => $rows,
            'kpis' => [
                'pending_count' => $rows->where('kind', 'cobro')->where('status', 'pendiente')->count(),
                'pending_pen' => round($rows->where('kind', 'cobro')->where('status', 'pendiente')->sum('pen'), 2),
                'applied_month_pen' => round($month->where('status', 'aplicado')->sum('pen'), 2),
                'applied_month_count' => $month->where('status', 'aplicado')->count(),
                'reverted_count' => $rows->where('status', 'revertido')->count(),
                'reverted_pen' => round($rows->where('status', 'revertido')->sum('pen'), 2),
                'rejected_count' => $rows->where('status', 'rechazado')->count(),
            ],
            'can' => [
                'validate' => $viewer->can('finance.payments.register'),
                'revert' => $viewer->can('finance.payments.revert'),
            ],
        ];
    }

    private function candidates(array $receivables, float $amount, string $today): array
    {
        $options = [];

        foreach ($receivables as $receivable) {
            $balance = round((float) $receivable->amount - (float) $receivable->paid_amount, 2);
            if ($balance + ReceivableLedger::TOLERANCE >= $amount) {
                $options[] = ['code' => $receivable->code, 'concept' => $receivable->concept, 'balance' => $balance, 'overdue' => $receivable->due_date < $today];
            }
        }

        return $options;
    }
}
