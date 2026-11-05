<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentRequest;
use Illuminate\Support\Str;

/**
 * Pasarela simulada. Resultado según el método/importe para cubrir caminos (spec 15 §3.6, pago rechazado):
 *  - importe terminado en .13  ⇒ rechazado (permanente)          - método 'transfer' ⇒ `pago_por_validar`
 *  - resto                      ⇒ aprobado
 * Los webhooks simulados se firman con HMAC-SHA256 y el secreto local `services.fake_payments.secret`.
 */
final class FakePaymentGateway implements PaymentGateway
{
    /** @var list<PaymentRequest> */
    public array $charges = [];

    public function createCharge(PaymentRequest $request): AdapterResult
    {
        $this->charges[] = $request;

        if (str_ends_with($request->amount, '.13')) {
            return AdapterResult::permanent('Tarjeta rechazada por el emisor (simulado).');
        }

        $status = $request->method === 'transfer' ? 'pago_por_validar' : 'aprobado';

        return AdapterResult::success($status, 'FAKE-PAY-'.Str::upper(Str::random(10)), ['simulated' => true]);
    }

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult
    {
        return AdapterResult::success('reembolsado', 'FAKE-REF-'.$externalId, ['simulated' => true]);
    }

    public function verifyWebhook(string $rawBody, string $signature): bool
    {
        $expected = hash_hmac('sha256', $rawBody, (string) config('services.fake_payments.secret', 'local-only'));

        return hash_equals($expected, $signature);
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
