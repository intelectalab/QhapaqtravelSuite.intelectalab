<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

/**
 * Resultado común de toda llamada a un adaptador (spec 09 §3.13–3.14, INT-BR-04).
 * `errorClass` alimenta `integration_errors.error_class` (CHECK: transitorio | permanente):
 *  - transitorio (timeout, 5xx, 429) ⇒ el job reintenta con backoff;
 *  - permanente (datos rechazados) ⇒ no se reintenta; alerta y resolución manual.
 */
final readonly class AdapterResult
{
    /** @param array<string, mixed> $payload respuesta del proveedor SIN datos personales completos */
    public function __construct(
        public bool $ok,
        public string $status,
        public ?string $externalId = null,
        public ?string $errorClass = null,
        public ?string $message = null,
        public array $payload = [],
    ) {
    }

    public static function success(string $status, ?string $externalId = null, array $payload = []): self
    {
        return new self(true, $status, $externalId, null, null, $payload);
    }

    public static function transient(string $message): self
    {
        return new self(false, 'error', null, 'transitorio', $message);
    }

    public static function permanent(string $message): self
    {
        return new self(false, 'rechazado', null, 'permanente', $message);
    }
}
