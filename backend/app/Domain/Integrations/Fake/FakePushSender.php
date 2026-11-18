<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\PushSender;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Support\IntegrationReadiness;
use Illuminate\Support\Facades\Log;

final class FakePushSender implements PushSender
{
    public const UNREGISTERED = 'NoRegistrado';

    private static array $sent = [];

    public function send(array $tokens, string $title, string $body, array $data = []): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::unavailable('push')) !== null) {
            return $unavailable;
        }

        self::$sent[] = ['tokens' => array_values($tokens), 'title' => $title, 'body' => $body, 'data' => $data];
        Log::info('Push simulado', ['tokens' => count($tokens), 'title' => $title]);
        $tickets = array_map(fn (string $token): array => ['token' => $token, 'id' => self::ticket($token, $title), 'status' => 'ok', 'error' => null], array_values(array_map('strval', $tokens)));

        return AdapterResult::success('enviado', null, ['simulated' => true, 'tokens' => count($tokens), 'tickets' => $tickets]);
    }

    public function receipts(array $ticketIds): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::unavailable('push')) !== null) {
            return $unavailable;
        }

        $receipts = [];

        foreach ($ticketIds as $id) {
            $receipts[(string) $id] = str_contains((string) $id, self::UNREGISTERED)
                ? ['status' => 'error', 'error' => 'DeviceNotRegistered', 'message' => 'El dispositivo ya no está registrado.']
                : ['status' => 'ok', 'error' => null, 'message' => null];
        }

        return AdapterResult::success('ok', null, ['simulated' => true, 'receipts' => $receipts]);
    }

    public function healthcheck(): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::health('push')) !== null) {
            return $unavailable;
        }

        return AdapterResult::success('ok', null, ['simulated' => true]);
    }

    public static function sent(): array
    {
        return self::$sent;
    }

    public static function reset(): void
    {
        self::$sent = [];
    }

    private static function ticket(string $token, string $title): string
    {
        $base = 'SIM-'.substr(hash('sha256', $token.$title.microtime(true).random_int(0, PHP_INT_MAX)), 0, 24);

        return str_contains($token, self::UNREGISTERED) ? $base.'-'.self::UNREGISTERED : $base;
    }
}
