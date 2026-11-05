<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Rules;

use App\Domain\Bookings\Data\ProductData;
use App\Domain\Bookings\Data\RuleSet;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Centro de reglas (spec 16 §8.1 `RuleResolver`, §8.3 caché; spec 17 §3.1–3.2; spec 13 §3.4 plan mínimo).
 *
 * Fuentes (database/30_fase2.sql y 01_platform.sql):
 *  - `sys_booking_rules` (por tenant): code, enabled, params, product_override, min_plan (copia), depends_on.
 *  - `plan_rule_entitlements` (plataforma): rule_code → min_plan. FUENTE DE VERDAD del plan mínimo (spec 17 §3.1);
 *    si no hay fila se usa `sys_booking_rules.min_plan`.
 *  - `catalog_product_rule_overrides`: (product_id, rule_code, disabled, params). Solo para reglas con
 *    product_override = true (trigger app_rule_override_guard).
 *  - Plan del tenant: `tenants.plan_id → plans`. SUPUESTO: el nombre del plan (`plans.name`) coincide con los
 *    valores del CHECK de min_plan ('Starter','Professional','Enterprise') y el orden lo da `plans.rank`.
 *
 * Caché: `t:{tenant}:rules:v{ver}` (TTL 1 h). Invalidación O(1): INCR de `t:{tenant}:rules:ver` en el listener
 * de `BookingRuleChanged` (cambio en el centro, override de producto o cambio de plan).
 * Catálogo de plataforma: `sys_booking_rule_catalog` (C-04; el backlog F1A-MOT-01 lo llama `platform_booking_rule_templates`).
 */
final class RuleResolver
{
    private ?RuleSet $memo = null;

    public function __construct(private readonly TenantContext $context)
    {
    }

    /** Reglas del tenant (sin overrides de producto: esos van dentro de ProductData). */
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

    /**
     * Overrides de un producto para armar ProductData: [ruleOverrides, ruleParams] con el formato del prototipo
     * (`ruleOverrides[code] = false` si está desactivada; `ruleParams[code] = {...}`).
     *
     * @return array{0: array<string, bool>, 1: array<string, array<string, mixed>>}
     */
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

        /** @var array{rules: array<string, mixed>, plan: string, order: list<string>} $data */
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
