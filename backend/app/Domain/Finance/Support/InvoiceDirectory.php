<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class InvoiceDirectory
{
    public const TYPES = ['01' => 'Factura', '03' => 'Boleta', '07' => 'Nota de crédito', '08' => 'Nota de débito'];

    public const CREDIT_REASONS = [
        '01' => 'Anulación de la operación',
        '06' => 'Devolución total',
        '07' => 'Devolución por ítem',
        '09' => 'Disminución en el valor',
        '13' => 'Ajuste de montos o fechas de pago',
    ];

    public function __construct(private readonly Consolidation $money) {}

    public function overview(User $viewer): array
    {
        $credited = DB::table('fin_invoices')->where('doc_type', '07')->where('status', '<>', 'anulado')->whereNotNull('ref_invoice_id')
            ->groupBy('ref_invoice_id')->selectRaw('ref_invoice_id, sum(total_amount) as total')->pluck('total', 'ref_invoice_id');
        $rows = DB::table('fin_invoices as i')
            ->join('booking_reservations as b', 'b.id', '=', 'i.reservation_id')
            ->leftJoin('fin_invoices as r', 'r.id', '=', 'i.ref_invoice_id')
            ->leftJoin('fin_receivables as x', 'x.id', '=', 'i.receivable_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'i.issued_by')
            ->orderByDesc('i.issue_date')
            ->orderByDesc('i.number')
            ->get(['i.id', 'i.number', 'i.doc_type', 'i.issue_date', 'i.customer_name', 'i.customer_doc_type', 'i.customer_doc_number', 'i.customer_domiciled', 'i.operation_type', 'i.currency', 'i.fx_rate', 'i.taxable_amount', 'i.igv_amount', 'i.total_amount', 'i.amount_in_words', 'i.description', 'i.status', 'i.ose_response_message', 'i.credit_note_reason', 'i.delivered_at', 'b.code as reservation_code', 'b.title as reservation_title', 'r.number as ref_number', 'x.code as receivable_code', 'u.name as issued_by'])
            ->map(function (object $row) use ($credited): array {
                $total = (float) $row->total_amount;
                $available = round($total - (float) ($credited[$row->id] ?? 0), 2);

                return [
                    'number' => $row->number,
                    'doc_type' => $row->doc_type,
                    'type' => self::TYPES[$row->doc_type] ?? $row->doc_type,
                    'issue_date' => $row->issue_date,
                    'customer' => ['name' => $row->customer_name, 'doc_type' => $row->customer_doc_type, 'doc_number' => $row->customer_doc_number, 'domiciled' => (bool) $row->customer_domiciled],
                    'operation' => $row->operation_type,
                    'currency' => $row->currency,
                    'fx_rate' => $row->fx_rate !== null ? (float) $row->fx_rate : null,
                    'taxable' => (float) $row->taxable_amount,
                    'igv' => (float) $row->igv_amount,
                    'total' => $total,
                    'pen' => $this->money->pen($total, $row->currency, $row->fx_rate),
                    'in_words' => $row->amount_in_words,
                    'description' => $row->description,
                    'status' => $row->status,
                    'ose_message' => $row->ose_response_message,
                    'credit_reason' => $row->credit_note_reason,
                    'delivered' => $row->delivered_at !== null,
                    'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title],
                    'receivable' => $row->receivable_code,
                    'ref_number' => $row->ref_number,
                    'issued_by' => $row->issued_by,
                    'creditable' => $row->status === 'aceptado' && in_array($row->doc_type, ['01', '03'], true) && $available > ReceivableLedger::TOLERANCE ? $available : 0.0,
                ];
            })->values();

        $month = $rows->where('issue_date', '>=', $this->money->monthStart());

        return [
            'rows' => $rows,
            'kpis' => [
                'month_count' => $month->where('doc_type', '<>', '07')->count(),
                'month_pen' => round($month->where('doc_type', '<>', '07')->sum('pen'), 2),
                'accepted' => $rows->where('status', 'aceptado')->count(),
                'observed' => $rows->whereIn('status', ['observado', 'rechazado'])->count(),
                'credit_notes_pen' => round($rows->where('doc_type', '07')->sum('pen'), 2),
                'uninvoiced_pen' => $this->uninvoiced(),
            ],
            'reasons' => collect(self::CREDIT_REASONS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            'can' => ['issue' => $viewer->can('finance.invoicing')],
        ];
    }

    private function uninvoiced(): float
    {
        $collected = DB::table('fin_payments')->where('status', 'aplicado')->where('kind', 'cobro')->get(['reservation_id', 'amount', 'currency', 'fx_rate'])
            ->groupBy('reservation_id')->map(fn ($items): float => $items->sum(fn (object $row): float => $this->money->pen($row->amount, $row->currency, $row->fx_rate)));
        $invoiced = DB::table('fin_invoices')->whereIn('doc_type', ['01', '03'])->where('status', '<>', 'anulado')->get(['reservation_id', 'total_amount', 'currency', 'fx_rate'])
            ->groupBy('reservation_id')->map(fn ($items): float => $items->sum(fn (object $row): float => $this->money->pen($row->total_amount, $row->currency, $row->fx_rate)));

        return round($collected->map(fn (float $pen, string $reservation): float => max(0, $pen - ($invoiced[$reservation] ?? 0)))->filter(fn (float $gap): bool => $gap > 0.5)->sum(), 2);
    }
}
