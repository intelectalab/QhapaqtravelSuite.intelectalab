<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class AdapterResult
{
    public function __construct(
        public bool $ok,
        public string $status,
        public ?string $externalId = null,
        public ?string $errorClass = null,
        public ?string $message = null,
        public array $payload = [],
    ) {}

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
