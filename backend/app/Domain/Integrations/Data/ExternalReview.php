<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class ExternalReview
{
    public function __construct(
        public string $externalId,
        public string $authorDisplay,
        public int $rating,
        public ?string $title,
        public ?string $body,
        public string $reviewDate,
        public ?string $url = null,
        public ?string $lang = null,
    ) {
    }
}
