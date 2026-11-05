<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlanCatalog
{
    public const METRICS = ['users', 'sedes', 'storage_gb', 'reservations_month', 'whatsapp_month', 'email_month', 'api_calls_month', 'api_rate_per_min', 'webhooks', 'api_keys'];

    private const CONNECTION = 'pgsql_platform';

    public function model(string $code): ?Plan
    {
        return Plan::on(self::CONNECTION)->where(Str::isUuid($code) ? 'id' : 'code', $code)->first();
    }

    public function all(): Collection
    {
        $plans = $this->plans();

        return $plans->map(fn (Plan $plan) => $this->summary($plan, $plans));
    }

    public function find(string $code): ?array
    {
        $plans = $this->plans();
        $plan = $plans->first(fn (Plan $plan) => Str::isUuid($code) ? $plan->getKey() === $code : $plan->code === $code);

        if ($plan === null) {
            return null;
        }

        $values = $this->db()->table('plan_features')->where('plan_id', $plan->getKey())->pluck('value', 'feature_key');
        $previous = $plans->first(fn (Plan $other) => $other->rank === $plan->rank - 1);
        $previousValues = $previous ? $this->db()->table('plan_features')->where('plan_id', $previous->getKey())->pluck('value', 'feature_key') : collect();
        $features = $this->db()->table('features')->orderBy('created_at')->get(['key', 'label', 'module', 'kind', 'addon_code']);

        return [
            ...$this->summary($plan, $plans),
            'support_level' => $plan->support_level,
            'previous' => $previous?->name,
            'highlights' => $features->where('kind', 'module')->filter(fn (object $feature) => isset($values[$feature->key]) && ! isset($previousValues[$feature->key]))->pluck('label')->values(),
            'features' => $features->map(fn (object $feature) => [
                'key' => $feature->key,
                'label' => $feature->label,
                'group' => $feature->module,
                'kind' => $feature->kind,
                'value' => $values[$feature->key] ?? null,
            ])->values(),
            'addons' => $this->addons($plan),
            'rules' => $this->rules($plan),
            'agencies' => Tenant::on(self::CONNECTION)->where('plan_id', $plan->getKey())->orderBy('commercial_name')->get(['code', 'commercial_name', 'status', 'mrr'])
                ->map(fn (Tenant $tenant) => ['code' => $tenant->code, 'name' => $tenant->commercial_name, 'status' => $tenant->status, 'mrr' => $tenant->mrr]),
        ];
    }

    private function plans(): Collection
    {
        return Plan::on(self::CONNECTION)->orderBy('rank')->get();
    }

    private function summary(Plan $plan, Collection $plans): array
    {
        $tenants = Tenant::on(self::CONNECTION)->where('plan_id', $plan->getKey())->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $rules = $this->ruleCounts($plan, $plans);

        return [
            'id' => $plan->getKey(),
            'code' => $plan->code,
            'name' => $plan->name,
            'rank' => $plan->rank,
            'price_month' => $plan->price_month,
            'price_year' => $plan->price_year,
            'currency' => $plan->currency,
            'trial_days' => $plan->trial_days,
            'module_count' => $plan->module_count,
            'status' => $plan->status,
            'limits' => $this->db()->table('plan_limits')->where('plan_id', $plan->getKey())->pluck('value', 'metric')->map(fn ($value) => $value === null ? null : (int) $value),
            'tenants' => ['active' => (int) ($tenants['activo'] ?? 0), 'trial' => (int) ($tenants['prueba'] ?? 0), 'suspended' => (int) ($tenants['suspendido'] ?? 0)],
            'rules_included' => $rules['included'],
            'rules_total' => $rules['total'],
        ];
    }

    private function ruleCounts(Plan $plan, Collection $plans): array
    {
        $ranks = $plans->mapWithKeys(fn (Plan $item) => [$item->name => $item->rank]);
        $minimums = $this->db()->table('plan_rule_entitlements')->pluck('min_plan');

        return [
            'included' => $minimums->filter(fn (string $minimum) => ($ranks[$minimum] ?? 1) <= $plan->rank)->count(),
            'total' => $minimums->count(),
        ];
    }

    private function rules(Plan $plan): Collection
    {
        $ranks = $this->plans()->mapWithKeys(fn (Plan $item) => [$item->name => $item->rank]);

        return $this->db()->table('sys_booking_rule_catalog')->orderBy('rule_group')->orderBy('name')->get(['code', 'rule_group', 'name', 'description', 'min_plan'])
            ->groupBy('rule_group')
            ->map(fn (Collection $rules, string $group) => [
                'group' => $group,
                'rules' => $rules->map(fn (object $rule) => [
                    'code' => $rule->code,
                    'name' => $rule->name,
                    'description' => $rule->description,
                    'from' => $rule->min_plan,
                    'included' => ($ranks[$rule->min_plan] ?? 1) <= $plan->rank,
                ])->values(),
            ])
            ->values();
    }

    private function addons(Plan $plan): Collection
    {
        $prices = $this->db()->table('addon_prices')->where('plan_id', $plan->getKey())->pluck('price', 'addon_code');

        return $this->db()->table('addons')->orderBy('price_month')->get()
            ->map(function (object $addon) use ($plan, $prices): ?array {
                $included = in_array($plan->getKey(), $this->uuids($addon->included_plans), true);
                $available = in_array($plan->getKey(), $this->uuids($addon->available_plans), true);

                if (! $included && ! $available) {
                    return null;
                }

                return [
                    'code' => $addon->code,
                    'label' => $addon->label,
                    'unit' => $addon->unit,
                    'included' => $included,
                    'price' => $included ? null : ($prices[$addon->code] ?? $addon->price_month),
                ];
            })
            ->filter()
            ->sortBy(fn (array $addon) => $addon['included'] ? 0 : 1)
            ->values();
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
