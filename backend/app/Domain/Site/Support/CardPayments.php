<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Data\PaymentRequest;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;

final class CardPayments
{
    private const SESSION_MINUTES = 30;

    public function __construct(private readonly PaymentGateway $gateway, private readonly TenantContext $context) {}

    public function gatewayName(): string
    {
        return (string) config('integrations.drivers.payments', 'fake');
    }

    public function openSession(string $scope, string $subject, string $amount, string $currency, string $email, ?string $returnUrl): array
    {
        $result = $this->gateway->createCharge(new PaymentRequest($subject, $amount, $currency, 'session', $email, $returnUrl, ['tenant_id' => $this->context->idOrFail(), 'scope' => $scope]));

        if (! $result->ok || $result->externalId === null) {
            throw ApiException::conflict('PAYMENT_GATEWAY_UNAVAILABLE', $result->message ?? 'La pasarela no respondió. Intenta de nuevo en unos minutos.');
        }

        $expires = now()->addMinutes(self::SESSION_MINUTES);
        $payload = rtrim(strtr(base64_encode((string) json_encode(['sid' => $result->externalId, 'tenant' => $this->context->idOrFail(), 'scope' => $scope, 'subject' => $subject, 'amount' => $amount, 'currency' => $currency, 'exp' => $expires->getTimestamp()])), '+/', '-_'), '=');

        return [
            'session_id' => $payload.'.'.$this->sign($payload),
            'gateway_session' => $result->externalId,
            'gateway' => $this->gatewayName(),
            'amount' => $amount,
            'currency' => $currency,
            'expires_at' => $expires->toIso8601String(),
            'three_ds' => $result->payload['three_ds'] ?? null,
            'embed' => $result->payload['embed'] ?? null,
        ];
    }

    public function charge(string $scope, string $subject, string $amount, string $currency, string $email, string $token, ?string $sessionId): array
    {
        $session = null;

        if ($sessionId !== null) {
            $session = $this->session($sessionId);

            if ($session === null || $session['tenant'] !== $this->context->idOrFail() || $session['scope'] !== $scope || $session['subject'] !== $subject || $session['exp'] < now()->getTimestamp()) {
                throw ApiException::unprocessable('PAYMENT_SESSION_INVALID', 'La sesión de pago venció. Vuelve a intentarlo.');
            }

            if ($session['amount'] !== $amount || $session['currency'] !== $currency) {
                throw ApiException::conflict('PAYMENT_SESSION_CHANGED', 'El monto por pagar cambió. Vuelve a intentarlo para ver el nuevo total.');
            }
        }

        $result = $this->gateway->createCharge(new PaymentRequest($subject, $amount, $currency, 'card', $email, null, ['tenant_id' => $this->context->idOrFail(), 'scope' => $scope, 'card_token' => $token, 'session_id' => $session['sid'] ?? null]));

        return [
            'approved' => $result->ok && $result->status === 'aprobado',
            'code' => (string) ($result->payload['code'] ?? ($result->ok ? '00' : '14')),
            'masked' => $result->payload['masked'] ?? null,
            'message' => $result->ok ? 'Aprobado' : ($result->message ?? 'La tarjeta fue rechazada.'),
            'txn' => $result->ok ? $result->externalId : null,
            'three_ds' => $result->payload['three_ds'] ?? null,
        ];
    }

    private function session(string $token): ?array
    {
        $parts = explode('.', $token);

        if (count($parts) !== 2 || ! hash_equals($this->sign($parts[0]), $parts[1])) {
            return null;
        }

        $data = json_decode((string) base64_decode(strtr($parts[0], '-_', '+/')), true);

        return is_array($data) && isset($data['sid'], $data['tenant'], $data['scope'], $data['subject'], $data['amount'], $data['currency'], $data['exp']) ? $data : null;
    }

    private function sign(string $payload): string
    {
        return hash_hmac('sha256', 'payment-session|'.$payload, (string) config('app.key'));
    }
}
