<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

interface SiteContentAi extends HealthCheckable
{
    public function write(string $kind, array $source, array $options): array;

    public function draw(string $prompt, string $style, int $width, int $height, int $variant): string;

    public function imageMime(): string;

    public function provider(): string;
}
