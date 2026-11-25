<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments\Adapters;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentEvent;
use App\Domain\Integrations\Data\PaymentRequest;
use App\Domain\Integrations\Data\PaymentWebhook;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Str;

final class MercadoPagoGateway extends GatewayAdapter
{
    public const API = 'https://api.mercadopago.com';

    public const SCRIPT = 'https://sdk.mercadopago.com/js/v2';

    private const SIGNATURE_WINDOW_SECONDS = 600;

    private const MESSAGES = [
        'cc_rejected_insufficient_amount' => 'Fondos insuficientes. Prueba con otra tarjeta u otro medio de pago.',
        'cc_rejected_bad_filled_security_code' => 'El código de seguridad no es correcto. Revísalo y vuelve a intentarlo.',
        'cc_rejected_bad_filled_date' => 'La fecha de vencimiento no es correcta. Revísala y vuelve a intentarlo.',
        'cc_rejected_bad_filled_card_number' => 'El número de tarjeta no es correcto. Revísalo y vuelve a intentarlo.',
        'cc_rejected_bad_filled_other' => 'Revisa los datos de la tarjeta y vuelve a intentarlo.',
        'cc_rejected_call_for_authorize' => 'Tu banco pide que autorices este pago. Llámalo y vuelve a intentarlo, o usa otra tarjeta.',
        'cc_rejected_card_disabled' => 'La tarjeta no está activa. Llama a tu banco o usa otra tarjeta.',
        'cc_rejected_duplicated_payment' => 'Ya hiciste un pago por el mismo monto. Si necesitas pagar otra vez, usa otra tarjeta.',
        'cc_rejected_high_risk' => 'El pago fue rechazado por seguridad. Usa otra tarjeta u otro medio de pago.',
        'cc_rejected_max_attempts' => 'Llegaste al límite de intentos con esta tarjeta. Usa otra tarjeta.',
        'cc_rejected_blacklist' => 'El pago fue rechazado por seguridad. Usa otra tarjeta u otro medio de pago.',
    ];

    public function createCharge(PaymentRequest $request): AdapterResult
    {
        if ($request->currency !== $this->account->currency) {
            return $this->declined('moneda', 'Esta cuenta de Mercado Pago cobra en '.$this->account->currency.'. Elige otro medio de pago.');
        }

        if ($request->method === 'session') {
            return $this->session($this->sessionId('MP'), [
                'script' => self::SCRIPT,
                'public_key' => $this->account->secret('public_key'),
                'amount' => $request->amount,
                'currency' => $request->currency,
                'email' => $request->customerEmail,
            ]);
        }

        $form = $this->decodeToken((string) ($request->metadata['card_token'] ?? ''));
        $token = (string) ($form['token'] ?? '');

        if ($token === '' || ! isset($form['payment_method_id'])) {
            return $this->declined('token_invalido', 'No recibimos los datos de la tarjeta. Vuelve a ingresarlos.');
        }

        return $this->call(function () use ($request, $form, $token): AdapterResult {
            $identification = (array) ($form['payer']['identification'] ?? []);
            $response = $this->client((string) Str::uuid())->post(self::API.'/v1/payments', array_filter([
                'transaction_amount' => (float) $request->amount,
                'token' => $token,
                'description' => mb_substr('Pago '.$request->reference, 0, 120),
                'installments' => max(1, (int) ($form['installments'] ?? 1)),
                'payment_method_id' => (string) $form['payment_method_id'],
                'issuer_id' => isset($form['issuer_id']) && $form['issuer_id'] !== '' ? (int) $form['issuer_id'] : null,
                'payer' => array_filter(['email' => $request->customerEmail, 'identification' => isset($identification['type'], $identification['number']) ? ['type' => (string) $identification['type'], 'number' => (string) $identification['number']] : null]),
                'external_reference' => $request->reference,
                'notification_url' => $this->notificationUrl(),
                'metadata' => $this->metadata([...$request->metadata, 'reference' => $request->reference]),
                'binary_mode' => true,
            ], fn ($value) => $value !== null));

            if ($response->serverError()) {
                return AdapterResult::transient(self::UNREACHABLE);
            }

            $payment = (array) $response->json();
            $status = (string) ($payment['status'] ?? '');
            $detail = (string) ($payment['status_detail'] ?? '');
            $last4 = isset($payment['card']['last_four_digits']) ? (string) $payment['card']['last_four_digits'] : null;

            return match (true) {
                $response->successful() && $status === 'approved' => $this->approved((string) $payment['id'], $last4),
                $response->successful() && in_array($status, ['in_process', 'pending'], true) => $this->declined('en_revision', 'Mercado Pago está revisando el pago. Te avisaremos por correo cuando se confirme.', $last4),
                $response->successful() => $this->declined($detail !== '' ? $detail : 'rechazado', self::MESSAGES[$detail] ?? null, $last4),
                default => $this->declined('datos', 'Revisa los datos de la tarjeta y vuelve a intentarlo.'),
            };
        });
    }

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult
    {
        return $this->call(function () use ($externalId, $amount): AdapterResult {
            $response = $this->client((string) Str::uuid())->post(self::API.'/v1/payments/'.rawurlencode($externalId).'/refunds', ['amount' => (float) $amount]);

            return $response->successful()
                ? AdapterResult::success('reembolsado', (string) $response->json('id'), ['payment' => $externalId])
                : AdapterResult::permanent((string) ($response->json('message') ?? 'Mercado Pago no aceptó el reembolso.'));
        });
    }

