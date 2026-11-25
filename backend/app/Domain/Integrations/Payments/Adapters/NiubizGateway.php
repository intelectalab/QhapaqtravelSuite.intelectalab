<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments\Adapters;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentEvent;
use App\Domain\Integrations\Data\PaymentRequest;
use App\Domain\Integrations\Data\PaymentWebhook;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use RuntimeException;

final class NiubizGateway extends GatewayAdapter
{
    public const SANDBOX = 'https://apisandbox.vnforappstest.com';

    public const PRODUCTION = 'https://apiprod.vnforapps.com';

    public const SCRIPT_SANDBOX = 'https://static-content-qas.vnforapps.com/env/sandbox/js/checkout.js';

    public const SCRIPT_PRODUCTION = 'https://static-content.vnforapps.com/v2/js/checkout.js';

    private const MESSAGES = [
        '116' => 'Fondos insuficientes. Prueba con otra tarjeta u otro medio de pago.',
        '101' => 'La tarjeta está vencida. Prueba con otra tarjeta.',
        '118' => 'La tarjeta no es válida. Revisa el número o usa otro medio de pago.',
        '180' => 'La tarjeta no es válida. Revisa el número o usa otro medio de pago.',
        '129' => 'El código de seguridad no es correcto. Revísalo y vuelve a intentarlo.',
        '191' => 'El banco no autorizó la tarjeta. Usa otro medio de pago.',
        '201' => 'La tarjeta está vencida. Prueba con otra tarjeta.',
        '263' => 'El banco no autorizó la compra por internet con esta tarjeta. Usa otra tarjeta.',
        '666' => 'El banco no respondió. Intenta de nuevo en unos minutos.',
        '754' => 'El banco no autorizó la tarjeta. Usa otro medio de pago.',
    ];

    public function createCharge(PaymentRequest $request): AdapterResult
    {
        if ($request->method === 'session') {
            return $this->call(function () use ($request): AdapterResult {
                $purchase = $this->purchaseNumber();
                $response = $this->client($this->securityToken())->post($this->base().'/api.ecommerce/v2/ecommerce/token/session/'.$this->merchant(), [
                    'channel' => 'web',
                    'amount' => (float) $request->amount,
                    'antifraud' => [
                        'clientIp' => (string) ($request->metadata['client_ip'] ?? '127.0.0.1'),
                        'merchantDefineData' => ['MDD4' => $request->customerEmail, 'MDD32' => mb_substr($request->customerEmail, 0, 80), 'MDD75' => 'Invitado', 'MDD77' => 0],
                    ],
                ]);
                $key = (string) $response->json('sessionKey', '');

                if (! $response->successful() || $key === '') {
                    return $response->serverError() ? AdapterResult::transient(self::UNREACHABLE) : AdapterResult::permanent('Niubiz no abrió el formulario de pago. Revisa el código de comercio y las credenciales.');
                }

                return $this->session($purchase, [
                    'script' => $this->account->sandbox() ? self::SCRIPT_SANDBOX : self::SCRIPT_PRODUCTION,
                    'session_key' => $key,
                    'merchant_id' => $this->merchant(),
                    'purchase_number' => $purchase,
                    'amount' => $request->amount,
                    'currency' => $request->currency,
                ]);
            });
        }

        $token = trim((string) ($request->metadata['card_token'] ?? ''));
        $purchase = (string) ($request->metadata['session_id'] ?? '');

        if (preg_match('/^[A-Za-z0-9]{16,64}$/', $token) !== 1 || preg_match('/^\d{6,12}$/', $purchase) !== 1) {
            return $this->declined('token_invalido', 'No recibimos los datos de la tarjeta. Vuelve a ingresarlos.');
        }

        return $this->call(function () use ($request, $token, $purchase): AdapterResult {
            $response = $this->client($this->securityToken())->post($this->base().'/api.authorization/v3/authorization/ecommerce/'.$this->merchant(), [
                'channel' => 'web',
                'captureType' => 'manual',
                'countable' => true,
                'order' => ['tokenId' => $token, 'purchaseNumber' => $purchase, 'amount' => (float) $request->amount, 'currency' => $request->currency],
            ]);

            return $this->authorization($response, $purchase);
        });
    }

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult
    {
        [$purchase, $date] = array_pad(explode('-', $externalId, 2), 2, '');

        if ($purchase === '' || preg_match('/^\d{12}$/', $date) !== 1) {
            return AdapterResult::permanent('Falta la fecha de la venta para anularla en Niubiz.');
        }

        return $this->call(function () use ($purchase, $date): AdapterResult {
            $response = $this->client($this->securityToken())->post($this->base().'/api.authorization/v3/reverse/ecommerce/'.$this->merchant(), [
                'channel' => 'web',
                'order' => ['purchaseNumber' => $purchase, 'transactionDate' => $date],
            ]);

            return $response->successful() && $response->json('dataMap.STATUS') === 'Voided'
                ? AdapterResult::success('reembolsado', (string) ($response->json('order.transactionId') ?? $purchase), ['status' => 'Voided'])
                : AdapterResult::permanent((string) ($response->json('data.ACTION_DESCRIPTION') ?? 'Niubiz no aceptó la anulación. Las ventas de días anteriores se devuelven desde el portal de Niubiz.'));
        });
    }

