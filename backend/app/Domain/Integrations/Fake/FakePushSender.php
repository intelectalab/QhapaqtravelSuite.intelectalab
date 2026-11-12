<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\PushSender;
use App\Domain\Integrations\Data\AdapterResult;
use Illuminate\Support\Facades\Log;

final class FakePushSender implements PushSender
{
    private static array $sent = [];

    public function send(array $tokens, string $title, string $body, array $data = []): AdapterResult
    {
        self::$sent[] = ['tokens' => array_values($tokens), 'title' => $title, 'body' => $body, 'data' => $data];
        Log::info('Push simulado', ['tokens' => count($tokens), 'title' => $title]);

        return AdapterResult::success('enviado', null, ['simulated' => true, 'tokens' => count($tokens)]);
    }

    public function healthcheck(): AdapterResult
    {
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
}
