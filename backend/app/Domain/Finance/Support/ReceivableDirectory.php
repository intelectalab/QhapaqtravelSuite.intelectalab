<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ReceivableDirectory
{
    public const AGING = ['Por vencer', '1-30 d', '31-60 d', '61-90 d', '+90 d'];

    public function __construct(private readonly Consolidation $money, private readonly PaymentMethods $methods) {}

    public function overview(User $viewer): array
    {
        $today = $this->money->today();
        $rows = DB::table('fin_receivables as r')
            ->join('booking_reservations as b', 'b.id', '=', 'r.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'b.owner_id')
            ->whereNull('r.deleted_at')
            ->orderBy('r.due_date')
            ->get(['r.id', 'r.code', 'r.kind', 'r.concept', 'r.amount', 'r.paid_amount', 'r.currency', 'r.fx_rate', 'r.due_date', 'r.status', 'r.cancel_reason', 'r.cancelled_at', 'r.last_reminder_at', 'b.code as reservation_code', 'b.title as reservation_title', 'b.status as reservation_status', 'c.code as client_code', 'c.name as client_name', 'u.name as owner_name'])
            ->map(function (object $row) use ($today): array {
                $amount = (float) $row->amount;
                $paid = (float) $row->paid_amount;
                $balance = round($amount - $paid, 2);
                $status = ReceivableLedger::status($row->status, $amount, $paid, $row->due_date, $today);
                $overdue = $status === 'vencida' ? (int) Carbon::parse($row->due_date)->diffInDays(Carbon::parse($today)) : 0;

                return [
                    'code' => $row->code,
                    'kind' => $row->kind,
                    'concept' => $row->concept,
                    'amount' => $amount,
                    'paid' => $paid,
                    'balance' => $status === 'cancelada' ? 0.0 : $balance,
                    'balance_pen' => $status === 'cancelada' ? 0.0 : $this->money->pen($balance, $row->currency, $row->fx_rate),
                    'currency' => $row->currency,
                    'fx_rate' => $row->fx_rate !== null ? (float) $row->fx_rate : null,
                    'due_date' => $row->due_date,
                    'days_overdue' => $overdue,
                    'status' => $status,
                    'cancel_reason' => $row->cancel_reason,
                    'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title, 'status' => $row->reservation_status],
                    'client' => ['code' => $row->client_code, 'name' => $row->client_name],
                    'owner' => $row->owner_name,
                ];
            })->values();

        $open = $rows->whereNotIn('status', ['pagada', 'cancelada']);
        $overdue = $open->where('status', 'vencida');
        $week = Carbon::parse($today)->addDays(7)->toDateString();
        $collected = DB::table('fin_payments')->where('status', 'aplicado')->where('kind', 'cobro')->where('paid_on', '>=', $this->money->monthStart())->get(['amount', 'currency', 'fx_rate']);

        return [
            'today' => $today,
            'rows' => $rows,
            'kpis' => [
                'receivable_pen' => round($open->sum('balance_pen'), 2),
                'receivable_count' => $open->count(),
                'overdue_pen' => round($overdue->sum('balance_pen'), 2),
                'overdue_count' => $overdue->count(),
                'due_week_pen' => round($open->where('status', '<>', 'vencida')->where('due_date', '<=', $week)->sum('balance_pen'), 2),
                'collected_month_pen' => round($collected->sum(fn (object $row): float => $this->money->pen($row->amount, $row->currency, $row->fx_rate)), 2),
            ],
            'aging' => $this->aging($open->all()),
            'methods' => $this->methods->options(),
            'usd_rate' => $this->money->usdRate(),
            'can' => [
                'register' => $viewer->can('finance.payments.register'),
                'cancel' => $viewer->can('finance.payments.register'),
            ],
        ];
    }

    private function aging(array $open): array
    {
        $buckets = array_fill_keys(self::AGING, ['pen' => 0.0, 'count' => 0]);

        foreach ($open as $row) {
            $days = $row['days_overdue'];
            $label = match (true) {
                $row['status'] !== 'vencida' => self::AGING[0],
                $days <= 30 => self::AGING[1],
                $days <= 60 => self::AGING[2],
                $days <= 90 => self::AGING[3],
                default => self::AGING[4],
            };
            $buckets[$label]['pen'] += $row['balance_pen'];
            $buckets[$label]['count']++;
        }

        return collect($buckets)->map(fn (array $bucket, string $label): array => ['label' => $label, 'pen' => round($bucket['pen'], 2), 'count' => $bucket['count']])->values()->all();
    }
}
