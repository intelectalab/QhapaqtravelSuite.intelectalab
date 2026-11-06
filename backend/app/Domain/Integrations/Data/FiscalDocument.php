<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class FiscalDocument
{
    public function __construct(
        public string $invoiceId,
        public string $docType,
        public string $operationType,
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
        public ?string $referenceDocument = null,
    ) {}
}
