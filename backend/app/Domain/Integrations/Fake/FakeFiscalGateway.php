<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FiscalDocument;
use App\Domain\Platform\Support\FiscalWebhookSecret;
use Brick\Math\BigDecimal;

final class FakeFiscalGateway implements FiscalGateway
{
    public const NAME = 'sandbox';

    public const SIGNATURE_HEADER = 'X-Fiscal-Signature';

    public array $issued = [];

    public function issue(FiscalDocument $document): AdapterResult
    {
        if ($document->customerDocNumber === 'TIMEOUT') {
            return AdapterResult::transient('Tiempo de espera agotado (simulado).');
        }
        if (BigDecimal::of($document->totalAmount)->isLessThanOrEqualTo(0)) {
            return AdapterResult::permanent('El total del comprobante debe ser mayor a cero (simulado).');
        }

        $this->issued[] = $document;

        return AdapterResult::success('aceptado', 'FAKE-CDR-'.$document->series.'-'.$document->number, [
            'simulated' => true,
            'hash' => hash('sha256', $document->series.$document->number.$document->totalAmount),
        ]);
    }

    public function status(string $externalId): AdapterResult
    {
        return AdapterResult::success('aceptado', $externalId, ['simulated' => true]);
    }

    public function void(string $invoiceId, string $reason): AdapterResult
    {
        return AdapterResult::success('anulado', 'FAKE-BAJA-'.$invoiceId, ['simulated' => true]);
    }

    public function verifyWebhook(string $rawBody, string $signature): bool
    {
        return $signature !== '' && hash_equals(self::sign($rawBody), $signature);
    }

    public static function sign(string $rawBody): string
    {
        return hash_hmac('sha256', $rawBody, app(FiscalWebhookSecret::class)->secret() ?: (string) config('services.fake_fiscal.secret', 'local-only'));
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
