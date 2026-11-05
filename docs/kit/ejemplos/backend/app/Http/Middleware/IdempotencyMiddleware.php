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

/**
 * Idempotencia de operaciones críticas (spec 00 SEC-BR-16 / RT-22; §3.8 `sys_idempotency_keys`; CONVENCIONES §3).
 *
 * Registro en rutas (alias `idempotent` en bootstrap/app.php), SOLO donde el contrato marca
 * `x-idempotency.mode: required` (convertir cotización, crear reserva, pagos, vouchers, comprobantes, checkout…):
 *   Route::post('quotes/{quote}/convert', …)->middleware('idempotent');
 *
 * Comportamiento:
 *  | Caso                                              | Respuesta                                             |
 *  |---------------------------------------------------|-------------------------------------------------------|
 *  | Sin header                                        | 422 IDEMPOTENCY_KEY_REQUIRED (supuesto F0-26, Pest)   |
 *  | Misma key + mismo cuerpo, ya completada           | La respuesta original (mismo status, p. ej. 201) + header `Idempotent-Replayed: true` |
 *  | Misma key + cuerpo distinto (u otro usuario/ruta) | 422 IDEMPOTENCY_KEY_REUSED                            |
 *  | Misma key en proceso (otra solicitud en curso)    | 409 IDEMPOTENCY_IN_PROGRESS                           |
 *
 * NOTA sobre «cuerpo distinto»: el contrato (`components.parameters.IdempotencyKey`), la spec 00 SEC-BR-16 y la
 * plantilla ConvertQuoteIdempotencyTest fijan **422**; el 409 se reserva para «en proceso». Se sigue el contrato.
 *
 * Almacenamiento:
 *  - Redis `t:{tenant}:idem:{key}` (TTL 24 h): lectura rápida de la respuesta.
 *  - PostgreSQL `sys_idempotency_keys` (UNIQUE (tenant_id, key)): fuente durable. La fila se inserta DENTRO de la
 *    transacción de la solicitud (SetPostgresTenant), así que la respuesta guardada y los datos de negocio se
 *    confirman juntos (no hay ventana en la que exista la reserva pero no la clave).
 *  - El estado `processing` se representa con un lock Redis (visible al instante para otras solicitudes; una fila
 *    sin confirmar no lo sería). En la tabla se escribe `completed`. `failed` = no se guarda nada y se permite
 *    reintentar con la misma key (spec 00 §4): las respuestas 4xx/5xx hacen ROLLBACK y no quedan registradas.
 *  - Job diario de limpieza: `delete from sys_idempotency_keys where expires_at < now()` (índice ix_…_expires_at).
 *
 * Orden: después de SetPostgresTenant (necesita tenant y transacción) y de auth (user_id).
 */
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
        if (strlen($key) < 8 || strlen($key) > 80) { // contrato: minLength 8; columna key varchar(80)
            throw ApiException::unprocessable('IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key debe tener entre 8 y 80 caracteres.');
        }

        $hash = $this->requestHash($request);
        $cacheKey = $this->context->key('idem', $key);

        // 1) Respuesta ya registrada (Redis → PostgreSQL)
        $stored = Cache::get($cacheKey) ?? $this->fromDatabase($key);
        if (is_array($stored)) {
            return $this->replay($stored, $hash, $request);
        }

        // 2) Marca "en proceso" (lock Redis, no bloqueante)
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
            // Redis y liberación del lock solo cuando la transacción de la solicitud confirme.
            DB::afterCommit(function () use ($cacheKey, $record, $lock): void {
                Cache::put($cacheKey, $record, now()->addHours(self::TTL_HOURS));
                $lock->release();
            });
        } else {
            $lock->release(); // 4xx/5xx: no se guarda (estado failed ⇒ se permite reintentar con la misma key)
        }

        return $response;
    }

    /** sha256 del método + ruta + cuerpo JSON canónico (claves ordenadas). Columna request_hash char(64). */
    private function requestHash(Request $request): string
    {
        $body = $request->json()->all();
        $this->ksortRecursive($body);

        return hash('sha256', $request->method().' '.$request->path().' '.json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /** @param array<mixed> $data */
    private function ksortRecursive(array &$data): void
    {
        ksort($data);
        foreach ($data as &$value) {
            if (is_array($value)) {
                $this->ksortRecursive($value);
            }
        }
    }

    /** @return array{hash:string,status:int,body:mixed,user_id:?string}|null */
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

    /** @param array{hash:string,status:int,body:mixed,user_id:?string} $stored */
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

    /** @return array{hash:string,status:int,body:mixed,user_id:?string} */
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
