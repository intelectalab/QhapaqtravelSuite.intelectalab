<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Support\Entitlements;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PlanCatalogAdditionsSeeder extends Seeder
{
    private const KINDS = ['módulo' => 'module', 'límite' => 'limit', 'add-on' => 'addon', 'beta' => 'beta'];

    public const COUPONS = [
        ['KIPUTURISMO2026', 'percent', 10, 1, ['Starter', 'Professional'], null, '2026-12-31', 'Bienvenida de la landing (spec 25 §5.1)'],
    ];

    public function run(): void
    {
        $plans = $this->db()->table('plans')->whereIn('code', ['starter', 'professional', 'enterprise'])->pluck('id', 'name')->all();

        if (count($plans) < 3) {
            return;
        }

        $added = $this->addons($plans) + $this->features($plans) + $this->coupons($plans);

        if ($added > 0) {
            Entitlements::flush();
        }
    }

    private function addons(array $plans): int
    {
        $added = 0;

        foreach (PlanCatalogSeeder::ADDONS as $addon) {
            [$code, $label, $unit, $quantity, $price, $available, $included, $grants] = $addon;
            [$mode, $once] = $addon[8] ?? ['mensual', null];
            $row = $this->db()->table('addons')->where('code', $code)->first();
            $unset = $row !== null && $row->available_plans === '{}' && $row->included_plans === '{}';

            if ($row === null) {
                $this->db()->table('addons')->insert([
                    'code' => $code,
                    'label' => $label,
                    'unit' => $unit,
                    'quantity_allowed' => $quantity,
                    'price_month' => $mode === 'unico' ? null : $price,
                    'billing_mode' => $mode,
                    'price_once' => $once,
                    'available_plans' => $this->ids($plans, $available),
                    'included_plans' => $this->ids($plans, $included),
                    'grants' => json_encode((object) $grants),
                ]);
                $added++;
            } elseif ($unset) {
                $this->db()->table('addons')->where('code', $code)->update(['available_plans' => $this->ids($plans, $available), 'included_plans' => $this->ids($plans, $included), 'updated_at' => now()]);
                $added++;
            } else {
                continue;
            }

            $unitPrice = $mode === 'unico' ? $once : ($row->price_month ?? $price);

            foreach ($available as $name) {
                if ($unitPrice !== null && ! $this->db()->table('addon_prices')->where('addon_code', $code)->where('plan_id', $plans[$name])->exists()) {
                    $this->db()->table('addon_prices')->insert(['addon_code' => $code, 'plan_id' => $plans[$name], 'price' => $unitPrice]);
                }
            }
        }

        return $added;
    }

    private function features(array $plans): int
    {
        $existing = $this->db()->table('features')->pluck('key')->flip();
        $start = Carbon::parse('2026-11-16');
        $added = 0;

        foreach (PlanCatalogSeeder::FEATURES as $index => $feature) {
            [$key, $label, $module, $values] = $feature;
            $featureKey = "module.{$key}";

            if ($existing->has($featureKey)) {
                continue;
            }

            $this->db()->table('features')->insert([
                'key' => $featureKey,
                'label' => $label,
                'module' => $module,
                'kind' => self::KINDS[$feature[4] ?? 'módulo'],
                'addon_code' => $feature[5] ?? null,
                'created_at' => $start->copy()->addMinutes($index),
            ]);

            foreach (['Starter', 'Professional', 'Enterprise'] as $rank => $name) {
                if ($values[$rank]) {
                    $this->db()->table('plan_features')->insertOrIgnore(['plan_id' => $plans[$name], 'feature_key' => $featureKey, 'value' => $values[$rank] === true ? 'incluido' : $values[$rank]]);
                }
            }

            $added++;
        }

        if ($added > 0) {
            foreach ($plans as $name => $id) {
                $count = $this->db()->table('plan_features as pf')->join('features as f', 'f.key', '=', 'pf.feature_key')->where('pf.plan_id', $id)->where('f.kind', 'module')->count();
                $this->db()->table('plans')->where('id', $id)->update(['module_count' => $count]);
            }
        }

        return $added;
    }

    private function coupons(array $plans): int
    {
        $added = 0;

        foreach (self::COUPONS as [$code, $type, $value, $cycles, $names, $max, $validTo, $note]) {
            if ($this->db()->table('coupons')->where('code', $code)->exists()) {
                continue;
            }

            $this->db()->table('coupons')->insert([
                'code' => $code,
                'type' => $type,
                'value' => $value,
                'duration_cycles' => $cycles,
                'plan_ids' => $this->ids($plans, $names),
                'max_redemptions' => $max,
                'valid_to' => $validTo,
                'status' => 'active',
                'note' => $note,
            ]);
            $added++;
        }

        return $added;
    }

    private function ids(array $plans, array $names): string
    {
        return '{'.implode(',', array_map(fn (string $name): string => (string) $plans[$name], $names)).'}';
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
