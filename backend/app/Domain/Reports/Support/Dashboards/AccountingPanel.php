<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use App\Domain\Finance\Actions\PeriodCloseWorkflow;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class AccountingPanel
{
    private const CREDIT_NOTE = '07';

    private const OBSERVED = ['observado', 'rechazado'];

    public function __construct(private readonly PanelData $data, private readonly PeriodCloseWorkflow $closes) {}

    public function build(User $viewer): array
    {
        $start = $this->data->monthStart();
        $month = DB::table('fin_invoices')->whereBetween('issue_date', [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()])->where('doc_type', '<>', self::CREDIT_NOTE)->whereNotIn('status', ['anulado', 'rechazado', 'pendiente_envio'])->get(['doc_type', 'total_amount', 'fx_rate']);
        $observed = DB::table('fin_invoices')->whereIn('status', self::OBSERVED)->get(['number', 'ose_response_message']);
        $undocumented = $this->undocumented();
        $receivables = $this->data->receivables($viewer);
        $close = $this->closes->show($this->data->now()->format('Y-m'), $viewer);

        return [
            'today' => $this->data->today(),
            'month' => $this->data->monthLabel(),
            'kpis' => [
                'invoices' => ['count' => $month->count(), 'amount' => round($month->where('doc_type', '<>', self::CREDIT_NOTE)->sum(fn (object $row): float => $this->data->pen((float) $row->total_amount, $row->fx_rate)), 2)],
                'observed' => ['count' => $observed->count()],
                'undocumented' => ['count' => $undocumented->count(), 'amount' => round($undocumented->sum('amount_pen'), 2)],
                'receivables' => ['count' => $receivables->count(), 'amount' => round($receivables->sum(fn (object $row): float => $this->data->balance($row)), 2)],
            ],
            'observed' => $observed->take(3)->map(fn (object $row): array => ['number' => $row->number, 'detail' => $row->ose_response_message])->values(),
            'invoices' => $this->invoices(),
            'close' => [
                'period' => $close['period'],
                'label' => $close['label'],
                'status' => $close['status'],
                'done' => $close['done'],
                'total' => $close['total'],
                'checks' => collect([...$close['automatic'], ...$close['manual']])->map(fn (array $check): array => ['label' => $check['label'], 'ok' => (bool) $check['ok'], 'manual' => in_array($check, $close['manual'], true)])->values(),
            ],
            'undocumented' => $undocumented->take(6)->values(),
            'receivables' => $receivables->take(6)->map(fn ($row): array => ['code' => $row->code, 'client' => $row->client, 'concept' => $row->concept, 'due' => $row->due_date, 'overdue' => $this->data->overdue($row), 'balance' => round((float) $row->amount - (float) $row->paid_amount, 2), 'currency' => $row->currency, 'status' => $row->status])->values(),
        ];
    }

    private function invoices(): array
    {
        return DB::table('fin_invoices')->orderByDesc('issue_date')->orderByDesc('created_at')->limit(8)
            ->get(['number', 'doc_type', 'customer_name', 'issue_date', 'total_amount', 'currency', 'status'])
            ->map(fn (object $row): array => ['number' => $row->number, 'type' => $row->doc_type, 'client' => $row->customer_name, 'date' => $row->issue_date, 'total' => round((float) $row->total_amount, 2), 'currency' => $row->currency, 'credit' => $row->doc_type === self::CREDIT_NOTE, 'status' => $row->status])->all();
    }

    private function undocumented(): Collection
    {
        $payments = DB::table('fin_payments as p')->leftJoin('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->where('p.kind', 'cobro')->whereIn('p.status', ['aplicado', 'confirmado'])
            ->orderByDesc('p.paid_on')->get(['p.code', 'p.method', 'p.amount', 'p.currency', 'p.fx_rate', 'p.paid_on', 'p.reservation_id', 'r.code as reservation']);
        $invoices = DB::table('fin_invoices')->whereIn('reservation_id', $payments->pluck('reservation_id')->filter())->where('doc_type', '<>', self::CREDIT_NOTE)->whereNotIn('status', ['anulado', 'rechazado'])
            ->get(['reservation_id', 'total_amount', 'fx_rate'])->groupBy('reservation_id');

        return $payments->filter(function (object $payment) use ($invoices): bool {
            $amount = $this->data->pen((float) $payment->amount, $payment->fx_rate);

            return ! collect($invoices->get($payment->reservation_id, []))->contains(fn (object $invoice): bool => abs($this->data->pen((float) $invoice->total_amount, $invoice->fx_rate) - $amount) < 0.5);
        })->map(fn (object $row): array => [
            'code' => $row->code,
            'method' => $row->method,
            'reservation' => $row->reservation,
            'date' => $row->paid_on,
            'amount' => round((float) $row->amount, 2),
            'currency' => $row->currency,
            'amount_pen' => $this->data->pen((float) $row->amount, $row->fx_rate),
        ])->values();
    }
}
