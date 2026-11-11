<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentRequest;
use Illuminate\Support\Str;

final class FakePaymentGateway implements PaymentGateway
{
    public const NAME = 'sandbox';

    public const SIGNATURE_HEADER = 'X-Gateway-Signature';

    private const DECLINES = ['51' => 'Fondos insuficientes. Prueba con otra tarjeta u otro medio de pago.', '14' => 'La tarjeta no es válida. Revisa el número o usa otro medio de pago.'];

    public array $charges = [];

    public function createCharge(PaymentRequest $request): AdapterResult
    {
        $this->charges[] = $request;

        if ($request->method === 'session') {
            return AdapterResult::success('sesion', 'SBX-SES-'.Str::upper(Str::random(16)), ['expires_at' => now()->addMinutes(30)->toIso8601String(), 'three_ds' => 'si_el_emisor_lo_exige', 'embed' => 'sandbox']);
        }

        if ($request->method === 'transfer') {
            return AdapterResult::success('pago_por_validar', 'FAKE-PAY-'.Str::upper(Str::random(10)), ['simulated' => true]);
        }

        $token = (string) ($request->metadata['card_token'] ?? '');

        if (preg_match('/^tok_(ok|51|14)_(\d{4})$/', $token, $match) !== 1) {
            return new AdapterResult(false, 'rechazado', null, 'permanente', self::DECLINES['14'], ['code' => '14', 'masked' => null]);
        }

        $masked = "•••• {$match[2]}";

        if ($match[1] !== 'ok') {
            return new AdapterResult(false, 'rechazado', null, 'permanente', self::DECLINES[$match[1]], ['code' => $match[1], 'masked' => $masked, 'three_ds' => 'autenticado']);
        }

        return AdapterResult::success('aprobado', 'SBX-'.Str::upper(Str::random(12)), ['code' => '00', 'masked' => $masked, 'three_ds' => 'autenticado', 'simulated' => true]);
    }

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult
    {
        return AdapterResult::success('reembolsado', 'FAKE-REF-'.$externalId, ['simulated' => true]);
    }

    public function verifyWebhook(string $rawBody, string $signature): bool
    {
        return $signature !== '' && hash_equals(self::sign($rawBody), $signature);
    }

    public static function sign(string $rawBody): string
    {
        return hash_hmac('sha256', $rawBody, (string) config('services.fake_payments.secret', 'local-only'));
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
