<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

    public const VOID = ['rechazado', 'anulado'];

    public const STATUSES = ['pendiente_envio', 'emitido', 'aceptado', 'observado', 'rechazado', 'anulado'];

    private const SORTS = ['issue_date' => 'i.issue_date', 'number' => 'i.number', 'total' => 'i.total_amount'];

    public function __construct(private readonly Consolidation $money) {}

    public function list(User $viewer, Request $request): array
    {
        $filters = CursorPage::filters($request);
        $credited = $this->credited();

        return CursorPage::respond($request, $this->filtered($this->rows(), $filters), self::SORTS, '-issue_date,-number', fn (object $row): array => $this->row($row, $credited), [
            'kpis' => $this->kpis(),
            'reasons' => $this->reasons(),
            'statuses' => self::STATUSES,
            'can' => ['issue' => $viewer->can('finance.invoicing')],
        ]);
    }

    public function summary(): array
    {
        return ['kpis' => $this->kpis(), 'pending' => $this->pendingReceivables(), 'invoiceable' => $this->invoiceableReceivables()];
    }

    public function find(string $number, User $viewer): array
    {
        $row = $this->rows()->where('i.number', $number)->first() ?? throw ApiException::notFound('El comprobante no existe.');

        return [
            ...$this->row($row, $this->credited()),
            'customer_address' => $row->customer_address,
            'lines' => DB::table('fin_invoice_lines')->where('invoice_id', $row->id)->orderBy('line_no')
                ->get(['line_no', 'description', 'quantity', 'unit_code', 'unit_value', 'igv_affectation', 'line_amount', 'igv_amount']),
            'fiscal_events' => DB::table('fin_fiscal_events')->where('invoice_id', $row->id)->orderBy('created_at')
                ->get(['action', 'attempt', 'response_code', 'response_message', 'status', 'created_at']),
            'history' => DB::table('fin_status_history as h')->leftJoin('iam_users as u', 'u.id', '=', 'h.user_id')
                ->where('h.entity_type', 'invoice')->where('h.entity_id', $row->id)->orderBy('h.created_at')
                ->get(['h.status', 'h.note', 'h.created_at', 'u.name as user']),
            'credit_notes' => DB::table('fin_invoices')->where('ref_invoice_id', $row->id)->orderBy('issue_date')->get(['number', 'status', 'total_amount', 'credit_note_reason']),
            'ose_ticket' => $row->ose_ticket,
            'hash' => $row->hash_code,
            'lock_version' => (int) $row->lock_version,
            'reasons' => $this->reasons(),
            'can' => ['issue' => $viewer->can('finance.invoicing')],
        ];
    }

    private function rows(): Builder
    {
        return DB::table('fin_invoices as i')
            ->join('booking_reservations as b', 'b.id', '=', 'i.reservation_id')
            ->leftJoin('fin_invoices as r', 'r.id', '=', 'i.ref_invoice_id')
            ->leftJoin('fin_receivables as x', 'x.id', '=', 'i.receivable_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'i.issued_by')
            ->select(['i.*', 'b.code as reservation_code', 'b.title as reservation_title', 'r.number as ref_number', 'x.code as receivable_code', 'u.name as issued_by_name']);
    }

    private function filtered(Builder $query, array $filters): Builder
    {
        if (isset($filters['type'])) {
            $query->whereIn('i.doc_type', explode(',', $filters['type']));
        }

        if (isset($filters['status'])) {
            $statuses = explode(',', $filters['status']);
            if (array_diff($statuses, self::STATUSES) !== []) {
                throw ApiException::unprocessable('FILTER_INVALID', 'filter[status] admite: '.implode(', ', self::STATUSES).'.');
            }
            $query->whereIn('i.status', $statuses);
        }

        if (isset($filters['client'])) {
            $query->where('i.client_id', DB::table('crm_clients')->where('code', $filters['client'])->value('id'));
        }

        if (isset($filters['reservation'])) {
            $query->where('b.code', $filters['reservation']);
        }

        if (isset($filters['period'])) {
            $query->where('i.period', $filters['period']);
        }

        if (isset($filters['q'])) {
            $term = '%'.mb_strtolower($filters['q']).'%';
            $query->where(fn (Builder $where): Builder => $where->whereRaw('lower(i.number) like ?', [$term])->orWhereRaw('lower(i.customer_name) like ?', [$term])->orWhereRaw('lower(i.customer_doc_number) like ?', [$term]));
        }

        return $query;
    }

    private function row(object $row, Collection $credited): array
    {
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
            'issued_by' => $row->issued_by_name,
            'lock_version' => (int) $row->lock_version,
            'creditable' => $row->status === 'aceptado' && in_array($row->doc_type, ['01', '03'], true) && $available > ReceivableLedger::TOLERANCE ? $available : 0.0,
        ];
    }

    private function credited(): Collection
    {
        return DB::table('fin_invoices')->where('doc_type', '07')->whereNotIn('status', self::VOID)->whereNotNull('ref_invoice_id')
            ->groupBy('ref_invoice_id')->selectRaw('ref_invoice_id, sum(total_amount) as total')->pluck('total', 'ref_invoice_id');
    }

    private function kpis(): array
    {
        $rows = DB::table('fin_invoices')->get(['doc_type', 'status', 'issue_date', 'total_amount', 'currency', 'fx_rate']);
        $month = $rows->where('issue_date', '>=', $this->money->monthStart())->where('doc_type', '<>', '07')->whereNotIn('status', [...self::VOID, 'pendiente_envio']);

        return [
            'month_count' => $month->count(),
            'month_pen' => round($month->sum(fn (object $row): float => $this->money->pen($row->total_amount, $row->currency, $row->fx_rate)), 2),
            'accepted' => $rows->where('status', 'aceptado')->count(),
            'observed' => $rows->where('status', 'observado')->count(),
            'rejected' => $rows->where('status', 'rechazado')->count(),
            'waiting' => $rows->whereIn('status', ['pendiente_envio', 'emitido'])->count(),
            'credit_notes_pen' => round($rows->where('doc_type', '07')->sum(fn (object $row): float => $this->money->pen($row->total_amount, $row->currency, $row->fx_rate)), 2),
            'uninvoiced_pen' => $this->uninvoiced(),
        ];
    }

    private function reasons(): array
    {
        return collect(self::CREDIT_REASONS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all();
    }

    private function pendingReceivables(): array
    {
        $invoiced = DB::table('fin_invoices')->whereNotIn('status', self::VOID)->whereNotNull('receivable_id')->get(['receivable_id', 'doc_type', 'total_amount'])
            ->groupBy('receivable_id')->map(fn (Collection $items): float => $items->sum(fn (object $row): float => ($row->doc_type === '07' ? -1 : 1) * (float) $row->total_amount));

        return DB::table('fin_receivables as x')->join('booking_reservations as b', 'b.id', '=', 'x.reservation_id')->join('crm_clients as c', 'c.id', '=', 'x.client_id')
            ->whereNull('x.deleted_at')->where('x.status', '<>', 'cancelada')->where('x.paid_amount', '>', 0)
            ->orderBy('x.code')->get(['x.id', 'x.code', 'x.concept', 'x.amount', 'x.paid_amount', 'x.currency', 'b.code as reservation_code', 'c.name as client_name'])
            ->map(function (object $row) use ($invoiced): ?array {
                $pending = round((float) $row->paid_amount - (float) ($invoiced[$row->id] ?? 0), 2);

                return $pending > 0.5 ? ['code' => $row->code, 'concept' => $row->concept, 'client' => $row->client_name, 'reservation' => $row->reservation_code, 'currency' => $row->currency, 'paid' => (string) $row->paid_amount, 'pending' => number_format($pending, 2, '.', '')] : null;
            })->filter()->values()->all();
    }

    private function invoiceableReceivables(): array
    {
        $invoiced = DB::table('fin_invoices')->whereNotIn('status', self::VOID)->whereNotNull('receivable_id')->get(['receivable_id', 'doc_type', 'total_amount'])
            ->groupBy('receivable_id')->map(fn (Collection $items): float => $items->sum(fn (object $row): float => ($row->doc_type === '07' ? -1 : 1) * (float) $row->total_amount));

        return DB::table('fin_receivables as x')->join('booking_reservations as b', 'b.id', '=', 'x.reservation_id')->join('crm_clients as c', 'c.id', '=', 'x.client_id')
            ->whereNull('x.deleted_at')->where('x.status', '<>', 'cancelada')
            ->orderByDesc('x.created_at')->limit(500)->get(['x.id', 'x.code', 'x.concept', 'x.kind', 'x.amount', 'x.paid_amount', 'x.currency', 'x.due_date', 'b.code as reservation_code', 'c.name as client_name'])
            ->map(function (object $row) use ($invoiced): ?array {
                $left = round((float) $row->amount - (float) ($invoiced[$row->id] ?? 0), 2);

                return $left > 0.5 ? [
                    'value' => $row->code,
                    'label' => "{$row->code} · {$row->client_name}",
                    'hint' => "{$row->concept} · {$row->reservation_code} · {$row->currency} ".number_format($left, 2, '.', '').((float) $row->paid_amount <= 0 ? ' · sin cobrar' : ''),
                    'kind' => $row->kind,
                    'paid' => (float) $row->paid_amount > 0,
                ] : null;
            })->filter()->values()->all();
    }

    private function uninvoiced(): float
    {
        $collected = DB::table('fin_payments')->where('status', 'aplicado')->where('kind', 'cobro')->get(['reservation_id', 'amount', 'currency', 'fx_rate'])
            ->groupBy('reservation_id')->map(fn ($items): float => $items->sum(fn (object $row): float => $this->money->pen($row->amount, $row->currency, $row->fx_rate)));
        $invoiced = DB::table('fin_invoices')->whereIn('doc_type', ['01', '03'])->whereNotIn('status', self::VOID)->get(['reservation_id', 'total_amount', 'currency', 'fx_rate'])
            ->groupBy('reservation_id')->map(fn ($items): float => $items->sum(fn (object $row): float => $this->money->pen($row->total_amount, $row->currency, $row->fx_rate)));

        return round($collected->map(fn (float $pen, string $reservation): float => max(0, $pen - ($invoiced[$reservation] ?? 0)))->filter(fn (float $gap): bool => $gap > 0.5)->sum(), 2);
    }
}
