<?php

declare(strict_types=1);

namespace App\Domain\Booking\Rules;

use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\RuleSet;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class RuleResolver
{
    private ?RuleSet $memo = null;

    public function __construct(private readonly TenantContext $context) {}

    public function forTenant(?string $previewPlan = null): RuleSet
    {
        $set = $this->memo ??= $this->load();

        return $previewPlan === null ? $set : $set->withPlan($previewPlan);
    }

    public function on(string $code, ?ProductData $product = null): bool
    {
        return $this->forTenant()->on($code, $product);
    }

    public function param(string $code, string $key, ?ProductData $product = null): mixed
    {
        return $this->forTenant()->param($code, $key, $product);
    }

    public function productOverrides(string $productId): array
    {
        $rows = DB::table('catalog_product_rule_overrides')->where('product_id', $productId)->get(['rule_code', 'disabled', 'params']);
        $disabled = [];
        $params = [];
        foreach ($rows as $row) {
            if ($row->disabled) {
                $disabled[$row->rule_code] = false;
            }
            if ($row->params !== null) {
                $params[$row->rule_code] = (array) json_decode((string) $row->params, true);
            }
        }

        return [$disabled, $params];
    }

    public static function invalidate(string $tenantId): void
    {
        Cache::increment('t:'.$tenantId.':rules:ver');
    }

    private function load(): RuleSet
    {
        $tenantId = $this->context->idOrFail();
        $version = (int) Cache::get('t:'.$tenantId.':rules:ver', 0);

        $data = Cache::remember("t:{$tenantId}:rules:v{$version}", now()->addHour(), function (): array {
            $rows = DB::table('sys_booking_rules as r')
                ->leftJoin('plan_rule_entitlements as e', 'e.rule_code', '=', 'r.code')
                ->orderBy('r.sort_order')
                ->get(['r.code', 'r.enabled', 'r.params', 'r.product_override', DB::raw('coalesce(e.min_plan, r.min_plan) as min_plan')]);

            $rules = [];
            foreach ($rows as $row) {
                $rules[$row->code] = [
                    'enabled' => (bool) $row->enabled,
                    'params' => (array) json_decode((string) $row->params, true),
                    'product_override' => (bool) $row->product_override,
                    'min_plan' => $row->min_plan,
                ];
            }

            $plan = (string) DB::table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')
                ->where('t.id', $this->context->idOrFail())->value('p.name');
            $order = DB::table('plans')->where('status', '<>', 'retired')->orderBy('rank')->pluck('name')->all();

            return ['rules' => $rules, 'plan' => $plan, 'order' => $order];
        });

        return new RuleSet($data['rules'], $data['plan'], $data['order']);
    }
}
