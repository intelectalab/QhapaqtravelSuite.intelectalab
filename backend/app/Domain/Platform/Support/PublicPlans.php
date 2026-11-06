<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Models\Plan;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PublicPlans
{
    private const CONNECTION = 'pgsql_platform';

    private const MATRIX_KINDS = ['module', 'limit'];

    public function catalog(): array
    {
        $plans = $this->plans();
        $ids = $plans->map(fn (Plan $plan) => $plan->getKey())->all();
        $codes = $plans->mapWithKeys(fn (Plan $plan) => [$plan->getKey() => $plan->code]);
        $values = $this->db()->table('plan_features')->whereIn('plan_id', $ids)->get(['plan_id', 'feature_key', 'value'])
            ->groupBy('feature_key')
            ->map(fn (Collection $rows) => $rows->mapWithKeys(fn (object $row) => [$codes[$row->plan_id] => $row->value]));
        $features = $this->db()->table('features')->whereIn('kind', self::MATRIX_KINDS)->orderBy('created_at')->get(['key', 'label', 'module', 'kind', 'addon_code']);
        $rules = $this->rules($plans);

        return [
            'currency' => $plans->pluck('currency')->first() ?? 'PEN',
            'plans' => $plans->values()->map(fn (Plan $plan, int $index) => $this->plan($plan, $index > 0 ? $plans->values()[$index - 1] : null, $features, $values, $rules))->all(),
            'features' => $features->groupBy('module')->map(fn (Collection $items, string $group) => [
                'group' => $group,
                'items' => $items->map(fn (object $feature) => [
                    'key' => $feature->key,
                    'label' => $feature->label,
                    'kind' => $feature->kind,
                    'addon' => $feature->addon_code,
                    'values' => $plans->mapWithKeys(fn (Plan $plan) => [$plan->code => $values[$feature->key][$plan->code] ?? null]),
                ])->values(),
            ])->values()->all(),
            'addons' => $this->addons($plans),
            'rules' => $rules->groupBy('group')->map(fn (Collection $items, string $group) => ['group' => $group, 'rules' => $items->values()])->values()->all(),
        ];
    }

    private function plan(Plan $plan, ?Plan $previous, Collection $features, Collection $values, Collection $rules): array
    {
        $month = (float) $plan->price_month;
        $year = (float) $plan->price_year;
        $saving = max(0, $month * 12 - $year);
        $included = fn (Plan $target) => $features->filter(fn (object $feature) => isset($values[$feature->key][$target->code]));
        $previousKeys = $previous ? $included($previous)->pluck('key')->all() : [];

        return [
            'code' => $plan->code,
            'name' => $plan->name,
            'rank' => $plan->rank,
            'price_month' => $month,
            'price_year' => $year,
            'currency' => $plan->currency,
            'trial_days' => $plan->trial_days,
            'support_level' => $plan->support_level,
            'saving_year' => $saving,
            'saving_percent' => $month > 0 ? (int) round($saving / ($month * 12) * 100) : 0,
            'modules' => $included($plan)->where('kind', 'module')->count(),
            'previous' => $previous?->name,
            'highlights' => $included($plan)->reject(fn (object $feature) => in_array($feature->key, $previousKeys, true))->pluck('label')->values()->all(),
            'limits' => $this->db()->table('plan_limits')->where('plan_id', $plan->getKey())->pluck('value', 'metric')->map(fn ($value) => $value === null ? null : (int) $value)->all(),
            'agencies' => $this->db()->table('tenants')->where('plan_id', $plan->getKey())->whereIn('status', ['activo', 'prueba'])->count(),
            'rules_included' => $rules->filter(fn (array $rule) => $rule['rank'] <= $plan->rank)->count(),
            'rules_total' => $rules->count(),
        ];
    }

    private function rules(Collection $plans): Collection
    {
        $codes = $plans->pluck('code', 'name')->all();
        $ranks = $plans->pluck('rank', 'name')->all();

        return $this->db()->table('plan_rule_entitlements as e')
            ->join('sys_booking_rule_catalog as r', 'r.code', '=', 'e.rule_code')
            ->orderBy('r.rule_group')->orderBy('r.name')
            ->get(['r.code', 'r.rule_group', 'r.name', 'r.description', 'e.min_plan'])
            ->map(fn (object $rule): array => [
                'code' => $rule->code,
                'group' => $rule->rule_group,
                'name' => $rule->name,
                'description' => $rule->description,
                'from' => $codes[$rule->min_plan] ?? null,
                'rank' => (int) ($ranks[$rule->min_plan] ?? PHP_INT_MAX),
            ]);
    }

    private function addons(Collection $plans): array
    {
        $prices = $this->db()->table('addon_prices')->get(['addon_code', 'plan_id', 'price'])->groupBy('addon_code');

        return $this->db()->table('addons')->orderBy('price_month')->get()
            ->map(function (object $addon) use ($plans, $prices): array {
                $included = $this->uuids($addon->included_plans);
                $available = $this->uuids($addon->available_plans);
                $custom = ($prices[$addon->code] ?? collect())->pluck('price', 'plan_id');

                return [
                    'code' => $addon->code,
                    'label' => $addon->label,
                    'unit' => $addon->unit,
                    'quantity_allowed' => (bool) $addon->quantity_allowed,
                    'plans' => $plans->mapWithKeys(function (Plan $plan) use ($included, $available, $custom, $addon): array {
                        $status = in_array($plan->getKey(), $included, true) ? 'included' : (in_array($plan->getKey(), $available, true) ? 'available' : 'unavailable');
                        $price = $custom[$plan->getKey()] ?? $addon->price_month;

                        return [$plan->code => ['status' => $status, 'price' => $status === 'available' && $price !== null ? (float) $price : null]];
                    }),
                ];
            })
            ->all();
    }

    private function plans(): Collection
    {
        return Plan::on(self::CONNECTION)->where('status', 'active')->orderBy('rank')->get();
    }

    private function uuids(?string $raw): array
    {
        return $raw === null || $raw === '{}' ? [] : explode(',', trim($raw, '{}'));
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
