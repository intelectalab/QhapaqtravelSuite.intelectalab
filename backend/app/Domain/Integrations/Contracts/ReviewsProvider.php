<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\ExternalReview;

interface ReviewsProvider extends HealthCheckable
{
    public function fetch(array $sourceConfig, ?string $sinceDate = null): iterable;

    public function reply(array $sourceConfig, string $externalId, string $text): AdapterResult;
}
