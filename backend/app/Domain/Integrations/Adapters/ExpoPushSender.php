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

    public const RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';

    private const BATCH = 100;

    private const RECEIPT_BATCH = 300;

    public function send(array $tokens, string $title, string $body, array $data = []): AdapterResult
    {
        $tokens = array_values(array_filter($tokens, fn (mixed $token): bool => is_string($token) && preg_match('/^Expo(nent)?PushToken\[.+\]$/', $token) === 1));
        if ($tokens === []) {
            return AdapterResult::permanent('No hay tokens de Expo válidos.');
        }

        $errors = [];
        $tickets = [];
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
            foreach (array_values((array) $response->json('data', [])) as $index => $ticket) {
                $tickets[] = ['token' => $chunk[$index] ?? null, 'id' => $ticket['id'] ?? null, 'status' => $ticket['status'] ?? 'error', 'error' => $ticket['details']['error'] ?? null];
                if (($ticket['status'] ?? null) === 'error') {
                    $errors[] = (string) ($ticket['message'] ?? 'error');
                }
            }
        }

        return AdapterResult::success($errors === [] ? 'enviado' : 'enviado_con_errores', null, ['tokens' => count($tokens), 'tickets' => $tickets, ...($errors === [] ? [] : ['errors' => array_slice($errors, 0, 5)])]);
    }

    public function receipts(array $ticketIds): AdapterResult
    {
        $receipts = [];
        foreach (array_chunk(array_values($ticketIds), self::RECEIPT_BATCH) as $chunk) {
            try {
                $response = Http::timeout(10)->acceptJson()->asJson()->post(self::RECEIPTS, ['ids' => $chunk]);
            } catch (ConnectionException $e) {
                return AdapterResult::transient('No pudimos comunicarnos con Expo: '.$e->getMessage());
            }
            if ($response->serverError() || $response->status() === 429) {
                return AdapterResult::transient("Expo respondió {$response->status()}.");
            }
            foreach ((array) $response->json('data', []) as $id => $receipt) {
                $receipts[(string) $id] = ['status' => (string) ($receipt['status'] ?? 'error'), 'error' => $receipt['details']['error'] ?? null, 'message' => $receipt['message'] ?? null];
            }
        }

        return AdapterResult::success('ok', null, ['receipts' => $receipts]);
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
