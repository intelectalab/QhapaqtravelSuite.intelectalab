<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

final class BookingRuleCatalog
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public static function definition(string $code, string $group, string $name, string $description, string $minPlan, array $scope = [], bool $enabled = false, array $params = [], bool $productOverride = false): array
    {
        return [
            'code' => $code,
            'rule_group' => $group,
            'name' => $name,
            'description' => $description,
            'default_enabled' => $enabled,
            'default_params' => $params,
            'scope' => $scope,
            'product_override' => $productOverride,
            'min_plan' => $minPlan,
        ];
    }

    public static function catalogValues(array $definition): array
    {
        return [
            'rule_group' => $definition['rule_group'],
            'name' => $definition['name'],
            'description' => $definition['description'],
            'default_enabled' => (bool) $definition['default_enabled'],
            'default_params' => json_encode((object) $definition['default_params'], JSON_UNESCAPED_UNICODE),
            'scope' => PgArray::from($definition['scope']),
            'product_override' => (bool) $definition['product_override'],
            'min_plan' => $definition['min_plan'],
        ];
    }

    public function addMissing(array $definitions): array
    {
        $db = $this->db();
        $catalog = array_fill_keys($db->table('sys_booking_rule_catalog')->pluck('code')->all(), true);
        $entitled = array_fill_keys($db->table('plan_rule_entitlements')->pluck('rule_code')->all(), true);
        $added = ['catalog' => 0, 'entitlements' => 0];

        foreach ($definitions as $definition) {
            $code = (string) $definition['code'];

            if (! isset($catalog[$code])) {
                $db->table('sys_booking_rule_catalog')->insert(['code' => $code, ...self::catalogValues($definition), 'created_at' => now(), 'updated_at' => now()]);
                $catalog[$code] = true;
                $added['catalog']++;
            }

            if (! isset($entitled[$code])) {
                $db->table('plan_rule_entitlements')->insert(['rule_code' => $code, 'min_plan' => $definition['min_plan'], 'is_demo' => true, 'updated_at' => now()]);
                $entitled[$code] = true;
                $added['entitlements']++;
            }
        }

        return $added;
    }

    public function fillTenant(string $tenantId, ?string $by = null): array
    {
        $db = $this->db();
        $existing = $db->table('sys_booking_rules')->where('tenant_id', $tenantId)->pluck('code')->flip();
        $order = (int) $db->table('sys_booking_rules')->where('tenant_id', $tenantId)->max('sort_order');
        $added = [];

        $catalog = $db->table('sys_booking_rule_catalog as c')
            ->leftJoin('plan_rule_entitlements as e', 'e.rule_code', '=', 'c.code')
            ->orderBy('c.id')
            ->get(['c.code', 'c.rule_group', 'c.name', 'c.description', 'c.default_enabled', 'c.default_params', 'c.params_schema', 'c.scope', 'c.product_override', DB::raw('coalesce(e.min_plan, c.min_plan) as min_plan')]);

        foreach ($catalog as $rule) {
            if ($existing->has($rule->code)) {
                continue;
            }

            $db->table('sys_booking_rules')->insert([
                'tenant_id' => $tenantId,
                'code' => $rule->code,
                'rule_group' => $rule->rule_group,
                'name' => $rule->name,
                'description' => $rule->description,
                'enabled' => (bool) $rule->default_enabled,
                'params' => $rule->default_params,
                'params_schema' => $rule->params_schema,
                'scope' => $rule->scope,
                'product_override' => (bool) $rule->product_override,
                'is_custom' => false,
                'min_plan' => $rule->min_plan,
                'sort_order' => ++$order,
                'created_by' => $by,
                'updated_by' => $by,
            ]);
            $added[] = $rule->code;
        }

        if ($added !== []) {
            RuleResolver::invalidate($tenantId);
        }

        return $added;
    }

    public function fillTenants(): array
    {
        $added = [];
        $previous = $this->context->id();

        foreach ($this->db()->table('tenants')->orderBy('code')->pluck('id') as $tenantId) {
            $codes = $this->db()->transaction(fn (): array => $this->fillTenant((string) $tenantId));

            if ($codes === []) {
                continue;
            }

            $added[(string) $tenantId] = $codes;
            $this->context->set((string) $tenantId);
            $this->audit->log('Reglas de reserva', 'catalogo', 'agregar_reglas', null, count($codes).' reglas del catálogo: '.implode(', ', $codes), connection: self::CONNECTION);
        }

        $previous === null ? $this->context->clear() : $this->context->set($previous);

        return $added;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
