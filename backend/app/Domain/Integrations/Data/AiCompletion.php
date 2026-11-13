<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class AiCompletion
{
    public function __construct(
        public bool $ok,
        public array $output,
        public int $tokensIn,
        public int $tokensOut,
        public string $costUsd,
        public ?string $model = null,
        public ?string $error = null,
    ) {}

    public static function failed(string $error): self
    {
        return new self(false, [], 0, 0, '0', null, $error);
    }
}
