<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

/** Reseña leída de una API oficial (spec 17 §3.7, RV-01: sin scraping; texto inmutable). Tabla channel_external_reviews. */
final readonly class ExternalReview
{
    public function __construct(
        public string $externalId,
        public string $authorDisplay,  // channel_external_reviews.author_display
        public int $rating,            // 1..5 (CHECK)
        public ?string $title,
        public ?string $body,
        public string $reviewDate,     // YYYY-MM-DD (review_date)
        public ?string $url = null,
        public ?string $lang = null,   // char(2)
    ) {
    }
}
