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

    public const DEFAULTS = [
        ['code' => 'RA-01', 'type' => 'quote', 'level' => 1, 'permission' => 'quotes.approve_internal', 'min' => 0, 'sla' => 8],
        ['code' => 'RA-02', 'type' => 'cancel', 'level' => 1, 'permission' => 'reservations.cancel', 'min' => 0, 'sla' => 24],
        ['code' => 'RA-03', 'type' => 'cancel', 'level' => 2, 'permission' => 'finance.payments.revert', 'min' => 20000, 'sla' => 24],
        ['code' => 'RA-04', 'type' => 'reversal', 'level' => 1, 'permission' => 'finance.payments.revert', 'min' => 0, 'sla' => 24],
        ['code' => 'RA-05', 'type' => 'reversal', 'level' => 2, 'permission' => 'quotes.approve_internal', 'min' => 10000, 'sla' => 24],
        ['code' => 'RA-06', 'type' => 'payable', 'level' => 1, 'permission' => 'finance.payables', 'min' => 0, 'sla' => 48],
        ['code' => 'RA-07', 'type' => 'payable', 'level' => 2, 'permission' => 'finance.profitability', 'min' => 10000, 'sla' => 48],
        ['code' => 'RA-08', 'type' => 'commission', 'level' => 1, 'permission' => 'finance.commissions', 'min' => 0, 'sla' => 72],
        ['code' => 'RA-09', 'type' => 'provider_rate', 'level' => 1, 'permission' => 'catalog.providers.manage', 'min' => 0, 'sla' => 72],
        ['code' => 'RA-10', 'type' => 'credit_b2b', 'level' => 1, 'permission' => 'quotes.approve_internal', 'min' => 0, 'sla' => 24],
        ['code' => 'RA-11', 'type' => 'credit_b2b', 'level' => 2, 'permission' => 'finance.receivables', 'min' => 5000, 'sla' => 24],
        ['code' => 'RA-12', 'type' => 'refund', 'level' => 1, 'permission' => 'quotes.approve_internal', 'min' => 0, 'sla' => 24],
        ['code' => 'RA-13', 'type' => 'refund', 'level' => 2, 'permission' => 'finance.payments.revert', 'min' => 1000, 'sla' => 24],
        ['code' => 'RA-14', 'type' => 'other', 'level' => 1, 'permission' => 'quotes.approve_internal', 'min' => 0, 'sla' => 48],
    ];

    public const ORIGIN_LOCKED = ['quote', 'cancel', 'reversal', 'payable', 'commission', 'provider_rate'];

    public const RULE_TYPES = ['quote', 'cancel', 'reversal', 'payable', 'commission', 'provider_rate', 'credit_b2b', 'refund', 'other'];

    private ?Collection $rows = null;

    private ?array $people = null;

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
        $approvers = collect($this->approvers())->map(fn (array $users): array => array_column($users, 'name'))->all();

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

    public function rule(string $type, int $level, ?float $amountPen = null): ?object
    {
        $rules = $this->active($type)->where('level', $level);
        $applicable = $amountPen === null ? collect() : $rules->filter(fn ($rule): bool => (float) $rule->min_amount_pen <= $amountPen);

        return $applicable->isNotEmpty() ? $applicable->sortByDesc('min_amount_pen')->first() : $rules->sortBy('min_amount_pen')->first();
    }

    public function sla(string $type, int $level, ?float $amountPen = null): int
    {
        return (int) ($this->rule($type, $level, $amountPen)->sla_hours ?? 24);
    }

    public function permission(string $type, int $level, ?float $amountPen = null): ?string
    {
        return $this->rule($type, $level, $amountPen)?->permission;
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

    public function eligible(?string $permission): array
    {
        return $permission === null ? [] : ($this->approvers()[$permission] ?? []);
    }

    private function approvers(): array
    {
        return $this->people ??= DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('role_has_permissions as rp', 'rp.role_id', '=', 'mr.role_id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where('u.status', 'activo')->whereNull('u.deleted_at')
            ->whereIn('p.name', array_keys(self::PERMISSION_LABELS))
            ->distinct()->orderBy('u.name')
            ->get(['p.name as permission', 'u.id', 'u.name'])
            ->groupBy('permission')
            ->map(fn (Collection $rows): array => $rows->map(fn (object $row): array => ['id' => (string) $row->id, 'name' => $row->name])->values()->all())
            ->all();
    }
}
