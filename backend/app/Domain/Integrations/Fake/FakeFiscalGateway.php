<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FiscalDocument;
use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Platform\Support\FiscalWebhookSecret;
use Brick\Math\BigDecimal;

final class FakeFiscalGateway implements FiscalGateway
{
    public const NAME = 'sandbox';

    public const SIGNATURE_HEADER = 'X-Fiscal-Signature';

    public array $issued = [];

    public function issue(FiscalDocument $document): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::unavailable('ose')) !== null) {
            return $unavailable;
        }

        if ($document->customerDocNumber === 'TIMEOUT') {
            return AdapterResult::transient('Tiempo de espera agotado (simulado).');
        }
        if (BigDecimal::of($document->totalAmount)->isLessThanOrEqualTo(0)) {
            return AdapterResult::permanent('El total del comprobante debe ser mayor a cero (simulado).');
        }

        $this->issued[] = $document;
        $hash = hash('sha256', $document->series.$document->number.$document->totalAmount);

        return AdapterResult::success('aceptado', 'FAKE-CDR-'.$document->series.'-'.$document->number, [
            'simulated' => true,
            'hash' => $hash,
            'xml' => $this->xml($document, $hash),
            'cdr' => $this->cdr($document),
        ]);
    }

    private function xml(FiscalDocument $document, string $hash): string
    {
        $root = $document->docType === '07' ? 'CreditNote' : 'Invoice';
        $id = $this->id($document);
        $currency = $this->escape($document->currency);
        $lines = '';

        foreach (array_values($document->lines) as $index => $line) {
            $lines .= sprintf(
                "  <cac:%sLine>\n    <cbc:ID>%d</cbc:ID>\n    <cbc:%s unitCode=\"ZZ\">%s</cbc:%s>\n    <cbc:LineExtensionAmount currencyID=\"%s\">%s</cbc:LineExtensionAmount>\n    <cac:TaxTotal><cbc:TaxAmount currencyID=\"%s\">%s</cbc:TaxAmount></cac:TaxTotal>\n    <cac:Item><cbc:Description>%s</cbc:Description></cac:Item>\n    <cac:Price><cbc:PriceAmount currencyID=\"%s\">%s</cbc:PriceAmount></cac:Price>\n  </cac:%sLine>\n",
                $root === 'CreditNote' ? 'CreditNote' : 'Invoice',
                $index + 1,
                $root === 'CreditNote' ? 'CreditedQuantity' : 'InvoicedQuantity',
                $this->escape((string) ($line['qty'] ?? '1')),
                $root === 'CreditNote' ? 'CreditedQuantity' : 'InvoicedQuantity',
                $currency,
                $this->escape((string) BigDecimal::of((string) ($line['total'] ?? '0'))->minus((string) ($line['tax'] ?? '0'))),
                $currency,
                $this->escape((string) ($line['tax'] ?? '0')),
                $this->escape((string) ($line['description'] ?? '')),
                $currency,
                $this->escape((string) ($line['unit_price'] ?? '0')),
                $root === 'CreditNote' ? 'CreditNote' : 'Invoice',
            );
        }

        $reference = $document->referenceDocument === null ? '' : "  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>{$this->escape($document->referenceDocument)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>\n";
        $typeCode = $root === 'Invoice' ? "  <cbc:InvoiceTypeCode listID=\"{$this->escape($document->operationType)}\">{$this->escape($document->docType)}</cbc:InvoiceTypeCode>\n" : '';

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            ."<{$root} xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:{$root}-2\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">\n"
            ."  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>\n"
            ."  <cbc:CustomizationID>2.0</cbc:CustomizationID>\n"
            ."  <cbc:ID>{$id}</cbc:ID>\n"
            ."  <cbc:IssueDate>{$this->escape($document->issueDate)}</cbc:IssueDate>\n"
            .$typeCode
            ."  <cbc:Note>Documento de ejemplo generado por el OSE simulado de KipuControl. Huella {$hash}</cbc:Note>\n"
            ."  <cbc:DocumentCurrencyCode>{$currency}</cbc:DocumentCurrencyCode>\n"
            .$reference
            ."  <cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID=\"{$this->escape($document->customerDocType)}\">{$this->escape($document->customerDocNumber)}</cbc:ID></cac:PartyIdentification><cac:PartyLegalEntity><cbc:RegistrationName>{$this->escape($document->customerName)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>\n"
            ."  <cac:TaxTotal><cbc:TaxAmount currencyID=\"{$currency}\">{$this->escape($document->taxAmount)}</cbc:TaxAmount></cac:TaxTotal>\n"
            ."  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID=\"{$currency}\">{$this->escape($document->taxableAmount)}</cbc:LineExtensionAmount><cbc:PayableAmount currencyID=\"{$currency}\">{$this->escape($document->totalAmount)}</cbc:PayableAmount></cac:LegalMonetaryTotal>\n"
            .$lines
            ."</{$root}>\n";
    }

    private function cdr(FiscalDocument $document): string
    {
        $id = $this->id($document);
        $label = match ($document->docType) {
            '01' => 'Factura',
            '03' => 'Boleta',
            '07' => 'Nota de Crédito',
            '08' => 'Nota de Débito',
            default => 'Comprobante',
        };

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            ."<ar:ApplicationResponse xmlns:ar=\"urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">\n"
            ."  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>\n"
            ."  <cbc:ID>FAKE-CDR-{$id}</cbc:ID>\n"
            ."  <cbc:IssueDate>{$this->escape($document->issueDate)}</cbc:IssueDate>\n"
            ."  <cbc:Note>Constancia de ejemplo del OSE simulado de KipuControl: no tiene validez ante SUNAT.</cbc:Note>\n"
            ."  <cac:DocumentResponse>\n"
            ."    <cac:Response><cbc:ReferenceID>{$id}</cbc:ReferenceID><cbc:ResponseCode>0</cbc:ResponseCode><cbc:Description>La {$label} numero {$id}, ha sido aceptada (simulado)</cbc:Description></cac:Response>\n"
            ."    <cac:DocumentReference><cbc:ID>{$id}</cbc:ID></cac:DocumentReference>\n"
            ."  </cac:DocumentResponse>\n"
            ."</ar:ApplicationResponse>\n";
    }

    private function id(FiscalDocument $document): string
    {
        return $this->escape($document->series.'-'.$document->number);
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    public function status(string $externalId): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::unavailable('ose')) !== null) {
            return $unavailable;
        }

        return AdapterResult::success('aceptado', $externalId, ['simulated' => true]);
    }

    public function void(string $invoiceId, string $reason): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::unavailable('ose')) !== null) {
            return $unavailable;
        }

        return AdapterResult::success('anulado', 'FAKE-BAJA-'.$invoiceId, ['simulated' => true]);
    }

    public function verifyWebhook(string $rawBody, string $signature): bool
    {
        if (IntegrationReadiness::enforced()) {
            return false;
        }

        return $signature !== '' && hash_equals(self::sign($rawBody), $signature);
    }

    public static function sign(string $rawBody): string
    {
        return hash_hmac('sha256', $rawBody, app(FiscalWebhookSecret::class)->secret() ?: (string) config('services.fake_fiscal.secret', 'local-only'));
    }

    public function healthcheck(): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::health('ose')) !== null) {
            return $unavailable;
        }

        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
