<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageTenant
{
    private const CONNECTION = 'pgsql_platform';

    private const FIELDS = ['commercial_name' => 'Nombre comercial', 'legal_name' => 'Razón social', 'ruc' => 'RUC', 'fiscal_address' => 'Domicilio fiscal', 'business_type' => 'Tipo de negocio', 'subdomain' => 'Subdominio'];

    public function __construct(private readonly PlatformSession $session) {}

    public function changePlan(Tenant $tenant, string $planCode, ?string $reason, PlatformUser $actor): void
    {
        $plan = Plan::on(self::CONNECTION)->where('code', $planCode)->first() ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.');
        $current = Plan::on(self::CONNECTION)->find($tenant->plan_id);

        if ($current && $current->getKey() === $plan->getKey()) {
            throw ApiException::conflict('SAME_PLAN', "La agencia ya está en el plan {$plan->name}. No hubo cambios.");
        }

        $db = DB::connection(self::CONNECTION);
        $limits = $db->table('plan_limits')->where('plan_id', $plan->getKey())->pluck('value', 'metric');
        $users = $db->table('iam_users')->where('tenant_id', $tenant->getKey())->whereNull('deleted_at')->whereIn('status', ['activo', 'pendiente'])->count();
        $sedes = $db->table('iam_sedes')->where('tenant_id', $tenant->getKey())->whereNull('deleted_at')->where('status', 'activa')->count();
        $blockers = array_filter([
            isset($limits['users']) && $users > (int) $limits['users'] ? "tiene {$users} usuarios y el plan {$plan->name} permite {$limits['users']}; desactiva usuarios antes del cambio" : null,
            isset($limits['sedes']) && $sedes > (int) $limits['sedes'] ? "tiene {$sedes} sedes activas y el plan permite {$limits['sedes']}" : null,
            isset($limits['storage_gb']) && (int) $tenant->storage_used_bytes > (int) $limits['storage_gb'] * 1024 ** 3 ? 'usa más almacenamiento del que permite el plan' : null,
        ]);

        if ($blockers !== []) {
            throw ApiException::conflict('PLAN_LIMIT_EXCEEDED', 'No se puede pasar al plan '.$plan->name.': '.implode('; ', $blockers).'.');
        }

        $db->transaction(function () use ($tenant, $plan, $current, $reason, $actor): void {
            $tenant->forceFill([
                'plan_id' => $plan->getKey(),
                'mrr' => $tenant->status === 'activo' ? $plan->price_month : $tenant->mrr,
                'updated_by' => $actor->getKey(),
            ])->save();
            $this->session->log('Tenant', $tenant->code, 'cambio_plan', $current?->name, trim($plan->name.($reason ? " · {$reason}" : '')), $actor);
        });
    }

    public function update(Tenant $tenant, array $data, PlatformUser $actor): void
    {
        $db = DB::connection(self::CONNECTION);
        $values = [
            'commercial_name' => trim($data['commercial_name']),
            'legal_name' => trim($data['legal_name']),
            'ruc' => $data['ruc'],
            'fiscal_address' => trim($data['fiscal_address']),
            'business_type' => $data['business_type'],
            'subdomain' => Str::lower(trim($data['subdomain'])),
        ];

        if ($db->table('tenants')->where('subdomain', $values['subdomain'])->where('id', '<>', $tenant->getKey())->exists()) {
            throw ApiException::unprocessable('TEN-BR-01', 'El subdominio ya está en uso por otra agencia.');
        }

        if ($db->table('tenants')->where('ruc', $values['ruc'])->where('id', '<>', $tenant->getKey())->exists()) {
            throw ApiException::unprocessable('TEN-BR-02', 'Ya existe una agencia con ese RUC.');
        }

        $changed = array_filter(self::FIELDS, fn (string $label, string $field) => (string) $values[$field] !== (string) $tenant->getAttribute($field), ARRAY_FILTER_USE_BOTH);

        if ($changed === []) {
            return;
        }

        $db->transaction(function () use ($tenant, $values, $changed, $actor): void {
            $tenant->forceFill([...$values, 'updated_by' => $actor->getKey()])->save();
            $this->session->log('Tenant', $tenant->code, 'editar', null, implode(', ', $changed), $actor);
        });
    }
}
