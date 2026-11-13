<?php

declare(strict_types=1);

namespace App\Domain\Landing\Fake;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Landing\Contracts\PlatformCheckoutGateway;

final class FakePlatformCheckoutGateway implements PlatformCheckoutGateway
{
    public const QR_MINUTES = 10;

    private const DECLINES = ['51' => 'Fondos insuficientes. Prueba con otra tarjeta u otro medio de pago.', '14' => 'La tarjeta no es válida. Revisa el número o usa otro medio de pago.', '05' => 'El emisor rechazó el cobro. Prueba con otro medio de pago.'];

    public function charge(string $reference, string $amount, string $currency, string $method, array $payment): AdapterResult
    {
        return match ($method) {
            'tarjeta' => $this->card((string) ($payment['card_token'] ?? '')),
            'yape', 'plin' => $this->wallet($method, $reference, $payment),
            'paypal' => str_contains(strtoupper((string) ($payment['paypal_order_id'] ?? '')), 'DECLINED') || empty($payment['paypal_order_id'])
                ? new AdapterResult(false, 'rechazado', null, 'permanente', 'PayPal no aprobó el pago. Vuelve a intentarlo o usa otro medio.', ['code' => '05'])
                : AdapterResult::success('aprobado', 'SIM-PP-'.substr(hash('sha256', $reference), 0, 10), ['method_label' => 'PayPal']),
            default => AdapterResult::permanent('Medio de pago no disponible.'),
        };
    }

    private function card(string $token): AdapterResult
    {
        if (preg_match('/^tok_(ok|51|14|05)_(\d{4})$/', $token, $match) !== 1) {
            return new AdapterResult(false, 'rechazado', null, 'permanente', self::DECLINES['14'], ['code' => '14']);
        }

        if ($match[1] !== 'ok') {
            return new AdapterResult(false, 'rechazado', null, 'permanente', self::DECLINES[$match[1]], ['code' => $match[1], 'method_label' => "Tarjeta •••• {$match[2]}"]);
        }

        return AdapterResult::success('aprobado', 'SIM-CARD-'.$match[2].'-'.substr(hash('sha256', $token.microtime()), 0, 8), ['code' => '00', 'method_label' => "Tarjeta •••• {$match[2]}"]);
    }

    private function wallet(string $method, string $reference, array $payment): AdapterResult
    {
        $label = $method === 'yape' ? 'Yape' : 'Plin';
        $code = (string) ($payment['approval_code'] ?? '');

        if ($code === '') {
            return new AdapterResult(false, 'pendiente', 'SIM-QR-'.substr(hash('sha256', $reference.$method), 0, 10), null, "Escanea el código con {$label} para completar el pago.", ['qr' => 'kipucontrol://pago/'.$method.'/'.substr(hash('sha256', $reference), 0, 16), 'expires_at' => now()->addMinutes(self::QR_MINUTES)->toIso8601String(), 'method_label' => $label]);
        }

        if (preg_match('/^\d{6}$/', $code) !== 1 || $code === '000000') {
            return new AdapterResult(false, 'rechazado', null, 'permanente', "{$label} rechazó el código de aprobación. Genera uno nuevo en la app.", ['code' => '05', 'method_label' => $label]);
        }

        return AdapterResult::success('aprobado', 'SIM-'.strtoupper($method).'-'.substr(hash('sha256', $reference.$code), 0, 10), ['method_label' => $label]);
    }
}
