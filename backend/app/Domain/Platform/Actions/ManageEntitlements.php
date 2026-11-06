<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageEntitlements
{
    private const CONNECTION = 'pgsql_platform';

    private const MAX_OVERRIDE_DAYS = 180;

    public function __construct(
        private readonly PlatformSession $session,
        private readonly PlatformSettings $settings,
    ) {}

    public function setPlanFeature(string $featureKey, string $planCode, ?string $value, PlatformUser $actor): void
    {
        $feature = $this->db()->table('features')->where('key', $featureKey)->first() ?? throw ApiException::notFound('La funcionalidad no existe.');
        $plan = $this->db()->table('plans')->where('code', $planCode)->first() ?? throw ApiException::notFound('El plan no existe.');
        $current = $this->db()->table('plan_features')->where('plan_id', $plan->id)->where('feature_key', $featureKey)->value('value');

        if ($current === $value) {
            return;
        }

        $this->db()->transaction(function () use ($feature, $plan, $value, $current, $actor): void {
            if ($value === null) {
                $this->db()->table('plan_features')->where('plan_id', $plan->id)->where('feature_key', $feature->key)->delete();
            } else {
                $this->db()->table('plan_features')->updateOrInsert(['plan_id' => $plan->id, 'feature_key' => $feature->key], ['value' => $value]);
            }

            $modules = $this->db()->table('plan_features as pf')->join('features as f', 'f.key', '=', 'pf.feature_key')->where('pf.plan_id', $plan->id)->where('f.kind', 'module')->count();
            $this->db()->table('plans')->where('id', $plan->id)->update(['module_count' => $modules, 'updated_at' => now()]);
            $this->session->log('Feature flag', "{$feature->key}@{$plan->code}", 'plan_entitlement', $current ?? 'no incluido', ($value ?? 'no incluido')." · {$feature->label} en {$plan->name}", $actor);
        });
    }

    public function createOverride(array $data, PlatformUser $actor): void
    {
        $tenant = $this->db()->table('tenants')->where('code', $data['tenant'])->first() ?? throw ApiException::unprocessable('TENANT', 'Elige una agencia de la lista.');
        $feature = $this->db()->table('features')->where('key', $data['feature'])->first() ?? throw ApiException::unprocessable('FEATURE', 'Elige una funcionalidad de la lista.');
        $until = $data['valid_until'] ? Carbon::parse($data['valid_until'], 'America/Lima') : null;

        if ($until === null || $until->gt(Carbon::today('America/Lima')->addDays(self::MAX_OVERRIDE_DAYS))) {
            throw ApiException::unprocessable('PLN-BR-03', 'Una excepción dura como máximo 180 días. Indica una fecha de vencimiento dentro de ese plazo.');
        }

        if ($until->lt(Carbon::today('America/Lima'))) {
            throw ApiException::unprocessable('PLN-BR-03', 'La fecha de vencimiento no puede estar en el pasado.');
        }

        $this->db()->transaction(function () use ($tenant, $feature, $data, $until, $actor): void {
            $existing = $this->db()->table('feature_overrides')->where('tenant_id', $tenant->id)->where('feature_key', $feature->key)->first();
            $values = ['value' => (bool) $data['value'], 'reason' => mb_substr(trim($data['reason']), 0, 300), 'valid_until' => $until->toDateString(), 'granted_by' => $actor->getKey()];

            if ($existing) {
                $this->db()->table('feature_overrides')->where('id', $existing->id)->update($values);
            } else {
                $this->db()->table('feature_overrides')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $tenant->id, 'feature_key' => $feature->key, 'created_by' => $actor->getKey(), 'created_at' => now(), ...$values]);
            }

            $this->session->log('Feature flag', "{$feature->key}@{$tenant->code}", 'override', $existing ? ($existing->value ? 'habilitado' : 'bloqueado') : null, ($data['value'] ? 'habilitado' : 'bloqueado')." hasta {$until->format('d/m/Y')} · {$tenant->commercial_name} · {$data['reason']}", $actor);
        });
    }

    public function deleteOverride(string $id, PlatformUser $actor): void
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La excepción no existe.');
        }

        $override = $this->db()->table('feature_overrides as o')->join('tenants as t', 't.id', '=', 'o.tenant_id')->where('o.id', $id)->first(['o.*', 't.code', 't.commercial_name'])
            ?? throw ApiException::notFound('La excepción no existe.');

        $this->db()->transaction(function () use ($override, $actor): void {
            $this->db()->table('feature_overrides')->where('id', $override->id)->delete();
            $this->session->log('Feature flag', "{$override->feature_key}@{$override->code}", 'quitar_override', $override->value ? 'habilitado' : 'bloqueado', "rige el plan · {$override->commercial_name}", $actor);
        });
    }

    public function updateDunningPolicy(array $data, PlatformUser $actor): void
    {
        $before = $this->settings->dunning();
        $days = array_values(array_unique(array_map('intval', $data['retry_days'])));
        sort($days);

        if (count($days) !== count($data['retry_days'])) {
            throw ApiException::unprocessable('DUNNING_DAYS', 'Los días de reintento no pueden repetirse.');
        }

        $policy = ['retry_days' => $days, 'suspend_after_last' => (bool) $data['suspend_after_last']];

        $this->db()->transaction(function () use ($policy, $before, $actor): void {
            $this->settings->put('dunning', $policy, null);
            $this->session->log('Política de cobranza', 'dunning', 'editar_politica', $this->label($before), $this->label($policy), $actor);
        });
    }

    private function label(array $policy): string
    {
        return 'D+'.implode(', D+', $policy['retry_days']).($policy['suspend_after_last'] ? ' · suspende al final' : ' · sin suspensión');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
