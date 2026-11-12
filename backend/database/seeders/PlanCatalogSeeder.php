<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Models\Plan;
use Database\Support\KitSeeds;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlanCatalogSeeder
{
    private const ORDER = ['Starter', 'Professional', 'Enterprise'];

    private const SUPPORT = ['Starter' => 'Correo, horario laboral', 'Professional' => 'Correo y chat, 12 h', 'Enterprise' => 'Dedicado 24/7 · SLA 99.9%'];

    private const LIMITS = [
        'users' => 'users',
        'sedes' => 'sedes',
        'storageGB' => 'storage_gb',
        'reservations' => 'reservations_month',
        'whatsapp' => 'whatsapp_month',
        'email' => 'email_month',
        'apiCalls' => 'api_calls_month',
        'rateMin' => 'api_rate_per_min',
        'webhooks' => 'webhooks',
        'apiKeys' => 'api_keys',
    ];

    private const KINDS = ['módulo' => 'module', 'límite' => 'limit', 'add-on' => 'addon', 'beta' => 'beta'];

    private const FEATURES = [
        ['crm', 'CRM, leads y ficha del cliente', 'Comercial', [true, true, true]],
        ['catalog', 'Catálogo turístico y tarifas', 'Catálogo', [true, true, true]],
        ['quotes', 'Cotizaciones con versiones', 'Ventas', [true, true, true]],
        ['reservations', 'Reservas y pasajeros', 'Ventas', [true, true, true]],
        ['finance_basic', 'Finanzas básicas (cobros y pagos)', 'Finanzas', [true, true, true]],
        ['portal_client', 'Portal del cliente', 'Canales', [true, true, true]],
        ['operations', 'Órdenes operativas y asignaciones', 'Operaciones', [false, true, true]],
        ['vouchers', 'Vouchers y rooming list', 'Operaciones', [false, true, true]],
        ['travel_docs', 'Documentos de viaje', 'Operaciones', [false, true, true]],
        ['profitability', 'Rentabilidad y comisiones', 'Finanzas', [false, true, true]],
        ['treasury', 'Tesorería (caja y bancos)', 'Finanzas', [false, true, true]],
        ['reports', 'Reportes y exportación', 'Inteligencia', [false, true, true]],
        ['portal_passenger', 'Portal del pasajero', 'Canales', [false, true, true]],
        ['inbox_omnichannel', 'Bandeja de mensajes', 'Colaboración', [false, true, true]],
        ['marketing_campaigns', 'Campañas y segmentos', 'Marketing', [false, true, true]],
        ['b2b', 'Canal B2B con agencias', 'Canales', [false, 'básico', true], 'módulo', 'b2b_full'],
        ['multi_sede', 'Varias sedes', 'Administración', [false, false, true]],
        ['ecommerce', 'Tienda en línea', 'Canales', [false, false, true]],
        ['cms', 'Sitio web', 'Canales', [false, false, true]],
        ['mobile_apps', 'Apps móviles (operador y pasajero)', 'Móvil', [false, false, true], 'módulo', 'mobile_apps'],
        ['integrations', 'Integraciones con proveedores', 'Plataforma', [false, false, true]],
        ['audit_advanced', 'Auditoría avanzada y exportación', 'Plataforma', [false, false, true]],
        ['api_access', 'API y llaves de acceso', 'Plataforma', [false, true, true], 'límite'],
        ['webhooks', 'Webhooks', 'Plataforma', [false, true, true], 'límite'],
        ['oauth_apps', 'Aplicaciones de terceros (OAuth)', 'Plataforma', [false, false, true]],
        ['custom_domain', 'Dominio propio', 'Canales', [false, false, false], 'add-on', 'custom_domain'],
        ['ai_quote_assistant', 'Asistente de cotización', 'Ventas', [false, false, false], 'beta'],
    ];

    private const ADDONS = [
        ['extra_users', 'Usuarios adicionales', 'usuario', true, null, ['Starter', 'Professional'], ['Enterprise'], []],
        ['whatsapp_pack', 'Paquete de 1 000 mensajes de WhatsApp al mes', 'paquete', true, 65, self::ORDER, [], ['whatsapp_month' => 1000]],
        ['storage_pack', 'Almacenamiento adicional de 50 GB', 'paquete', true, 80, self::ORDER, [], ['storage_gb' => 50]],
        ['b2b_full', 'Canal B2B completo', 'módulo', false, 290, ['Professional'], ['Enterprise'], ['feature' => 'module.b2b']],
        ['mobile_apps', 'Apps móviles (operador y pasajero)', 'módulo', false, 390, ['Professional'], ['Enterprise'], ['feature' => 'module.mobile_apps']],
        ['custom_domain', 'Dominio propio con certificado SSL', 'dominio', false, 45, self::ORDER, [], ['feature' => 'module.custom_domain']],
    ];

    public function run(): array
    {
        $seeds = collect(KitSeeds::read('plans'))->keyBy('id');
        $plans = [];

        foreach (self::ORDER as $rank => $name) {
            $seed = $seeds[$name];
            $plans[$name] = Plan::query()->updateOrCreate(['code' => Str::lower($name)], [
                'name' => $name,
                'rank' => $rank + 1,
                'price_month' => $seed['price'],
                'price_year' => $seed['priceYear'] ?? $seed['price'] * 10,
                'currency' => 'PEN',
                'trial_days' => $seed['trialDays'] ?? 14,
                'support_level' => self::SUPPORT[$name],
                'module_count' => collect(self::FEATURES)->filter(fn (array $feature) => ($feature[4] ?? 'módulo') === 'módulo' && $feature[3][$rank])->count(),
                'status' => 'active',
            ]);
            $this->limits($plans[$name], $seed['limits']);
        }

        $this->addons($plans, $seeds);
        $this->features($plans);
        $this->rules();

        return $plans;
    }

    private function limits(Plan $plan, array $limits): void
    {
        DB::table('plan_limits')->where('plan_id', $plan->getKey())->delete();
        foreach (self::LIMITS as $source => $metric) {
            DB::table('plan_limits')->insert(['plan_id' => $plan->getKey(), 'metric' => $metric, 'value' => $limits[$source] ?? null, 'hard' => true]);
        }
    }

    private function features(array $plans): void
    {
        DB::table('plan_features')->whereIn('plan_id', collect($plans)->map->getKey()->all())->delete();
        $start = Carbon::parse('2026-01-01');

        foreach (self::FEATURES as $index => [$key, $label, $module, $values]) {
            $feature = self::FEATURES[$index];
            $featureKey = "module.{$key}";
            DB::table('features')->updateOrInsert(['key' => $featureKey], [
                'label' => $label,
                'module' => $module,
                'kind' => self::KINDS[$feature[4] ?? 'módulo'],
                'addon_code' => $feature[5] ?? null,
                'created_at' => $start->copy()->addMinutes($index),
            ]);

            foreach (self::ORDER as $rank => $name) {
                if ($values[$rank]) {
                    DB::table('plan_features')->insert(['plan_id' => $plans[$name]->getKey(), 'feature_key' => $featureKey, 'value' => $values[$rank] === true ? 'incluido' : $values[$rank]]);
                }
            }
        }
    }

    private function addons(array $plans, $seeds): void
    {
        $ids = fn (array $names) => '{'.implode(',', array_map(fn (string $name) => $plans[$name]->getKey(), $names)).'}';

        foreach (self::ADDONS as [$code, $label, $unit, $quantity, $price, $available, $included, $grants]) {
            $byPlan = array_map(fn (string $name): float => (float) ($price ?? ($seeds[$name]['limits']['extraUserPrice'] ?? 0)), $available);
            DB::table('addons')->updateOrInsert(['code' => $code], [
                'label' => $label,
                'unit' => $unit,
                'quantity_allowed' => $quantity,
                'price_month' => $price ?? min($byPlan),
                'available_plans' => $ids($available),
                'included_plans' => $ids($included),
                'grants' => json_encode($grants),
            ]);

            DB::table('addon_prices')->where('addon_code', $code)->delete();
            foreach ($available as $index => $name) {
                DB::table('addon_prices')->insert(['addon_code' => $code, 'plan_id' => $plans[$name]->getKey(), 'price' => $byPlan[$index]]);
            }
        }
    }

    private function rules(): void
    {
        foreach (KitSeeds::read('settings')['bookingRules'] ?? [] as $rule) {
            DB::table('sys_booking_rule_catalog')->updateOrInsert(['code' => $rule['id']], [
                'rule_group' => $rule['group'],
                'name' => $rule['name'],
                'description' => $rule['desc'],
                'default_enabled' => (bool) ($rule['enabled'] ?? false),
                'default_params' => json_encode((object) ($rule['params'] ?? [])),
                'scope' => '{'.implode(',', array_map(fn (string $scope) => '"'.$scope.'"', $rule['scope'] ?? [])).'}',
                'product_override' => (bool) ($rule['productOverride'] ?? false),
                'min_plan' => $rule['minPlan'] ?? 'Starter',
            ]);
            DB::table('plan_rule_entitlements')->updateOrInsert(['rule_code' => $rule['id']], ['min_plan' => $rule['minPlan'] ?? 'Starter', 'is_demo' => true]);
        }
    }
}
