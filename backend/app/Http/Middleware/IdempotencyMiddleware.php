<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class IdempotencyMiddleware
{
    private const TTL_HOURS = 24;

    private const LOCK_SECONDS = 60;

    public function __construct(private readonly TenantContext $context)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $key = trim((string) $request->header('Idempotency-Key', ''));

        if ($key === '') {
            throw ApiException::unprocessable('IDEMPOTENCY_KEY_REQUIRED', 'Esta operación requiere el header Idempotency-Key.');
        }
        if (strlen($key) < 8 || strlen($key) > 80) {
            throw ApiException::unprocessable('IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key debe tener entre 8 y 80 caracteres.');
        }

        $hash = $this->requestHash($request);
        $cacheKey = $this->context->key('idem', $key);

        $stored = Cache::get($cacheKey) ?? $this->fromDatabase($key);
        if (is_array($stored)) {
            return $this->replay($stored, $hash, $request);
        }

        $lock = Cache::lock($cacheKey.':lock', self::LOCK_SECONDS);
        if (! $lock->get()) {
            throw ApiException::conflict('IDEMPOTENCY_IN_PROGRESS', 'La misma operación ya se está procesando. Reintente en unos segundos.');
        }

        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            $lock->release();
            throw $e;
        }

        if ($response->isSuccessful()) {
            $record = $this->persist($request, $key, $hash, $response);

            DB::afterCommit(function () use ($cacheKey, $record, $lock): void {
                Cache::put($cacheKey, $record, now()->addHours(self::TTL_HOURS));
                $lock->release();
            });
        } else {
            $lock->release();
        }

        return $response;
    }

    private function requestHash(Request $request): string
    {
        $body = $request->json()->all();
        $this->ksortRecursive($body);

        return hash('sha256', $request->method().' '.$request->path().' '.json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function ksortRecursive(array &$data): void
    {
        ksort($data);
        foreach ($data as &$value) {
            if (is_array($value)) {
                $this->ksortRecursive($value);
            }
        }
    }

    private function fromDatabase(string $key): ?array
    {
        $row = DB::table('sys_idempotency_keys')
            ->where('tenant_id', $this->context->idOrFail())
            ->where('key', $key)
            ->where('status', 'completed')
            ->where('expires_at', '>', now())
            ->first(['request_hash', 'response_code', 'response_body', 'user_id']);

        return $row === null ? null : [
            'hash' => $row->request_hash,
            'status' => (int) $row->response_code,
            'body' => json_decode((string) $row->response_body, true),
            'user_id' => $row->user_id,
        ];
    }

    private function replay(array $stored, string $hash, Request $request): Response
    {
        $sameUser = $stored['user_id'] === null || $stored['user_id'] === $request->user()?->getAuthIdentifier();

        if ($stored['hash'] !== $hash || ! $sameUser) {
            throw ApiException::unprocessable(
                'IDEMPOTENCY_KEY_REUSED',
                'La Idempotency-Key ya se usó con otros datos. Genere una clave nueva para una operación distinta.',
            );
        }

        return new JsonResponse($stored['body'], $stored['status'], ['Idempotent-Replayed' => 'true']);
    }

    private function persist(Request $request, string $key, string $hash, Response $response): array
    {
        $body = json_decode((string) $response->getContent(), true);
        $userId = $request->user()?->getAuthIdentifier();

        DB::table('sys_idempotency_keys')->insert([
            'tenant_id' => $this->context->idOrFail(),
            'key' => $key,
            'user_id' => $userId,
            'method' => $request->method(),
            'path' => substr($request->path(), 0, 250),
            'request_hash' => $hash,
            'status' => 'completed',
            'response_code' => $response->getStatusCode(),
            'response_body' => json_encode($body, JSON_UNESCAPED_UNICODE),
            'expires_at' => Carbon::now()->addHours(self::TTL_HOURS),
        ]);

        return ['hash' => $hash, 'status' => $response->getStatusCode(), 'body' => $body, 'user_id' => $userId];
    }
}
