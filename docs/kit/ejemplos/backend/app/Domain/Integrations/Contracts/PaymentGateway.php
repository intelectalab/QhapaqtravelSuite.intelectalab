<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentRequest;

/**
 * Pasarela de pagos (spec 15 checkout, spec 08 e-commerce, spec 13 facturación SaaS; D-02 por definir).
 * La tarjeta NUNCA toca el backend: tokenización en el iframe/SDK de la pasarela (PCI-DSS SAQ-A).
 * El resultado definitivo llega por webhook (`verifyWebhook` + idempotencia por id de evento).
 */
interface PaymentGateway extends HealthCheckable
{
    /** Crea la intención de cobro; `payload.redirect_url` o `payload.client_secret` según la pasarela. */
    public function createCharge(PaymentRequest $request): AdapterResult;

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult;

    /** Verifica la firma del webhook (`providerSignature` en el contrato) en tiempo constante. */
    public function verifyWebhook(string $rawBody, string $signature): bool;
}
