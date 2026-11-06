<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ApprovalRules
{
    public const PERMISSION_LABELS = [
        'quotes.approve_internal' => 'Gerencia comercial',
        'reservations.cancel' => 'Anular reservas',
        'finance.payments.revert' => 'Revertir pagos',
        'finance.payables' => 'Cuentas por pagar',
        'finance.profitability' => 'Rentabilidad',
        'finance.commissions' => 'Comisiones',
        'catalog.providers.manage' => 'Proveedores',
        'finance.receivables' => 'Cuentas por cobrar',
        'admin.settings.manage' => 'Configuración',
    ];

    private ?Collection $rows = null;

    public function all(): Collection
    {
        return $this->rows ??= DB::table('collab_approval_rules')->whereNull('deleted_at')->orderBy('request_type')->orderBy('level')->orderBy('min_amount_pen')->get();
    }

    public function forget(): void
    {
        $this->rows = null;
    }

    public function list(): Collection
    {
        $approvers = $this->approvers();

        return $this->all()->map(fn ($rule): array => [
            'code' => $rule->code,
            'type' => $rule->request_type,
            'type_label' => ApprovalInbox::TYPES[$rule->request_type] ?? $rule->request_type,
            'level' => (int) $rule->level,
            'permission' => $rule->permission,
            'permission_label' => self::PERMISSION_LABELS[$rule->permission] ?? $rule->permission,
            'approvers' => $approvers[$rule->permission] ?? [],
            'min_amount' => (float) $rule->min_amount_pen,
            'sla_hours' => (int) $rule->sla_hours,
            'forbid_self' => (bool) $rule->forbid_self_approval,
            'active' => (bool) $rule->is_active,
            'locked' => (bool) $rule->is_origin_locked,
        ])->values();
    }

    public function active(string $type): Collection
    {
        return $this->all()->where('request_type', $type)->where('is_active', true);
    }

    public function rule(string $type, int $level): ?object
    {
        return $this->active($type)->where('level', $level)->sortBy('min_amount_pen')->first();
    }

    public function sla(string $type, int $level): int
    {
        return (int) ($this->rule($type, $level)->sla_hours ?? 24);
    }

    public function permission(string $type, int $level): ?string
    {
        return $this->rule($type, $level)?->permission;
    }

    public function permissions(string $type): array
    {
        return $this->active($type)->pluck('permission')->unique()->values()->all();
    }

    public function levels(string $type, float $amountPen): int
    {
        return max(1, $this->active($type)->filter(fn ($rule): bool => (float) $rule->min_amount_pen <= $amountPen)->pluck('level')->unique()->count());
    }

    public function permissionOptions(): array
    {
        return collect(self::PERMISSION_LABELS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all();
    }

    private function approvers(): array
    {
        return DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('role_has_permissions as rp', 'rp.role_id', '=', 'mr.role_id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where('u.status', 'activo')->whereNull('u.deleted_at')
            ->whereIn('p.name', array_keys(self::PERMISSION_LABELS))
            ->distinct()->orderBy('u.name')
            ->get(['p.name as permission', 'u.name'])
            ->groupBy('permission')
            ->map(fn (Collection $rows): array => $rows->pluck('name')->all())
            ->all();
    }
}
