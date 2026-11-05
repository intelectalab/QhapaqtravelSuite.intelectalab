<?php

declare(strict_types=1);

namespace App\Domain\Shared\Errors;

use RuntimeException;

/**
 * Excepción de dominio que el renderer (App\Exceptions\ApiExceptionRenderer) convierte al formato estándar
 * de error de la API (spec 00 §6 y `components.schemas.Error` del contrato):
 *
 *   { "error": "CONFLICT", "code": "RT-3", "message": "…", "required_permissions": [...],
 *     "correlation_id": "…", "details": {…} }
 *
 * - `error`  = categoría estable para el frontend (FORBIDDEN, RESOURCE_NOT_FOUND, CONFLICT, VALIDATION_FAILED…).
 * - `code`   = código de regla de negocio de la especificación (RT-3, QTE-BR-12, SEC-BR-09, STALE_VERSION…).
 * - Mensajes SIEMPRE en español y sin datos personales.
 */
class ApiException extends RuntimeException
{
    /**
     * @param  list<string>  $requiredPermissions
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public readonly int $status,
        public readonly string $error,
        public readonly ?string $ruleCode,
        string $message,
        public readonly array $requiredPermissions = [],
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    /** 403: permiso faltante, fuera de alcance (SEC-BR-09), feature fuera del plan o tenant suspendido. */
    public static function forbidden(?string $code, string $message, array $requiredPermissions = []): self
    {
        return new self(403, 'FORBIDDEN', $code, $message, $requiredPermissions);
    }

    /** 404: no existe o es de otro tenant (no se revela la diferencia, SEC-BR-02). */
    public static function notFound(string $message = 'El recurso no existe.'): self
    {
        return new self(404, 'RESOURCE_NOT_FOUND', null, $message);
    }

    /** 409: conflicto de estado, disponibilidad, lock_version o idempotencia en curso. */
    public static function conflict(string $code, string $message, array $details = []): self
    {
        return new self(409, 'CONFLICT', $code, $message, [], $details);
    }

    /** 422 de negocio (con `code` de regla). Los 422 de campos los produce el FormRequest. */
    public static function unprocessable(string $code, string $message, array $details = []): self
    {
        return new self(422, 'BUSINESS_RULE', $code, $message, [], $details);
    }
}
