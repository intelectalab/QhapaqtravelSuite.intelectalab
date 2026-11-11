<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Iam\Models\User;
use App\Domain\Platform\Models\Tenant;
use Database\Support\AllotmentSamples;
use Database\Support\SeedsTenant;

final class CatalogAllotmentsSeeder
{
    public const ORDER = 75;

    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $actor = User::query()->whereKey($this->userId('U05'))->first();

        if ($actor !== null) {
            (new AllotmentSamples)->seed($actor);
        }
    }
}
