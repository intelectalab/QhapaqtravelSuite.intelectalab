<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Adapters;

use App\Domain\Integrations\Contracts\PushSender;
use App\Domain\Integrations\Data\AdapterResult;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

final class ExpoPushSender implements PushSender
{
    public const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    private const BATCH = 100;

    public function send(array $tokens, string $title, string $body, array $data = []): AdapterResult
    {
        $tokens = array_values(array_filter($tokens, fn (mixed $token): bool => is_string($token) && preg_match('/^Expo(nent)?PushToken\[.+\]$/', $token) === 1));
        if ($tokens === []) {
            return AdapterResult::permanent('No hay tokens de Expo válidos.');
        }

        $errors = [];
        foreach (array_chunk($tokens, self::BATCH) as $chunk) {
            $messages = array_map(fn (string $token): array => ['to' => $token, 'title' => $title, 'body' => $body, 'data' => (object) $data, 'sound' => 'default', 'priority' => 'high'], $chunk);
            try {
                $response = Http::timeout(10)->acceptJson()->asJson()->post(self::ENDPOINT, $messages);
            } catch (ConnectionException $e) {
                return AdapterResult::transient('No pudimos comunicarnos con Expo: '.$e->getMessage());
            }
            if ($response->serverError() || $response->status() === 429) {
                return AdapterResult::transient("Expo respondió {$response->status()}.");
            }
            foreach ((array) $response->json('data', []) as $ticket) {
                if (($ticket['status'] ?? null) === 'error') {
                    $errors[] = (string) ($ticket['message'] ?? 'error');
                }
            }
        }

        return $errors === [] ? AdapterResult::success('enviado', null, ['tokens' => count($tokens)]) : AdapterResult::success('enviado_con_errores', null, ['tokens' => count($tokens), 'errors' => array_slice($errors, 0, 5)]);
    }

    public function healthcheck(): AdapterResult
    {
        try {
            $response = Http::timeout(5)->acceptJson()->asJson()->post(self::ENDPOINT, []);
        } catch (ConnectionException) {
            return AdapterResult::transient('No pudimos comunicarnos con Expo.');
        }

        return $response->serverError() ? AdapterResult::transient("Expo respondió {$response->status()}.") : AdapterResult::success('ok');
    }
}