    public function webhook(PaymentWebhook $hook): ?PaymentEvent
    {
        $body = $hook->json();
        $type = (string) ($hook->query['type'] ?? $hook->query['topic'] ?? $body['type'] ?? '');
        $id = (string) ($hook->query['data.id'] ?? $hook->query['data_id'] ?? $body['data']['id'] ?? '');

        if (! $this->signed($hook, $id)) {
            throw new InvalidWebhookSignature;
        }

        if ($type !== 'payment' || preg_match('/^\d{1,20}$/', $id) !== 1) {
            return null;
        }

        $response = $this->client()->get(self::API.'/v1/payments/'.$id);

        if (! $response->successful()) {
            return null;
        }

        $payment = (array) $response->json();
        $metadata = (array) ($payment['metadata'] ?? []);
        $reference = (string) ($metadata['reference'] ?? $payment['external_reference'] ?? '');
        $status = (string) ($payment['status'] ?? '');
        $kind = match ($status) {
            'approved' => PaymentEvent::APPROVED,
            'rejected', 'cancelled' => PaymentEvent::REJECTED,
            'refunded' => PaymentEvent::REFUNDED,
            'charged_back' => PaymentEvent::CHARGEBACK,
            default => null,
        };

        if ($kind === null || $reference === '') {
            return null;
        }

        $detail = (string) ($payment['status_detail'] ?? '');

        return new PaymentEvent("{$id}:{$status}", $kind, $reference, $metadata['scope'] ?? null, $id, $kind === PaymentEvent::APPROVED ? '00' : ($detail !== '' ? mb_substr($detail, 0, 20) : $status), self::masked(isset($payment['card']['last_four_digits']) ? (string) $payment['card']['last_four_digits'] : null), $kind === PaymentEvent::REJECTED ? (self::MESSAGES[$detail] ?? self::DECLINED) : null);
    }

    public function healthcheck(): AdapterResult
    {
        return $this->call(function (): AdapterResult {
            $response = $this->client()->get(self::API.'/users/me');

            return match (true) {
                $response->successful() => AdapterResult::success('ok', null, ['mode' => $this->account->mode, 'account' => $response->json('nickname')]),
                in_array($response->status(), [401, 403], true) => $this->failedCheck('Mercado Pago rechazó el Access Token. Revisa que sea del modo elegido.'),
                default => $this->failedCheck('Mercado Pago respondió con un error ('.$response->status().'). Intenta de nuevo en unos minutos.'),
            };
        });
    }

    public static function manifest(string $dataId, string $requestId, string $ts): string
    {
        return ($dataId !== '' ? "id:{$dataId};" : '').($requestId !== '' ? "request-id:{$requestId};" : '')."ts:{$ts};";
    }

    private function signed(PaymentWebhook $hook, string $dataId): bool
    {
        $secret = $this->account->secret('webhook_secret');
        $parts = [];

        foreach (explode(',', $hook->header('x-signature')) as $pair) {
            [$key, $value] = array_pad(explode('=', trim($pair), 2), 2, '');
            $parts[strtolower(trim($key))] = trim($value);
        }

        $ts = $parts['ts'] ?? '';
        $v1 = $parts['v1'] ?? '';

        if ($secret === '' || $ts === '' || $v1 === '' || ! ctype_digit($ts)) {
            return false;
        }

        $seconds = strlen($ts) > 10 ? intdiv((int) $ts, 1000) : (int) $ts;

        if (abs(now()->getTimestamp() - $seconds) > self::SIGNATURE_WINDOW_SECONDS) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', self::manifest($dataId, $hook->header('x-request-id'), $ts), $secret), $v1);
    }

    private function notificationUrl(): ?string
    {
        $url = $this->account->webhookUrl;

        return $url !== null && str_starts_with($url, 'https://') && strlen($url) < 500 ? $url : null;
    }

    private function client(?string $idempotency = null): PendingRequest
    {
        $client = $this->http()->withToken($this->account->secret('access_token'));

        return $idempotency === null ? $client : $client->withHeaders(['X-Idempotency-Key' => $idempotency]);
    }
}
