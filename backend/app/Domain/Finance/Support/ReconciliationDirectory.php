<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class ReconciliationDirectory
{
    public const RESOLUTIONS = ['match' => 'Coincidencia confirmada', 'asignado' => 'Asignado manualmente', 'otro_ingreso' => 'Otro ingreso', 'gasto_bancario' => 'Gasto o comisión bancaria'];

    public function __construct(private readonly Consolidation $money) {}

    public function overview(User $viewer): array
    {
        $rows = DB::table('fin_bank_lines as l')
            ->leftJoin('fin_payments as p', 'p.id', '=', 'l.matched_payment_id')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'p.reservation_id')
            ->leftJoin('fin_payables as x', 'x.id', '=', 'l.matched_payable_id')
            ->leftJoin('catalog_providers as v', 'v.id', '=', 'x.provider_id')
            ->leftJoin('fin_reconciliation_closures as c', 'c.id', '=', 'l.closure_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'l.resolved_by')
            ->orderByDesc('l.value_date')
            ->orderByDesc('l.code')
            ->get(['l.code', 'l.bank', 'l.value_date', 'l.description', 'l.amount', 'l.currency', 'l.status', 'l.resolution', 'l.resolution_note', 'p.code as payment_code', 'p.amount as payment_amount', 'p.currency as payment_currency', 'p.fx_rate as payment_fx', 'p.status as payment_status', 'p.reference as payment_reference', 'b.code as reservation_code', 'x.code as payable_code', 'x.amount as payable_amount', 'x.currency as payable_currency', 'x.fx_rate as payable_fx', 'x.concept as payable_concept', 'v.name as provider_name', 'c.code as closure_code', 'u.name as resolved_by'])
            ->map(function (object $row): array {
                $match = match (true) {
                    $row->payment_code !== null => [
                        'kind' => 'payment',
                        'code' => $row->payment_code,
                        'label' => trim(($row->reservation_code ?? '').' · '.($row->payment_reference ?? ''), ' ·'),
                        'amount' => (float) $row->payment_amount,
                        'currency' => $row->payment_currency,
                        'pen' => $this->money->pen($row->payment_amount, $row->payment_currency, $row->payment_fx),
                        'status' => $row->payment_status,
                    ],
                    $row->payable_code !== null => [
                        'kind' => 'payable',
                        'code' => $row->payable_code,
                        'label' => trim(($row->provider_name ?? '').' · '.($row->payable_concept ?? ''), ' ·'),
                        'amount' => (float) $row->payable_amount,
                        'currency' => $row->payable_currency,
                        'pen' => $this->money->pen($row->payable_amount, $row->payable_currency, $row->payable_fx),
                        'status' => null,
                    ],
                    default => null,
                };
                $amount = (float) $row->amount;

                return [
                    'code' => $row->code,
                    'bank' => $row->bank,
                    'date' => $row->value_date,
                    'description' => $row->description,
                    'amount' => $amount,
                    'currency' => $row->currency,
                    'status' => $row->status,
                    'resolution' => $row->resolution ? (self::RESOLUTIONS[$row->resolution] ?? $row->resolution) : null,
                    'note' => $row->resolution_note,
                    'match' => $match,
                    'difference' => $match ? round(abs($amount) - $match['pen'], 2) : null,
                    'closure' => $row->closure_code,
                    'resolved_by' => $row->resolved_by,
                ];
            })->values();

        $open = $rows->whereNull('closure');

        return [
            'rows' => $rows,
            'kpis' => [
                'pending' => $open->where('status', 'pendiente')->count(),
                'suggested' => $open->where('status', 'sugerido')->count(),
                'exceptions' => $open->where('status', 'excepcion')->count(),
                'reconciled' => $open->where('status', 'conciliado')->count(),
                'credits_pen' => round($open->where('amount', '>', 0)->sum('amount'), 2),
                'debits_pen' => round(abs($open->where('amount', '<', 0)->sum('amount')), 2),
                'progress' => $open->count() > 0 ? round($open->where('status', 'conciliado')->count() / $open->count() * 100) : 100,
            ],
            'closures' => DB::table('fin_reconciliation_closures')->orderByDesc('closed_at')->get(['code', 'period', 'closed_at', 'lines_count', 'credits', 'debits', 'net']),
            'can' => ['operate' => $viewer->can('finance.payments.register')],
        ];
    }
}
