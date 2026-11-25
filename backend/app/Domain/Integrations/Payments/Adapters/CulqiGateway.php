<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments\Adapters;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentEvent;
use App\Domain\Integrations\Data\PaymentRequest;
use App\Domain\Integrations\Data\PaymentWebhook;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;

final class CulqiGateway extends GatewayAdapter
{
    public const API = 'https://api.culqi.com/v2';

    public const SCRIPT = 'https://checkout.culqi.com/js/v4';

    private const MESSAGES = [
        'insufficient_funds' => 'Fondos insuficientes. Prueba con otra tarjeta u otro medio de pago.',
        'stolen_card' => 'El banco no autorizó la tarjeta. Usa otro medio de pago.',
        'lost_card' => 'El banco no autorizó la tarjeta. Usa otro medio de pago.',
        'expired_card' => 'La tarjeta está vencida. Prueba con otra tarjeta.',
        'incorrect_cvv' => 'El código de seguridad no es correcto. Revísalo y vuelve a intentarlo.',
        'invalid_cvv' => 'El código de seguridad no es correcto. Revísalo y vuelve a intentarlo.',
        'card_declined' => 'El banco rechazó la tarjeta. Prueba con otra tarjeta u otro medio de pago.',
        'contact_issuer' => 'El banco pide que lo contactes antes de usar la tarjeta. Prueba con otra tarjeta.',
        'issuer_not_available' => 'El banco de la tarjeta no respondió. Intenta de nuevo en unos minutos.',
        'fraudulent' => 'El banco no autorizó la tarjeta. Usa otro medio de pago.',
    ];

    public function createCharge(PaymentRequest $request): AdapterResult
    {
        if ($request->method === 'session') {
            return $this->session($this->sessionId('CUL'), [
                'script' => self::SCRIPT,
                'public_key' => $this->account->secret('public_key'),
                'amount' => self::cents($request->amount),
                'currency' => $request->currency,
                'title' => mb_substr((string) ($request->metadata['title'] ?? 'Pago con tarjeta'), 0, 60),
            ]);
        }

        $token = trim((string) ($request->metadata['card_token'] ?? ''));

        if (preg_match('/^(tkn|crd)_(test|live)_[A-Za-z0-9]+$/', $token) !== 1) {
            return $this->declined('token_invalido', 'No recibimos los datos de la tarjeta. Vuelve a ingresarlos.');
        }

        return $this->call(function () use ($request, $token): AdapterResult {
            $response = $this->client()->post(self::API.'/charges', [
                'amount' => self::cents($request->amount),
                'currency_code' => $request->currency,
                'email' => $request->customerEmail,
                'source_id' => $token,
                'capture' => true,
                'description' => mb_substr('Pago '.$request->reference, 0, 80),
                'metadata' => $this->metadata([...$request->metadata, 'reference' => $request->reference]),
            ]);

            if ($response->status() === 201) {
                $charge = (array) $response->json();

                return $this->approved((string) $charge['id'], (string) ($charge['source']['card_number'] ?? $charge['source']['last_four'] ?? ''), ['reference_code' => $charge['reference_code'] ?? null]);
            }

            if ($response->status() === 200) {
                return $this->declined('3ds', 'Tu banco pide verificar esta compra con un código. Por ahora usa otra tarjeta u otro medio de pago.');
            }

            return $this->failure($response);
        });
    }

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult
    {
        return $this->call(function () use ($externalId, $amount): AdapterResult {
            $response = $this->client()->post(self::API.'/refunds', ['amount' => self::cents($amount), 'charge_id' => $externalId, 'reason' => 'solicitud_comprador']);

            return $response->successful()
                ? AdapterResult::success('reembolsado', (string) $response->json('id'), ['charge' => $externalId])
                : AdapterResult::permanent((string) ($response->json('merchant_message') ?? $response->json('user_message') ?? 'Culqi no aceptó la devolución.'));
        });
    }

    public function webhook(PaymentWebhook $hook): ?PaymentEvent
    {
        $event = $hook->json();
        $data = is_string($event['data'] ?? null) ? (array) json_decode((string) $event['data'], true) : (array) ($event['data'] ?? []);
        $type = (string) ($event['type'] ?? '');
        $chargeId = (string) ($data['charge_id'] ?? (str_starts_with((string) ($data['id'] ?? ''), 'chr_') ? $data['id'] : ''));

        if (preg_match('/^chr_(test|live)_[A-Za-z0-9]+$/', $chargeId) !== 1) {
            return null;
        }

        $response = $this->client()->get(self::API.'/charges/'.$chargeId);

        if (! $response->successful()) {
            return null;
        }

        $charge = (array) $response->json();
        $metadata = (array) ($charge['metadata'] ?? []);
        $reference = (string) ($metadata['reference'] ?? '');

        if ($reference === '') {
            return null;
        }

        $kind = match (true) {
            str_contains($type, 'refund') => PaymentEvent::REFUNDED,
            str_contains($type, 'dispute') || str_contains($type, 'chargeback') => PaymentEvent::CHARGEBACK,
            self::paid($charge) => PaymentEvent::APPROVED,
            default => PaymentEvent::REJECTED,
        };

        return new PaymentEvent("{$chargeId}:{$kind}", $kind, $reference, $metadata['scope'] ?? null, $chargeId, $kind === PaymentEvent::APPROVED ? '00' : (string) ($charge['outcome']['code'] ?? 'rechazado'), self::masked((string) ($charge['source']['card_number'] ?? '')), $kind === PaymentEvent::REJECTED ? (string) ($charge['outcome']['user_message'] ?? self::DECLINED) : null);
    }

    public function healthcheck(): AdapterResult
    {
        return $this->call(function (): AdapterResult {
            $response = $this->client()->get(self::API.'/charges', ['limit' => 1]);

            return match (true) {
                $response->successful() => AdapterResult::success('ok', null, ['mode' => $this->account->mode]),
                in_array($response->status(), [401, 403], true) => $this->failedCheck('Culqi rechazó la llave secreta. Revisa que sea la del modo elegido.'),
                default => $this->failedCheck('Culqi respondió con un error ('.$response->status().'). Intenta de nuevo en unos minutos.'),
            };
        });
    }

    private function client(): PendingRequest
    {
        return $this->http()->withToken($this->account->secret('secret_key'));
    }

    private function failure(Response $response): AdapterResult
    {
        if ($response->serverError()) {
            return AdapterResult::transient(self::UNREACHABLE);
        }

        $error = (array) $response->json();
        $code = (string) ($error['decline_code'] ?? $error['code'] ?? 'rechazado');

        return $this->declined($code, self::MESSAGES[$code] ?? (isset($error['user_message']) ? (string) $error['user_message'] : null));
    }

    private static function paid(array $charge): bool
    {
        $outcome = (string) ($charge['outcome']['type'] ?? $charge['response_code'] ?? '');

        return $outcome === 'venta_exitosa' || in_array(mb_strtolower((string) ($charge['state'] ?? '')), ['exitosa', 'pagada', 'capturada'], true) || ($charge['paid'] ?? false) === true;
    }
}
