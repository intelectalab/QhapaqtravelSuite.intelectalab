<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use Database\Seeders\Modules\Concerns\SeedsFinance;
use Database\Support\KitSeeds;

final class FinanceReconciliationSeeder
{
    use SeedsFinance;

    public function run(): void
    {
        foreach (KitSeeds::read('bankLines') as $seed) {
            $status = $seed['status'] === 'excepción' ? 'excepcion' : $seed['status'];
            $match = $seed['match'] ?? null;
            $this->upsert('fin_bank_lines', ['code' => $seed['id']], [
                'bank' => $seed['bank'],
                'value_date' => $this->day($seed['date']),
                'description' => $seed['desc'],
                'amount' => $seed['amount'],
                'currency' => $seed['currency'],
                'matched_payment_id' => $match && str_starts_with($match, 'PAG-') ? $this->codeId('fin_payments', $match) : null,
                'matched_payable_id' => $match && str_starts_with($match, 'CXP-') ? $this->codeId('fin_payables', $match) : null,
                'status' => $status,
                'resolution' => $status === 'conciliado' ? 'match' : null,
                'resolved_by' => $status === 'conciliado' ? $this->userId('U07') : null,
                'created_by' => $this->userId('U07'),
                'created_at' => $this->moment($seed['date'].' 07:00'),
            ]);
        }

        foreach (KitSeeds::read('reconClosures') as $seed) {
            $this->upsert('fin_reconciliation_closures', ['code' => $seed['id']], [
                'period' => $seed['period'],
                'closed_at' => $this->moment($seed['closedAt'] ?? null) ?? now(),
                'closed_by' => $this->userId($seed['closedBy'] ?? 'U07'),
                'lines_count' => $seed['lines'] ?? 0,
                'credits' => $seed['credits'] ?? 0,
                'debits' => $seed['debits'] ?? 0,
                'net' => $seed['net'] ?? 0,
                'matched_count' => $seed['matched'] ?? 0,
                'others_count' => $seed['others'] ?? 0,
            ]);
        }
    }
}
