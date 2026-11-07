<?php

declare(strict_types=1);

namespace App\Domain\Shared\Errors;

use RuntimeException;

class ApiException extends RuntimeException
{
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

    public static function unauthorized(string $code, string $message): self
    {
        return new self(401, 'UNAUTHENTICATED', $code, $message);
    }

    public static function forbidden(?string $code, string $message, array $requiredPermissions = []): self
    {
        return new self(403, 'FORBIDDEN', $code, $message, $requiredPermissions);
    }

    public static function notFound(string $message = 'El recurso no existe.'): self
    {
        return new self(404, 'RESOURCE_NOT_FOUND', null, $message);
    }

    public static function conflict(string $code, string $message, array $details = []): self
    {
        return new self(409, 'CONFLICT', $code, $message, [], $details);
    }

    public static function unprocessable(string $code, string $message, array $details = []): self
    {
        return new self(422, 'BUSINESS_RULE', $code, $message, [], $details);
    }

    public static function preconditionRequired(string $code, string $message): self
    {
        return new self(428, 'PRECONDITION_REQUIRED', $code, $message);
    }
}
