<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Iam\Support\StaffSeats;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\SiteTemplates\Support\AiCredits;
use App\Domain\Tracking\Support\TrackingCatalog;
use App\Domain\Tracking\Support\TrackingPlan;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

final class DowngradeValidator
{
    private const CONNECTION = 'pgsql_platform';

    private const LIMITS = [
        'users' => ['usuarios activos', 'desactiva usuarios'],
        'sedes' => ['sedes activas', 'desactiva sedes'],
        'storage_gb' => ['GB de almacenamiento', 'libera espacio'],
        'api_keys' => ['llaves de API activas', 'revoca llaves'],
        'webhooks' => ['webhooks activos', 'pausa o elimina webhooks'],
    ];

    private const MODULES = [
        'module.ecommerce' => 'la tienda en línea tiene pedidos',
        'module.cms' => 'el sitio tiene contenido publicado',
        'module.mobile_apps' => 'hay guías o conductores usando la app',
        'module.oauth_apps' => 'hay aplicaciones OAuth activas',
        'module.integrations' => 'hay integraciones con proveedores activas',
        'module.webhooks' => 'hay webhooks activos',
        'module.api_access' => 'hay llaves de API activas',
    ];

    public function blockers(string $tenantId, string $planId): array
    {
        $limits = $this->db()->table('plan_limits')->where('plan_id', $planId)->whereNotNull('value')->pluck('value', 'metric');
        $features = $this->db()->table('plan_features')->where('plan_id', $planId)->pluck('feature_key')->all();
        $usage = $this->usage($tenantId);
        $blockers = [];

        foreach (self::LIMITS as $metric => [$label, $fix]) {
            if (isset($limits[$metric]) && $usage[$metric] > (float) $limits[$metric]) {
                $blockers[] = "tiene {$this->number($usage[$metric])} {$label} y el plan permite {$limits[$metric]}: {$fix}";
            }
        }

        foreach (self::MODULES as $feature => $reason) {
            if (! in_array($feature, $features, true) && $this->inUse($feature, $tenantId, $usage)) {
                $blockers[] = "{$reason} y el plan no incluye ese módulo";
            }
        }

        return array_values(array_unique($blockers));
    }

    public function warnings(string $tenantId, string $planId): array
    {
        $db = $this->db();
        $plans = $db->table('plans')->get(['id', 'code', 'name', 'rank'])->keyBy('id');
        $target = $plans->get($planId);
        $current = $plans->get((string) $db->table('tenants')->where('id', $tenantId)->value('plan_id'));

        if ($target === null || $current === null || (int) $target->rank >= (int) $current->rank) {
            return [];
        }

        $warnings = [];
        $theme = $db->table('cms_site_themes as th')->join('platform_site_templates as tp', 'tp.id', '=', 'th.template_id')
            ->where('th.tenant_id', $tenantId)->where('th.status', 'activo')->first(['tp.name', 'tp.min_plan_code']);
        $minimum = $theme?->min_plan_code !== null ? $plans->firstWhere('code', $theme->min_plan_code) : null;

        if ($minimum !== null && (int) $minimum->rank > (int) $target->rank) {
            $warnings[] = "Tu sitio usa la plantilla {$theme->name}, disponible desde {$minimum->name}: sigue publicada, pero en {$target->name} no podrás volver a aplicarla ni restaurarla";
        }

        $from = AiCredits::PLAN_INCLUDED[$current->code] ?? 0;
        $to = AiCredits::PLAN_INCLUDED[$target->code] ?? 0;

        if ($to < $from) {
            $warnings[] = "Los créditos de IA incluidos bajan de {$from} a {$to} al mes; los planes y paquetes de IA que contrataste se mantienen";
        }

        if ((int) $target->rank < 2 && ! $this->hasAddon($tenantId, TrackingPlan::ADDON)) {
            $warnings = [...$warnings, ...$this->trackingWarnings($tenantId, $target->name)];
        }

        return $warnings;
    }

    public function assert(string $tenantId, object $plan): void
    {
        $blockers = $this->blockers($tenantId, (string) ($plan->id ?? $plan->getKey()));

        if ($blockers !== []) {
            throw ApiException::unprocessable('SUB_DOWNGRADE_BLOCKED', "No se puede pasar al plan {$plan->name}: ".implode('; ', $blockers).'.', ['blockers' => $blockers]);
        }
    }

