<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

/**
 * Comprobante a emitir por OSE/PSE (spec 07; tablas fin_invoices / fin_invoice_lines / fin_document_series).
 * Montos como string decimal. `customerDocType` usa los valores del CHECK de fin_invoices
 * (RUC, DNI, PASAPORTE, CE, SIN_DOC); el adaptador los mapea al Catálogo 06 de SUNAT.
 */
final readonly class FiscalDocument
{
    /** @param list<array{description:string,qty:string,unit_price:string,tax:string,total:string}> $lines */
    public function __construct(
        public string $invoiceId,
        public string $docType,        // fin_invoices.doc_type: '01' factura, '03' boleta, '07' nota de crédito, '08' nota de débito
        public string $operationType,  // fin_invoices.operation_type: gravada | exportacion (H-01: validar con contador)
        public string $series,
        public string $number,
        public string $issueDate,
        public string $customerDocType,
        public string $customerDocNumber,
        public string $customerName,
        public string $currency,
        public string $taxableAmount,
        public string $taxAmount,
        public string $totalAmount,
        public array $lines,
        public ?string $referenceDocument = null, // NC/ND: comprobante de origen (H-06)
    ) {
    }
}
