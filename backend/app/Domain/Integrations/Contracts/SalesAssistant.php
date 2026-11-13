<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AiCompletion;

interface SalesAssistant extends HealthCheckable
{
    public function complete(string $kind, string $prompt, array $context): AiCompletion;

    public function extractProducts(string $sourceType, string $source, array $context): AiCompletion;

    public function provider(): string;
}
