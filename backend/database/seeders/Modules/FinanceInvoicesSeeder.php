<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Finance\Support\AmountInWords;
use Database\Seeders\Modules\Concerns\SeedsFinance;
use Database\Support\KitSeeds;
use Illuminate\Support\Facades\DB;

final class FinanceInvoicesSeeder
{
    use SeedsFinance;

    private const TYPES = ['Factura' => '01', 'Boleta' => '03', 'Nota de crédito' => '07', 'Nota de débito' => '08'];

    private const DOCS = ['RUC', 'DNI', 'PASAPORTE', 'CE'];

    public function run(): void
    {
        $seeds = collect(KitSeeds::read('invoices'))->sortBy(fn (array $seed): int => self::TYPES[$seed['type']] === '07' ? 1 : 0)->values();
        $issued = [];

        foreach ($seeds as $seed) {
            $reservation = DB::table('booking_reservations')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['resId'])->first(['id']);
            $client = DB::table('crm_clients')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['clientId'])->first(['id', 'name', 'doc_type', 'doc_number', 'country', 'city']);
            if ($reservation === null || $client === null) {
                continue;
            }

            $docType = self::TYPES[$seed['type']];
            [$series, $correlative] = explode('-', $seed['id']);
            $domiciled = ($client->country ?? 'Perú') === 'Perú';
            $total = round((float) $seed['amount'], 2);
            $taxable = $domiciled ? round($total / 1.18, 2) : $total;
            $date = $this->day($seed['date']);
            $issuer = $this->userId('U08');
            $reference = $docType === '07' ? collect($issued)->first(fn (array $row): bool => $row['client'] === $seed['clientId']) : null;
            $receivableId = DB::table('fin_receivables')->where('tenant_id', $this->tenant->getKey())->where('reservation_id', $reservation->id)->where('amount', $total)->value('id');

            $id = $this->upsert('fin_invoices', ['number' => $seed['id']], [
                'doc_type' => $docType,
                'series' => $series,
                'correlative' => (int) $correlative,
                'issue_date' => $date,
                'period' => substr((string) $date, 0, 7),
                'client_id' => $client->id,
                'customer_doc_type' => in_array($client->doc_type, self::DOCS, true) ? $client->doc_type : 'SIN_DOC',
                'customer_doc_number' => $client->doc_number ?? '-',
                'customer_name' => $client->name,
                'customer_address' => trim(($client->city ? $client->city.', ' : '').($client->country ?? '')) ?: null,
                'customer_domiciled' => $domiciled,
                'reservation_id' => $reservation->id,
                'receivable_id' => $docType === '07' ? null : $receivableId,
                'operation_type' => $domiciled ? 'gravada' : 'exportacion',
                'sunat_operation_code' => $domiciled ? '0101' : '0201',
                'currency' => $seed['currency'],
                'fx_rate' => $this->fxFor($seed['currency']),
                'taxable_amount' => $taxable,
                'igv_amount' => round($total - $taxable, 2),
                'exempt_amount' => 0,
                'total_amount' => $total,
                'amount_in_words' => AmountInWords::of($total, $seed['currency']),
                'description' => $seed['detail'],
                'ref_invoice_id' => $reference['id'] ?? null,
                'credit_note_reason_code' => $docType === '07' ? '01' : null,
                'credit_note_reason' => $docType === '07' ? $seed['detail'] : null,
                'status' => $seed['status'],
                'fiscal_provider' => 'OSE (simulado)',
                'ose_ticket' => 'TCK-'.$correlative,
                'ose_response_code' => $seed['status'] === 'observado' ? '4287' : '0',
                'ose_response_message' => $seed['status'] === 'observado' ? 'El tipo de cambio no coincide con el del día de emisión.' : 'Aceptado por el OSE',
                'ose_responded_at' => $this->moment($seed['date'].' 10:05'),
                'delivered_at' => $seed['status'] === 'aceptado' ? $this->moment($seed['date'].' 10:10') : null,
                'issued_by' => $issuer,
                'created_by' => $issuer,
                'created_at' => $this->moment($seed['date'].' 10:00'),
            ]);
            $issued[] = ['id' => $id, 'client' => $seed['clientId']];

            $this->upsert('fin_invoice_lines', ['invoice_id' => $id, 'line_no' => 1], [
                'description' => $seed['detail'],
                'quantity' => 1,
                'unit_code' => 'ZZ',
                'unit_value' => $taxable,
                'igv_affectation' => $domiciled ? '10' : '40',
                'line_amount' => $taxable,
                'igv_amount' => round($total - $taxable, 2),
            ]);
            $this->history('invoice', $id, 'emitido', 'Comprobante emitido y enviado al OSE', $issuer, $this->moment($seed['date'].' 10:00'));
            $this->history('invoice', $id, $seed['status'], $seed['status'] === 'observado' ? 'Respuesta del OSE con observaciones' : 'Respuesta del OSE', null, $this->moment($seed['date'].' 10:05'));
        }

        foreach (['F001' => '01', 'B001' => '03', 'FC01' => '07', 'BC01' => '07'] as $series => $type) {
            $last = (int) DB::table('fin_invoices')->where('tenant_id', $this->tenant->getKey())->where('series', $series)->max('correlative');
            $this->upsert('fin_document_series', ['series' => $series], ['doc_type' => $type, 'next_number' => $last + 1, 'active' => true]);
        }
    }
}
