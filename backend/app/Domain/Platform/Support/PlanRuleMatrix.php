<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PlanRuleMatrix
{
    private const CONNECTION = 'pgsql_platform';

    public function overview(): array
    {
        $plans = $this->plans();
        $tenants = $this->tenants();
        $rules = $this->rules();

        return [
            'plans' => $plans->map(fn ($plan) => [
                'code' => $plan->code,
                'name' => $plan->name,
                'rank' => (int) $plan->rank,
                'rules' => $rules->filter(fn (object $rule) => $this->rank($plans, $rule->min_plan) <= (int) $plan->rank)->count(),
                'tenants' => $tenants->where('rank', (int) $plan->rank)->count(),
            ])->values(),
            'groups' => $rules->groupBy('rule_group')->map(fn (Collection $items, int|string $group) => [
                'group' => (string) $group,
                'rules' => $items->map(fn ($rule) => [
                    'code' => $rule->code,
                    'name' => $rule->name,
                    'description' => $rule->description,
                    'min_plan' => $this->code($plans, $rule->min_plan),
                    'default_plan' => $this->code($plans, $rule->default_plan),
                    'tenants' => $tenants->filter(fn (array $tenant) => $tenant['rank'] >= $this->rank($plans, $rule->min_plan))->count(),
                    'updated_at' => $rule->updated_at,
                ])->values(),
            ])->values(),
            'tenants' => $tenants->count(),
            'rules' => $rules->count(),
            'differs' => $rules->filter(fn (object $rule) => $rule->min_plan !== $rule->default_plan)->count(),
        ];
    }

    public function rules(): Collection
    {
        return $this->db()->table('sys_booking_rule_catalog as r')->leftJoin('plan_rule_entitlements as e', 'e.rule_code', '=', 'r.code')
            ->orderBy('r.rule_group')->orderBy('r.name')
            ->get(['r.code', 'r.rule_group', 'r.name', 'r.description', DB::raw('coalesce(e.min_plan, r.min_plan) as min_plan'), 'r.min_plan as default_plan', 'e.updated_at']);
    }

    public function plans(): Collection
    {
        return $this->db()->table('plans')->where('status', '<>', 'retired')->orderBy('rank')->get(['id', 'code', 'name', 'rank']);
    }

    public function tenants(): Collection
    {
        return $this->db()->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.status', '<>', 'cancelado')->orderBy('t.commercial_name')
            ->get(['t.id', 't.code', 't.commercial_name', 'p.name as plan', 'p.rank'])
            ->map(fn (object $tenant) => ['id' => (string) $tenant->id, 'code' => $tenant->code, 'name' => $tenant->commercial_name, 'plan' => $tenant->plan, 'rank' => (int) $tenant->rank]);
    }

    public function rank(Collection $plans, ?string $name): int
    {
        return (int) ($plans->firstWhere('name', $name)->rank ?? 1);
    }

    private function code(Collection $plans, ?string $name): ?string
    {
        return $plans->firstWhere('name', $name)->code ?? null;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
