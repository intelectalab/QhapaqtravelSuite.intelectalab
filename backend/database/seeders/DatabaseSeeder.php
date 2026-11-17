<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(HelpArticleSeeder::class);

        if (! app()->isProduction()) {
            $this->call(DemoSeeder::class);
        }

        $this->call(BookingRuleCatalogSeeder::class);
        $this->call(PlanCatalogAdditionsSeeder::class);
    }
}
