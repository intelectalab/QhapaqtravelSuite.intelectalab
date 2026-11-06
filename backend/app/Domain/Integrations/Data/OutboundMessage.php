<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class OutboundMessage
{
    public function __construct(
        public string $channel,
        public string $to,
        public ?string $subject = null,
        public ?string $body = null,
        public ?string $templateCode = null,
        public array $variables = [],
        public ?string $locale = 'es',
    ) {}
}
