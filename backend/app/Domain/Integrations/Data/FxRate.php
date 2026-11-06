<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class FxRate
{
    public function __construct(
        public string $currencyCode,
        public string $ratePen,
        public string $rateDate,
        public string $source,
        public ?string $buy = null,
        public ?string $sell = null,
    ) {}
}
