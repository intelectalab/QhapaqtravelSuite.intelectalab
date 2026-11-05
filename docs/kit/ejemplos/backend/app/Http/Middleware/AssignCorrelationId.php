<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * correlation_id de la solicitud (spec 00 §9: = header `X-Request-Id`; se genera si falta y se devuelve).
 *
 * - Primer middleware del grupo `api` (antes de auth) para que también los 401/403 lo lleven.
 * - Se publica en Context (Laravel 11+): viaja automáticamente a los jobs despachados durante la solicitud
 *   y aparece en cada línea de log (`Log::withContext`). AuditLogger y el error handler lo leen de aquí.
 * - Columna `audit_events.correlation_id varchar(40)` y `sys_job_runs.correlation_id varchar(40)`: se recorta.
 * - Valor aceptado del cliente solo si es seguro (alfanumérico, guiones, ≤ 40); si no, se genera uno nuevo.
 */
final class AssignCorrelationId
{
    public const HEADER = 'X-Request-Id';

    public function handle(Request $request, Closure $next): Response
    {
        $incoming = (string) $request->header(self::HEADER, '');
        $id = preg_match('/^[A-Za-z0-9._-]{8,40}$/', $incoming) === 1 ? $incoming : (string) Str::uuid7();

        Context::add('correlation_id', $id);
        Log::withContext(['correlation_id' => $id]);
        $request->attributes->set('correlation_id', $id);

        $response = $next($request);
        $response->headers->set(self::HEADER, $id);

        return $response;
    }

    /** Lectura desde cualquier capa (Actions, AuditLogger, jobs). */
    public static function current(): string
    {
        return (string) (Context::get('correlation_id') ?? Str::uuid7());
    }
}
