<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Http\Middleware\AssignCorrelationId;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Formato estándar de error de TODA la API (spec 00 §6; contrato `components.schemas.Error` / `ValidationError`).
 *
 *   4xx/5xx: { "error": "FORBIDDEN", "code": "SEC-BR-09", "message": "…", "required_permissions": [...],
 *              "correlation_id": "…", "details": {...} }
 *   422 de campos: { "message": "…", "errors": { "campo": ["mensaje"] }, "code"?: "…", "correlation_id": "…" }
 *
 * Registro en bootstrap/app.php: ->withExceptions(fn (Exceptions $e) => $e->render(new ApiExceptionRenderer()))
 *
 * Reglas:
 *  - 403 y 404 de recursos se auditan como `acceso_denegado` (SEC-BR-07, SEC-BR-02) en transacción propia.
 *  - Nunca se filtran mensajes técnicos (SQL, rutas, trazas) al cliente fuera de APP_DEBUG; el detalle va al log
 *    con el mismo correlation_id.
 *  - Violaciones de constraints conocidas se traducen a 409 (UNIQUE) para no devolver 500 en carreras.
 */
final class ApiExceptionRenderer
{
    public function __invoke(Throwable $e, Request $request): ?JsonResponse
    {
        if (! $request->is('api/*') && ! $request->expectsJson()) {
            return null; // deja el render por defecto (web)
        }

        $cid = AssignCorrelationId::current();

        return match (true) {
            $e instanceof ValidationException => new JsonResponse([
                'message' => 'Los datos enviados no son válidos.',
                'errors' => $e->errors(),
                'correlation_id' => $cid,
            ], 422),

            $e instanceof ApiException => $this->fromApiException($e, $request, $cid),

            $e instanceof UnauthorizedException => $this->forbidden($request, $cid, null,
                'Su rol no tiene el permiso requerido para esta acción.', $e->getRequiredPermissions()),

            $e instanceof AuthorizationException => $this->forbidden($request, $cid, $e->response()?->code() === null ? null : (string) $e->response()->code(),
                $e->getMessage() !== 'This action is unauthorized.' ? $e->getMessage() : 'No tiene acceso a este recurso.'),

            $e instanceof AuthenticationException => $this->error(401, 'UNAUTHENTICATED', null, 'Sesión vencida o no válida. Inicie sesión nuevamente.', $cid),

            $e instanceof ModelNotFoundException, $e instanceof NotFoundHttpException => $this->notFound($request, $cid),

            $e instanceof ThrottleRequestsException => $this->error(429, 'RATE_LIMITED', null, 'Demasiadas solicitudes. Espere un momento.', $cid)
                ->withHeaders($e->getHeaders()),

            $e instanceof QueryException && $e->getCode() === '23505' => $this->error(409, 'CONFLICT', 'UNIQUE_VIOLATION',
                'El registro ya existe o fue creado por otra solicitud al mismo tiempo.', $cid),

            $e instanceof HttpExceptionInterface => $this->error($e->getStatusCode(), 'HTTP_ERROR', null, $e->getMessage() ?: 'Error de solicitud.', $cid),

            default => $this->error(500, 'SERVER_ERROR', null, 'Ocurrió un error inesperado. Código de seguimiento: '.$cid, $cid),
        };
    }

    private function fromApiException(ApiException $e, Request $request, string $cid): JsonResponse
    {
        if ($e->status === 403) {
            return $this->forbidden($request, $cid, $e->ruleCode, $e->getMessage(), $e->requiredPermissions, $e->details);
        }
        if ($e->status === 404) {
            return $this->notFound($request, $cid);
        }
        if ($e->status === 422) {
            // 422 de negocio: mismo esquema ValidationError (`errors` vacío) + `code` de la regla.
            return new JsonResponse(array_filter([
                'message' => $e->getMessage(),
                'code' => $e->ruleCode,
                'errors' => (object) [],
                'details' => $e->details ?: null,
                'correlation_id' => $cid,
            ], fn ($v) => $v !== null), 422);
        }

        return $this->error($e->status, $e->error, $e->ruleCode, $e->getMessage(), $cid, details: $e->details);
    }

    /** @param list<string> $permissions */
    private function forbidden(Request $request, string $cid, ?string $code, string $message, array $permissions = [], array $details = []): JsonResponse
    {
        $this->auditDenied($request, $permissions === [] ? 'fuera del alcance del rol' : 'requiere '.implode(' | ', $permissions));

        return $this->error(403, 'FORBIDDEN', $code, $message, $cid, $permissions, $details);
    }

    private function notFound(Request $request, string $cid): JsonResponse
    {
        // 404 por recurso de otro tenant o inexistente: no se revela cuál de los dos (SEC-BR-02), pero se audita.
        $this->auditDenied($request, 'recurso inexistente o de otro tenant');

        return $this->error(404, 'RESOURCE_NOT_FOUND', null, 'El recurso no existe.', $cid);
    }

    private function auditDenied(Request $request, string $after): void
    {
        try {
            app(AuditLogger::class)->logOutsideTransaction('Acceso', '/'.$request->path(), 'acceso_denegado',
                (string) $request->user()?->getRoleNames()->first(), $after);
        } catch (Throwable $ignored) {
            report($ignored); // la auditoría nunca debe ocultar la respuesta de error original
        }
    }

    /**
     * @param  list<string>  $permissions
     * @param  array<string, mixed>  $details
     */
    private function error(int $status, string $error, ?string $code, string $message, string $cid, array $permissions = [], array $details = []): JsonResponse
    {
        return new JsonResponse(array_filter([
            'error' => $error,
            'code' => $code,
            'message' => $message,
            'required_permissions' => $permissions ?: null,
            'correlation_id' => $cid,
            'details' => $details ?: null,
        ], fn ($v) => $v !== null), $status);
    }
}