    public function webhook(PaymentWebhook $hook): ?PaymentEvent
    {
        return null;
    }

    public function healthcheck(): AdapterResult
    {
        return $this->call(function (): AdapterResult {
            $response = $this->http()->withBasicAuth($this->account->secret('user'), $this->account->secret('password'))->accept('text/plain')->get($this->base().'/api.security/v1/security');

            if (! $response->successful() || trim($response->body()) === '') {
                return in_array($response->status(), [401, 403], true)
                    ? $this->failedCheck('Niubiz rechazó el usuario o la contraseña. Revisa que sean del modo elegido.')
                    : $this->failedCheck('Niubiz respondió con un error ('.$response->status().'). Intenta de nuevo en unos minutos.');
            }

            return preg_match('/^\d{9,10}$/', $this->merchant()) === 1
                ? AdapterResult::success('ok', null, ['mode' => $this->account->mode])
                : $this->failedCheck('El usuario es válido, pero el código de comercio debe tener 9 dígitos.');
        });
    }

    private function authorization(Response $response, string $purchase): AdapterResult
    {
        if ($response->serverError()) {
            return AdapterResult::transient(self::UNREACHABLE);
        }

        $map = (array) ($response->successful() ? $response->json('dataMap', []) : $response->json('data', []));
        $code = (string) ($map['ACTION_CODE'] ?? '');
        $card = isset($map['CARD']) ? (string) $map['CARD'] : null;

        if ($response->successful() && $code === '000') {
            $date = (string) ($map['TRANSACTION_DATE'] ?? '');

            return $this->approved(preg_match('/^\d{12}$/', $date) === 1 ? "{$purchase}-{$date}" : (string) ($map['TRANSACTION_ID'] ?? $purchase), $card, ['brand' => $map['BRAND'] ?? null]);
        }

        return $this->declined($code !== '' ? $code : 'rechazado', self::MESSAGES[$code] ?? null, $card);
    }

    private function securityToken(): string
    {
        $response = $this->http()->withBasicAuth($this->account->secret('user'), $this->account->secret('password'))->accept('text/plain')->get($this->base().'/api.security/v1/security');
        $token = trim($response->body());

        if (! $response->successful() || $token === '') {
            throw new RuntimeException('Niubiz no entregó el token de seguridad ('.$response->status().').');
        }

        return $token;
    }

    private function client(string $token): PendingRequest
    {
        return $this->http()->withHeaders(['Authorization' => $token]);
    }

    private function base(): string
    {
        return $this->account->sandbox() ? self::SANDBOX : self::PRODUCTION;
    }

    private function merchant(): string
    {
        return $this->account->secret('merchant_id');
    }

    private function purchaseNumber(): string
    {
        return now('America/Lima')->format('ymd').str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}
