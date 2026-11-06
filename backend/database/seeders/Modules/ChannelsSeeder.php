<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;

final class ChannelsSeeder
{
    private const PARTS = [
        ChannelsB2bSeeder::class,
        ChannelsEcommerceSeeder::class,
        ChannelsCmsSeeder::class,
        ChannelsWebSeeder::class,
        ChannelsReviewsSeeder::class,
        ChannelsPortalsSeeder::class,
        MobileAppsSeeder::class,
    ];

    public function __construct(private readonly Tenant $tenant) {}

    public function run(): void
    {
        foreach (self::PARTS as $part) {
            (new $part($this->tenant))->run();
        }
    }
}
