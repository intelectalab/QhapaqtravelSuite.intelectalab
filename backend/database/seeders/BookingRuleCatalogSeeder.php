<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Support\BookingRuleCatalog;
use App\Domain\Platform\Support\PlanFeatureRules;
use Database\Support\KitSeeds;
use Illuminate\Database\Seeder;

final class BookingRuleCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = app(BookingRuleCatalog::class);
        $catalog->addMissing(self::definitions());
        $catalog->fillTenants();
    }

    public static function definitions(): array
    {
        $rules = array_map(fn (array $rule): array => BookingRuleCatalog::definition(
            $rule['id'],
            $rule['group'],
            $rule['name'],
            $rule['desc'],
            $rule['minPlan'] ?? 'Starter',
            $rule['scope'] ?? [],
            (bool) ($rule['enabled'] ?? false),
            (array) ($rule['params'] ?? []),
            (bool) ($rule['productOverride'] ?? false),
        ), array_values(KitSeeds::read('settings')['bookingRules'] ?? []));

        foreach (PlanFeatureRules::RULES as $code => $rule) {
            $rules[] = BookingRuleCatalog::definition($code, PlanFeatureRules::GROUP, $rule['name'], $rule['description'], $rule['min_plan'], $rule['scope'], true);
        }

        return $rules;
    }
}
