<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class MarkOverdueReceivables extends TenantJob
{
    public const QUEUE = 'low';

    protected function run(): string
    {
        $today = $this->today()->toDateString();
        $receivables = $this->markOverdue('fin_receivables', ['abierta', 'parcial'], $today, 'Cuenta por cobrar');
        $payables = $this->markOverdue('fin_payables', ['abierta', 'aprobada', 'parcial'], $today, 'Cuenta por pagar');

        if ($receivables + $payables === 0) {
            return 'Sin cuentas vencidas nuevas';
        }

        return implode(' · ', array_filter([
            $receivables > 0 ? self::plural($receivables, 'cuenta por cobrar vencida', 'cuentas por cobrar vencidas') : null,
            $payables > 0 ? self::plural($payables, 'cuenta por pagar vencida', 'cuentas por pagar vencidas') : null,
        ]));
    }

    private function markOverdue(string $table, array $statuses, string $today, string $entity): int
    {
        $rows = DB::table($table)->whereIn('status', $statuses)->where('due_date', '<', $today)
            ->whereColumn('paid_amount', '<', 'amount')->orderBy('id')->lockForUpdate()->get(['id', 'code', 'status']);

        if ($rows->isEmpty()) {
            return 0;
        }

        DB::table($table)->whereIn('id', $rows->pluck('id'))->update(['status' => 'vencida', 'updated_at' => now()]);
        $audit = app(AuditLogger::class);

        foreach ($rows as $row) {
            $audit->log($entity, (string) $row->code, 'vencer', (string) $row->status, 'vencida');
        }

        return $rows->count();
    }
}
