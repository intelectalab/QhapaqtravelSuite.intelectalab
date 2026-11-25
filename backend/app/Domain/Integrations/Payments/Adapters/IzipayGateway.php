<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments\Adapters;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentEvent;
use App\Domain\Integrations\Data\PaymentRequest;
use App\Domain\Integrations\Data\PaymentWebhook;
use Illuminate\Http\Client\PendingRequest;

final class IzipayGateway extends GatewayAdapter
{
    public const API = 'https://api.micuentaweb.pe/api-payment/V4';

    public const STATIC = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0';

    public function createCharge(PaymentRequest $request): AdapterResult
    {
        if ($request->method === 'session') {
            return $this->call(function () use ($request): AdapterResult {
                $response = $this->client()->post(self::API.'/Charge/CreatePayment', [
                    'amount' => self::cents($request->amount),
                    'currency' => $request->currency,
                    'orderId' => $request->reference,
                    'customer' => ['email' => $request->customerEmail],
                    'metadata' => $this->metadata([...$request->metadata, 'reference' => $request->reference]),
                ]);
                $token = (string) $response->json('answer.formToken', '');

                if (! $response->successful() || $response->json('status') !== 'SUCCESS' || $token === '') {
                    return $response->serverError() ? AdapterResult::transient(self::UNREACHABLE) : AdapterResult::permanent((string) ($response->json('answer.errorMessage') ?? 'Izipay no abrió el formulario de pago. Revisa las credenciales de la pasarela.'));
                }

                return $this->session($this->sessionId('IZI'), [
                    'script' => self::STATIC.'/stable/kr-payment-form.min.js',
                    'theme_css' => self::STATIC.'/ext/classic.css',
                    'theme_js' => self::STATIC.'/ext/classic.js',
                    'public_key' => $this->account->secret('public_key'),
                    'form_token' => $token,
                ]);
            });
        }

        $form = $this->decodeToken((string) ($request->metadata['card_token'] ?? ''));
        $raw = (string) ($form['kr-answer'] ?? '');
        $hash = (string) ($form['kr-hash'] ?? '');

        if ($raw === '' || $hash === '') {
            return $this->declined('token_invalido', 'No recibimos la respuesta de Izipay. Vuelve a intentarlo.');
        }

        if (! self::validHash($raw, $hash, $this->account->secret('hmac_key'))) {
            return $this->declined('firma', 'No pudimos validar la respuesta de Izipay. Vuelve a intentarlo.');
        }

        $answer = (array) json_decode(self::unescape($raw), true);
        $transaction = (array) ($answer['transactions'][0] ?? []);
        $last4 = (string) ($transaction['transactionDetails']['cardDetails']['pan'] ?? '');
        $order = (array) ($answer['orderDetails'] ?? []);

        if ((string) ($order['orderId'] ?? '') !== $request->reference || (int) ($order['orderTotalAmount'] ?? -1) !== self::cents($request->amount) || (string) ($order['orderCurrency'] ?? '') !== $request->currency) {
            return $this->declined('no_coincide', 'La respuesta de Izipay no corresponde a este pago. Vuelve a intentarlo.');
        }

        if (($answer['orderStatus'] ?? '') !== 'PAID' || ! isset($transaction['uuid'])) {
            return $this->declined((string) ($transaction['detailedErrorCode'] ?? $transaction['errorCode'] ?? 'rechazado'), null, $last4);
        }

        return $this->approved((string) $transaction['uuid'], $last4);
    }

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult
    {
        return $this->call(function () use ($externalId, $amount, $currency): AdapterResult {
            $response = $this->client()->post(self::API.'/Transaction/CancelOrRefund', ['uuid' => $externalId, 'amount' => self::cents($amount), 'currency' => $currency, 'resolutionMode' => 'AUTO']);

            return $response->successful() && $response->json('status') === 'SUCCESS'
                ? AdapterResult::success('reembolsado', (string) ($response->json('answer.uuid') ?? $externalId), ['detail' => $response->json('answer.detailedStatus')])
                : AdapterResult::permanent((string) ($response->json('answer.errorMessage') ?? 'Izipay no aceptó la anulación o el reembolso.'));
        });
    }

    public function webhook(PaymentWebhook $hook): ?PaymentEvent
    {
        $raw = (string) ($hook->form['kr-answer'] ?? '');

        if ($raw === '' || ! self::validHash($raw, (string) ($hook->form['kr-hash'] ?? ''), $this->account->secret('password'))) {
            throw new InvalidWebhookSignature;
        }

        $answer = (array) json_decode(self::unescape($raw), true);
        $transaction = (array) ($answer['transactions'][0] ?? []);
        $metadata = (array) ($transaction['metadata'] ?? $answer['metadata'] ?? []);
        $reference = (string) ($metadata['reference'] ?? $answer['orderDetails']['orderId'] ?? '');
        $status = (string) ($answer['orderStatus'] ?? '');
        $uuid = (string) ($transaction['uuid'] ?? '');

        if ($reference === '' || $uuid === '' || ! in_array($status, ['PAID', 'UNPAID'], true)) {
            return null;
        }

        $kind = $status === 'PAID' ? PaymentEvent::APPROVED : PaymentEvent::REJECTED;

        return new PaymentEvent("{$uuid}:{$status}", $kind, $reference, $metadata['scope'] ?? null, $uuid, $kind === PaymentEvent::APPROVED ? '00' : (string) ($transaction['detailedErrorCode'] ?? $transaction['errorCode'] ?? 'rechazado'), self::masked((string) ($transaction['transactionDetails']['cardDetails']['pan'] ?? '')), $kind === PaymentEvent::REJECTED ? self::DECLINED : null);
    }

    public function healthcheck(): AdapterResult
    {
        return $this->call(function (): AdapterResult {
            $response = $this->client()->post(self::API.'/Charge/SDKTest', ['value' => 'kipucontrol']);

            return match (true) {
                $response->successful() && $response->json('status') === 'SUCCESS' => AdapterResult::success('ok', null, ['mode' => $this->account->mode]),
                $response->status() === 401 || $response->json('status') === 'ERROR' => $this->failedCheck('Izipay rechazó el usuario o la contraseña. Revisa que sean del modo elegido.'),
                default => $this->failedCheck('Izipay respondió con un error ('.$response->status().'). Intenta de nuevo en unos minutos.'),
            };
        });
    }

    public static function sign(string $raw, string $key): string
    {
        return hash_hmac('sha256', self::unescape($raw), $key);
    }

    private static function validHash(string $raw, string $hash, string $key): bool
    {
        return $key !== '' && $hash !== '' && hash_equals(self::sign($raw, $key), strtolower($hash));
    }

    private static function unescape(string $raw): string
    {
        return str_replace('\/', '/', $raw);
    }

    private function client(): PendingRequest
    {
        return $this->http()->withBasicAuth($this->account->secret('shop_id'), $this->account->secret('password'));
    }
}
