<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

use App\Domain\Documents\Support\AgencyLetterhead;
use App\Domain\Documents\Support\DocumentDraft;
use App\Domain\Documents\Support\DocumentFormat;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class CorporateStatementSheet
{
    public const DOC_TYPE = 'estado_cuenta_corporativo';

    public function __construct(private readonly AgencyLetterhead $agency) {}

    public function draft(object $statement): DocumentDraft
    {
        $account = DB::table('crm_corporate_accounts as a')->join('crm_clients as c', 'c.id', '=', 'a.client_id')
            ->where('a.id', $statement->account_id)->first(['a.credit_days', 'c.code', 'c.name', 'c.doc_type', 'c.doc_number', 'c.owner_id']);
        $advisor = $account?->owner_id ? DB::table('iam_users')->where('id', $account->owner_id)->first(['name', 'email']) : null;
        $currency = (string) $statement->currency;
        $start = CarbonImmutable::parse((string) $statement->period_start);
        $label = ucfirst(CorporatePeriod::MONTHS[$start->month - 1]).' '.$start->year;
        $lines = array_values(array_filter((array) json_decode((string) $statement->lines, true), 'is_array'));

        $data = [
            'agency' => $this->agency->current(),
            'document' => ['kind' => 'Estado de cuenta', 'code' => (string) $statement->code, 'reference' => (string) $statement->code],
            'client' => ['name' => (string) ($account->name ?? ''), 'doc' => trim(($account->doc_type ?? '').' '.($account->doc_number ?? '')), 'code' => (string) ($account->code ?? '')],
            'period' => $label,
            'range' => DocumentFormat::range((string) $statement->period_start, (string) $statement->period_end),
            'status' => (string) $statement->status,
            'totals' => [
                ['label' => 'Saldo inicial', 'value' => DocumentFormat::money((string) $statement->opening_balance, $currency)],
                ['label' => '(+) Compras', 'value' => DocumentFormat::money((string) $statement->charges, $currency)],
                ['label' => '(−) Pagos', 'value' => DocumentFormat::money((string) $statement->payments, $currency)],
                ['label' => '(−) Notas de crédito', 'value' => DocumentFormat::money((string) $statement->credits, $currency)],
            ],
            'closing' => DocumentFormat::money((string) $statement->closing_balance, $currency),
            'lines' => array_map(fn (array $line): array => [
                'date' => DocumentFormat::date((string) ($line['date'] ?? '')),
                'kind' => CorporateLedger::KINDS[$line['kind'] ?? ''] ?? (string) ($line['kind'] ?? ''),
                'document' => (string) ($line['document'] ?? ''),
                'detail' => (string) ($line['detail'] ?? ''),
                'cost_center' => (string) ($line['cost_center'] ?? '—'),
                'charge' => (float) ($line['charge'] ?? 0) > 0 ? DocumentFormat::money((string) $line['charge'], $currency) : '',
                'credit' => (float) ($line['credit'] ?? 0) > 0 ? DocumentFormat::money((string) $line['credit'], $currency) : '',
            ], $lines),
            'terms' => 'Condición de pago: crédito de '.(int) ($account->credit_days ?? 0).' días desde la emisión del comprobante.'.($advisor ? " Consultas: {$advisor->name} · {$advisor->email}." : ''),
        ];

        return new DocumentDraft(self::DOC_TYPE, 'fin_corporate_statements', (string) $statement->id, 'documents.corporate-statement', "Estado de cuenta {$statement->code}", "{$statement->code}.pdf", $data);
    }
}