    public function isDowngrade(?string $fromPlanId, string $toPlanId): bool
    {
        $ranks = $this->db()->table('plans')->whereIn('id', array_filter([$fromPlanId, $toPlanId]))->pluck('rank', 'id');

        return $fromPlanId !== null && isset($ranks[$fromPlanId], $ranks[$toPlanId]) && (int) $ranks[$toPlanId] < (int) $ranks[$fromPlanId];
    }

    private function usage(string $tenantId): array
    {
        $db = $this->db();

        return [
            'users' => StaffSeats::count($db->table('iam_users')->where('tenant_id', $tenantId)),
            'sedes' => $db->table('iam_sedes')->where('tenant_id', $tenantId)->whereNull('deleted_at')->where('status', 'activa')->count(),
            'storage_gb' => round((int) $db->table('tenants')->where('id', $tenantId)->value('storage_used_bytes') / 1024 ** 3, 2),
            'api_keys' => $db->table('integration_api_keys')->where('tenant_id', $tenantId)->where('status', 'active')->count(),
            'webhooks' => $db->table('integration_webhooks')->where('tenant_id', $tenantId)->whereNull('deleted_at')->where('status', 'active')->count(),
        ];
    }

    private function inUse(string $feature, string $tenantId, array $usage): bool
    {
        $db = $this->db();

        return match ($feature) {
            'module.ecommerce' => $db->table('channel_ecom_orders')->where('tenant_id', $tenantId)->exists(),
            'module.cms' => $db->table('cms_contents')->where('tenant_id', $tenantId)->where('status', 'publicado')->exists(),
            'module.mobile_apps' => $db->table('iam_users')->where('tenant_id', $tenantId)->whereNull('deleted_at')->where('status', 'activo')->where(fn ($query) => $query->whereNotNull('guide_id')->orWhereNotNull('driver_id'))->exists(),
            'module.oauth_apps' => $db->table('integration_oauth_apps')->where('tenant_id', $tenantId)->where('status', 'active')->exists(),
            'module.integrations' => $db->table('integration_adapters')->where('tenant_id', $tenantId)->where('status', 'activo')->exists(),
            'module.webhooks' => $usage['webhooks'] > 0,
            'module.api_access' => $usage['api_keys'] > 0,
            default => false,
        };
    }

    private function trackingWarnings(string $tenantId, string $planName): array
    {
        $providers = collect(TrackingCatalog::PROVIDERS)->filter(fn (array $meta): bool => $meta['min_rank'] > 1)->keys()->all();
        $tags = $this->db()->table('mkt_tracking_tags')->where('tenant_id', $tenantId)->whereIn('status', ['activo', 'pausado', 'en_revision'])
            ->where(fn ($query) => $query->whereIn('provider', $providers)->orWhereRaw("coalesce((config->>'server_side')::boolean, false)"))->count();
        $price = $this->db()->table('addons')->where('code', TrackingPlan::ADDON)->value('price_month');
        $offer = $price !== null ? ' ('.Decimal::display($price, 'PEN').' al mes + IGV)' : '';
        $warnings = [];

        if ($tags > 0) {
            $warnings[] = "Tienes {$tags} ".($tags === 1 ? 'etiqueta' : 'etiquetas')." de seguimiento que en {$planName} piden Marketing Pro{$offer}: quedan guardadas, pero no podrás editarlas sin el complemento";
        }

        $warnings[] = "Visitas del sitio mostrará solo los últimos 30 días y sin exportación, salvo que contrates Marketing Pro{$offer}";

        return $warnings;
    }

    private function hasAddon(string $tenantId, string $addon): bool
    {
        return $this->db()->table('subscription_items as i')->join('subscriptions as s', 's.id', '=', 'i.subscription_id')
            ->where('s.tenant_id', $tenantId)->where('s.status', '<>', 'canceled')->where('i.addon_code', $addon)
            ->where(fn ($query) => $query->whereNull('i.ends_at')->orWhere('i.ends_at', '>', now()))->exists();
    }

    private function number(float|int $value): string
    {
        return rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
