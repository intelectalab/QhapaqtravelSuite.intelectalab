<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\WhatsappCloud;
use App\Domain\Integrations\Data\AdapterResult;

final class FakeWhatsappCloud implements WhatsappCloud
{
    public function verifyApp(string $appId, string $appSecret, string $apiVersion): AdapterResult
    {
        if (preg_match('/^[0-9]{6,20}$/', $appId) !== 1 || strlen($appSecret) < 16 || str_starts_with($appSecret, 'rechazado')) {
            return AdapterResult::permanent('Meta no reconoció el ID o el secreto de la app.');
        }

        return AdapterResult::success('ok', $appId, ['simulated' => true, 'api_version' => $apiVersion]);
    }

    public function exchangeSignup(string $code, string $appId, string $appSecret): AdapterResult
    {
        if (preg_match('/^[A-Za-z0-9_-]{6,200}$/', $code) !== 1 || str_starts_with($code, 'rechazado')) {
            return AdapterResult::permanent('Meta no aceptó el registro. Vuelve a intentarlo desde «Conectar WhatsApp».');
        }

        $seed = sprintf('%010d', crc32($code));

        return AdapterResult::success('conectado', null, [
            'simulated' => true,
            'access_token' => 'SIMULADO-'.hash('sha256', $appId.$code),
            'waba_id' => '3'.$seed.'0',
            'phone_number_id' => '1'.$seed.'7',
            'display_phone' => '+51 9'.substr($seed, 2, 2).' '.substr($seed, 4, 3).' '.substr($seed, 7, 3),
        ]);
    }

    public function verifyNumber(string $phoneNumberId, string $accessToken): AdapterResult
    {
        if (preg_match('/^[0-9]{5,30}$/', $phoneNumberId) !== 1 || strlen($accessToken) < 20 || str_starts_with($accessToken, 'rechazado')) {
            return AdapterResult::permanent('Meta no aceptó el token o el ID del número.');
        }

        $digits = substr(str_pad($phoneNumberId, 9, '0', STR_PAD_LEFT), -9);

        return AdapterResult::success('ok', $phoneNumberId, ['simulated' => true, 'display_phone' => '+51 '.substr($digits, 0, 3).' '.substr($digits, 3, 3).' '.substr($digits, 6, 3)]);
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
