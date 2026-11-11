<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Admin\Support\SettingsCatalog;
use App\Domain\Platform\Http\Requests\TenantProvisionRequest;
use Illuminate\Support\Facades\DB;

final class ProvisionOptions
{
    public function all(): array
    {
        $modules = DB::connection('pgsql_platform')->table('permissions')->where('guard_name', 'api')->pluck('module', 'name');
        $pairs = fn (array $values): array => array_map(fn (string $value, string $label): array => ['value' => $value, 'label' => $label], array_keys($values), $values);

        return [
            'business_types' => TenantProvisionRequest::BUSINESS_TYPES,
            'countries' => TenantProvisionRequest::COUNTRIES,
            'locales' => $pairs(TenantProvisionRequest::LOCALES),
            'base_currencies' => $pairs(TenantProvisionRequest::BASE_CURRENCIES),
            'alt_currencies' => $pairs(TenantProvisionRequest::ALT_CURRENCIES),
            'timezones' => SettingsCatalog::TIMEZONES,
            'rounding' => $pairs(SettingsCatalog::ROUNDING),
            'fx_sources' => SettingsCatalog::FX_SOURCES,
            'templates' => $pairs(TenantProvisionRequest::TEMPLATES),
            'plans' => DB::connection('pgsql_platform')->table('plans')->where('status', 'active')->orderBy('rank')->get(['code', 'name', 'rank', 'price_month', 'trial_days'])->map(fn (object $plan): array => ['code' => $plan->code, 'name' => $plan->name, 'rank' => (int) $plan->rank, 'price_month' => (float) $plan->price_month, 'trial_days' => (int) $plan->trial_days])->all(),
            'channels' => array_map(fn (string $key, array $channel): array => ['key' => $key, 'label' => $channel['label'], 'description' => $channel['description'], 'plan_rank' => $channel['plan'], 'plan' => SettingsCatalog::PLAN_NAMES[$channel['plan']]], array_keys(SettingsCatalog::CHANNELS), SettingsCatalog::CHANNELS),
            'roles' => array_map(function (array $role) use ($modules): array {
                $templates = [];

                foreach (array_keys(TenantProvisionRequest::TEMPLATES) as $template) {
                    $permissions = TenantBootstrap::permissionsFor($role['id'], $template);
                    $templates[$template] = ['permissions' => count($permissions), 'modules' => array_values(array_unique(array_filter(array_map(fn (string $permission): ?string => $modules[$permission] ?? null, $permissions))))];
                }

                return ['id' => $role['id'], 'name' => $role['name'], 'description' => $role['desc'] ?? null, 'scope' => $role['scope'], 'required' => $role['id'] === 'tenant_admin', 'templates' => $templates];
            }, TenantBootstrap::tenantRoles()),
            'defaults' => [
                'country' => 'Perú',
                'locale' => 'es-PE',
                'base_currency' => 'PEN',
                'alt_currency' => 'USD',
                'timezone' => 'America/Lima',
                'roles' => ['tenant_admin', 'manager', 'sales', 'operations', 'finance'],
                'permission_template' => 'standard',
                'quote_validity_days' => 10,
                'hold_minutes' => 30,
                'markup_pct' => 25,
                'max_discount_pct' => 5,
                'tax_pct' => 18,
                'rounding' => '0.10',
                'advance_pct' => 40,
                'fx_rate' => 3.75,
                'fx_source' => SettingsCatalog::FX_SOURCES[0],
                'invoice_series' => 'F001',
                'receipt_series' => 'B001',
                'channels' => ['portal_cliente'],
            ],
        ];
    }
}
