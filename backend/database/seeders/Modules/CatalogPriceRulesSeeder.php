<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\PricingSamples;

final class CatalogPriceRulesSeeder
{
    public const ORDER = 72;

    public function __construct(private readonly Tenant $tenant) {}

    public function run(): void
    {
        (new PricingSamples)->seed((string) $this->tenant->getKey());
    }
}
