<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use App\Domain\Iam\Models\User;

final class HomePanel
{
    public const PANELS = [
        'executive' => ['reports.view', 'finance.profitability'],
        'manager' => ['reports.view', 'finance.profitability'],
        'sales' => ['crm.leads.view'],
        'operations' => ['operations.view'],
        'finance' => ['finance.receivables'],
        'accounting' => ['finance.invoicing'],
    ];

    private const BY_ROLE = [
        'tenant_admin' => 'executive',
        'manager' => 'manager',
        'sales' => 'sales',
        'operations' => 'operations',
        'finance' => 'finance',
        'accounting' => 'accounting',
    ];

    private const FALLBACK = ['executive', 'sales', 'operations', 'finance', 'accounting'];

    public function __construct(
        private readonly ExecutivePanel $executive,
        private readonly ManagerPanel $manager,
        private readonly SalesPanel $sales,
        private readonly OperationsPanel $operations,
        private readonly FinancePanel $finance,
        private readonly AccountingPanel $accounting,
    ) {}

    public function pick(User $viewer): ?string
    {
        $role = self::BY_ROLE[$viewer->primaryRole()->name ?? ''] ?? null;
        if ($role === 'manager' && ! $this->canManage($viewer)) {
            $role = 'executive';
        }

        $candidates = $role === null ? self::FALLBACK : [$role, ...self::FALLBACK];

        foreach ($candidates as $panel) {
            if ($this->allowed($viewer, $panel)) {
                return $panel;
            }
        }

        return null;
    }

    public function build(User $viewer): array
    {
        $panel = $this->pick($viewer);

        return ['panel' => $panel ?? 'general', 'data' => $panel === null ? null : $this->panel($panel, $viewer)];
    }

    public function panel(string $panel, User $viewer): array
    {
        return match ($panel) {
            'executive' => $this->executive->build($viewer),
            'manager' => [...$this->executive->build($viewer), 'manager' => $this->manager->build($viewer)],
            'sales' => $this->sales->build($viewer),
            'operations' => $this->operations->build(),
            'finance' => $this->finance->build($viewer),
            default => $this->accounting->build($viewer),
        };
    }

    public function canManage(User $viewer): bool
    {
        return $viewer->can('quotes.approve_internal') || $viewer->can('approvals.view');
    }

    private function allowed(User $viewer, string $panel): bool
    {
        if ($panel === 'manager' && ! $this->canManage($viewer)) {
            return false;
        }

        return collect(self::PANELS[$panel])->every(fn (string $permission): bool => $viewer->can($permission));
    }
}
