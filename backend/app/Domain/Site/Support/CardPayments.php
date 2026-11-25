<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Integrations\Contracts\PaymentConnector;
use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Data\PaymentRequest;
use App\Domain\Integrations\Payments\AgencyPaymentGateways;
use App\Domain\Integrations\Payments\ConnectorCatalog;
use App\Domain\Integrations\Support\AgencyIntegrations;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;

final class CardPayments
{
    private const SESSION_MINUTES = 30;

    public const FAKE_TOKEN = '/^tok_(ok|51|14)_\d{4}$/';

    public function __construct(private readonly AgencyPaymentGateways $gateways, private readonly TenantContext $context) {}

    public function gatewayName(?string $currency = null): string
    {
        return $this->gateways->name($currency);
    }

    public function available(): bool
    {
        return app(AgencyIntegrations::class)->usable('payments');
    }

    public function info(): array
    {
        $account = $this->gateways->account();

        return $account === null
            ? ['provider' => 'sandbox', 'label' => 'Pasarela de prueba', 'mode' => 'sandbox', 'embedded' => false, 'sources' => []]
            : ['provider' => $account->provider, 'label' => ConnectorCatalog::label($account->provider), 'mode' => $account->mode, 'embedded' => true, 'sources' => ConnectorCatalog::sources($account->provider, $account->mode)];
    }

    public function tokenRules(bool $required): array
    {
        return [$required ? 'required' : 'nullable', 'string', 'max:20000', ...($this->gateways->connected() ? [] : ['regex:'.self::FAKE_TOKEN])];
    }

    public function openSession(string $scope, string $subject, string $amount, string $currency, string $email, ?string $returnUrl, array $context = []): array
    {
        $this->assertAvailable();
        $gateway = $this->gateway($currency);
        $result = $gateway->createCharge(new PaymentRequest($subject, $amount, $currency, 'session', $email, $returnUrl, ['tenant_id' => $this->context->idOrFail(), 'scope' => $scope, 'client_ip' => request()->ip(), ...$context]));

        if (! $result->ok || $result->externalId === null) {
            throw ApiException::conflict('PAYMENT_GATEWAY_UNAVAILABLE', $result->message ?? 'La pasarela no respondió. Intenta de nuevo en unos minutos.');
        }

        $expires = now()->addMinutes(self::SESSION_MINUTES);
        $payload = rtrim(strtr(base64_encode((string) json_encode(['sid' => $result->externalId, 'tenant' => $this->context->idOrFail(), 'scope' => $scope, 'subject' => $subject, 'amount' => $amount, 'currency' => $currency, 'exp' => $expires->getTimestamp()])), '+/', '-_'), '=');

        return [
            'session_id' => $payload.'.'.$this->sign($payload),
            'gateway_session' => $result->externalId,
            'gateway' => $this->gatewayName($currency),
            'amount' => $amount,
            'currency' => $currency,
            'expires_at' => $expires->toIso8601String(),
            'three_ds' => $result->payload['three_ds'] ?? null,
            'embed' => $result->payload['embed'] ?? null,
        ];
    }

    public function charge(string $scope, string $subject, string $amount, string $currency, string $email, string $token, ?string $sessionId): array
    {
        $this->assertAvailable();
        $gateway = $this->gateway($currency);
        $session = null;

        if ($sessionId === null && $gateway instanceof PaymentConnector) {
            throw ApiException::unprocessable('PAYMENT_SESSION_INVALID', 'La sesión de pago venció. Vuelve a intentarlo.');
        }

        if ($sessionId !== null) {
            $session = $this->session($sessionId);

            if ($session === null || $session['tenant'] !== $this->context->idOrFail() || $session['scope'] !== $scope || $session['subject'] !== $subject || $session['exp'] < now()->getTimestamp()) {
                throw ApiException::unprocessable('PAYMENT_SESSION_INVALID', 'La sesión de pago venció. Vuelve a intentarlo.');
            }

            if ($session['amount'] !== $amount || $session['currency'] !== $currency) {
                throw ApiException::conflict('PAYMENT_SESSION_CHANGED', 'El monto por pagar cambió. Vuelve a intentarlo para ver el nuevo total.');
            }

            if ($gateway instanceof PaymentConnector && ! Cache::add('payments:session-used:'.hash('sha256', (string) $session['sid']), true, now()->addMinutes(self::SESSION_MINUTES + 5))) {
                throw ApiException::conflict('PAYMENT_SESSION_USED', 'Este intento de pago ya se procesó. Revisa el estado antes de volver a pagar.');
            }
        }

        $result = $gateway->createCharge(new PaymentRequest($subject, $amount, $currency, 'card', $email, null, ['tenant_id' => $this->context->idOrFail(), 'scope' => $scope, 'card_token' => $token, 'session_id' => $session['sid'] ?? null]));

        return [
            'approved' => $result->ok && $result->status === 'aprobado',
            'code' => (string) ($result->payload['code'] ?? ($result->ok ? '00' : ($result->errorClass === 'transitorio' ? 'sin_respuesta' : '14'))),
            'masked' => $result->payload['masked'] ?? null,
            'message' => $result->ok ? 'Aprobado' : ($result->message ?? 'La tarjeta fue rechazada.'),
            'txn' => $result->ok ? $result->externalId : null,
            'three_ds' => $result->payload['three_ds'] ?? null,
        ];
    }

    public function sessionSubject(?string $sessionId, string $scope): ?string
    {
        $session = $sessionId === null ? null : $this->session($sessionId);

        return $session !== null && $session['scope'] === $scope && $session['tenant'] === $this->context->idOrFail() ? (string) $session['subject'] : null;
    }

    private function gateway(string $currency): PaymentGateway
    {
        return $this->gateways->gateway($currency);
    }

    private function assertAvailable(): void
    {
        if (! $this->available()) {
            throw ApiException::conflict('PAYMENT_GATEWAY_UNAVAILABLE', 'El pago con tarjeta no está disponible por ahora. Elige otro medio de pago o escríbele a la agencia.');
        }
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
