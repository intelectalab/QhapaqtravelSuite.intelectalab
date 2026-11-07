<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class InvoiceRules
{
    public const ISSUABLE = ['01', '03'];

    public const DOC_TYPES = ['RUC', 'DNI', 'PASAPORTE', 'CE', 'SIN_DOC'];

    private const RUC = '/^(10|15|17|20)\d{9}$/';

    private const DNI = '/^\d{8}$/';

    private const FOREIGN = '/^[A-Z0-9]{6,12}$/';

    private const IGV_FACTOR = '1.18';

    public function __construct(private readonly Consolidation $money) {}

    public function receivable(string $code, bool $lock = false): object
    {
        $query = DB::table('fin_receivables as x')
            ->join('booking_reservations as r', 'r.id', '=', 'x.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'x.client_id')
            ->whereNull('x.deleted_at')
            ->where('x.code', $code)
            ->select(['x.id', 'x.code', 'x.kind', 'x.concept', 'x.amount', 'x.paid_amount', 'x.currency', 'x.fx_rate', 'x.status', 'x.reservation_id', 'x.client_id', 'r.code as reservation_code', 'r.title as reservation_title', 'c.name as client_name', 'c.doc_type as client_doc_type', 'c.doc_number as client_doc_number', 'c.country as client_country', 'c.email as client_email']);

        return ($lock ? $query->lockForUpdate() : $query)->first()
            ?? throw ApiException::notFound('La cuenta por cobrar no existe.');
    }

    public function invoiced(string $receivableId): BigDecimal
    {
        return DB::table('fin_invoices')->where('receivable_id', $receivableId)->where('status', '<>', 'anulado')->get(['doc_type', 'total_amount'])
            ->reduce(fn (BigDecimal $sum, object $row): BigDecimal => $row->doc_type === '07' ? $sum->minus((string) $row->total_amount) : $sum->plus((string) $row->total_amount), BigDecimal::zero());
    }

    public function maximum(object $receivable): BigDecimal
    {
        $left = BigDecimal::of((string) $receivable->amount)->minus($this->invoiced((string) $receivable->id));

        return $left->isNegative() ? BigDecimal::zero() : Decimal::round2($left);
    }

    public function draft(string $code): array
    {
        $receivable = $this->receivable($code);
        $maximum = $this->maximum($receivable);
        $uninvoicedPaid = BigDecimal::of((string) $receivable->paid_amount)->minus($this->invoiced((string) $receivable->id));
        $amount = $uninvoicedPaid->isPositive() ? BigDecimal::min($uninvoicedPaid, $maximum) : $maximum;
        $docType = $this->customerDocType((string) $receivable->client_doc_type);

        return [
            'receivable' => ['code' => $receivable->code, 'kind' => $receivable->kind, 'concept' => $receivable->concept, 'amount' => (string) $receivable->amount, 'paid' => (string) $receivable->paid_amount, 'status' => $receivable->status],
            'reservation' => ['code' => $receivable->reservation_code, 'title' => $receivable->reservation_title],
            'doc_type' => $docType === 'RUC' ? '01' : '03',
            'customer_doc_type' => $docType,
            'customer_doc_number' => (string) $receivable->client_doc_number,
            'customer_name' => (string) $receivable->client_name,
            'customer_address' => $receivable->client_country,
            'domiciled' => $this->domiciled($receivable->client_country),
            'currency' => $receivable->currency,
            'fx_rate' => $receivable->currency === 'PEN' ? null : (string) ($receivable->fx_rate ?: $this->money->usdRate()),
            'amount' => (string) Decimal::round2($amount),
            'maximum' => (string) $maximum,
            'description' => mb_substr("Servicios turísticos: {$receivable->reservation_title} ({$receivable->concept})", 0, 500),
        ];
    }

    public function check(array $data, object $receivable): array
    {
        $docType = (string) ($data['doc_type'] ?? '');
        $customerDoc = (string) ($data['customer_doc_type'] ?? '');
        $number = mb_strtoupper(trim((string) ($data['customer_doc_number'] ?? '')));
        $amount = is_numeric($data['amount'] ?? null) ? Decimal::round2((string) $data['amount']) : BigDecimal::zero();
        $maximum = $this->maximum($receivable);
        $period = substr($this->money->today(), 0, 7);

        $checks = [
            $this->rule('FIN-BR-39', $docType !== '01' || ($customerDoc === 'RUC' && preg_match(self::RUC, $number) === 1), 'La factura requiere un RUC válido de 11 dígitos.'),
            $this->rule('FIN-BR-40', $docType !== '03' || match ($customerDoc) {
                'DNI' => preg_match(self::DNI, $number) === 1,
                'PASAPORTE', 'CE' => preg_match(self::FOREIGN, $number) === 1,
                'SIN_DOC' => true,
                default => false,
            }, $customerDoc === 'RUC' ? 'Con RUC corresponde emitir factura.' : 'La boleta requiere DNI de 8 dígitos, o pasaporte o carné de extranjería de 6 a 12 caracteres.'),
            $this->rule('FIN-BR-42', trim((string) ($data['customer_name'] ?? '')) !== '' && trim((string) ($data['description'] ?? '')) !== '', 'El nombre del cliente y la descripción son obligatorios.'),
            $this->rule('FIN-BR-43', $amount->isPositive() && $amount->isLessThanOrEqualTo($maximum), "El importe debe ser mayor que cero y no superar lo pendiente de facturar ({$receivable->currency} {$maximum})."),
            $this->rule('FIN-BR-48', ! DB::table('fin_period_closes')->where('period', $period)->where('status', 'cerrado')->exists(), "El periodo {$period} está cerrado: los ajustes van con nota de crédito en el periodo siguiente."),
            $this->rule('FIN-BR-46', in_array($docType, self::ISSUABLE, true) && DB::table('fin_document_series')->where('doc_type', $docType)->where('active', true)->exists(), 'No hay una serie activa para ese tipo de comprobante.'),
        ];

        return ['ok' => collect($checks)->every(fn (array $check): bool => $check['ok']), 'checks' => $checks, 'maximum' => (string) $maximum, ...$this->amounts($amount, (bool) ($data['domiciled'] ?? true), (string) $receivable->currency)];
    }

    public function assert(array $data, object $receivable): array
    {
        $result = $this->check($data, $receivable);
        $failed = collect($result['checks'])->first(fn (array $check): bool => ! $check['ok']);

        if ($failed !== null) {
            throw ApiException::unprocessable($failed['rule'], $failed['message']);
        }

        return $result;
    }

    public function amounts(BigDecimal $total, bool $domiciled, string $currency): array
    {
        $taxable = $domiciled ? $total->dividedBy(self::IGV_FACTOR, 2, RoundingMode::HALF_UP) : $total;

        return [
            'operation_type' => $domiciled ? 'gravada' : 'exportacion',
            'taxable_amount' => (string) $taxable,
            'igv_amount' => (string) $total->minus($taxable),
            'total_amount' => (string) $total,
            'amount_in_words' => AmountInWords::of($total, $currency),
        ];
    }

    public function customerDocType(string $value): string
    {
        $upper = mb_strtoupper(trim($value));

        return in_array($upper, self::DOC_TYPES, true) ? $upper : ($upper === 'PASAPORTE' || $upper === 'PASSPORT' ? 'PASAPORTE' : 'SIN_DOC');
    }

    private function domiciled(?string $country): bool
    {
        $normalized = mb_strtolower(trim((string) $country));

        return $normalized === '' || in_array($normalized, ['perú', 'peru', 'pe'], true);
    }

    private function rule(string $code, bool $ok, string $message): array
    {
        return ['rule' => $code, 'ok' => $ok, 'message' => $ok ? null : $message];
    }
}
