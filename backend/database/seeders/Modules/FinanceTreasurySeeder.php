<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use Database\Seeders\Modules\Concerns\SeedsFinance;
use Database\Support\KitSeeds;
use Illuminate\Support\Facades\DB;

final class FinanceTreasurySeeder
{
    use SeedsFinance;

    private const ACCOUNT_KINDS = ['banco' => 'bank', 'caja' => 'petty_cash', 'pasarela' => 'gateway'];

    private const MOVEMENT_TYPES = [
        'ingreso' => 'collection', 'reversion' => 'collection_reversal', 'pago_proveedor' => 'supplier_payment', 'transferencia' => 'transfer',
        'gasto_caja' => 'petty_expense', 'reposicion' => 'replenishment', 'liquidacion_pasarela' => 'gateway_settlement', 'comision_pasarela' => 'gateway_fee',
        'ajuste_arqueo' => 'count_adjustment', 'ingreso_otro' => 'other_income', 'egreso_otro' => 'other_expense',
    ];

    private const SOURCES = ['payment' => 'payment', 'reversal' => 'payment_reversal', 'payable' => 'payable', 'transfer' => 'transfer', 'expense' => 'expense', 'gateway' => 'gateway', 'count' => 'cash_count', 'manual' => 'manual'];

    private const TRANSFER_KINDS = ['transferencia' => 'transfer', 'reposicion' => 'replenishment', 'liquidacion_pasarela' => 'gateway_settlement'];

    private const RECEIPTS = ['Factura' => 'invoice', 'Boleta de venta' => 'sales_receipt', 'Ticket / cinta' => 'ticket', 'Recibo por honorarios' => 'fee_receipt', 'Planilla de movilidad' => 'mobility_sheet', 'Declaración jurada' => 'sworn_statement'];

    private array $accounts = [];

    private array $transfers = [];

    private array $movements = [];

    public function run(): void
    {
        $this->seedSettings();
        $this->seedAccounts();
        $this->seedTransfers();
        $this->seedReplenishments();
        $this->seedMovements();
        $this->seedCash();
        $this->seedRevaluations();
    }

    private function seedSettings(): void
    {
        $seed = KitSeeds::read('treasurySettings');
        $this->upsert('fin_treasury_settings', [], [
            'petty_tolerance' => $seed['tolerance'],
            'max_petty_expense' => $seed['maxExpense'],
            'sworn_statement_max' => $seed['djMax'],
            'replenish_threshold_pct' => $seed['replenishPct'],
            'gateway_fee_pct' => $seed['gatewayFeePct'],
            'cash_deposit_hours' => $seed['depositHours'],
            'recurring_outflows' => json_encode($seed['recurring'], JSON_UNESCAPED_UNICODE),
        ]);
    }

    private function seedAccounts(): void
    {
        $seeds = KitSeeds::read('treasuryAccounts');
        foreach ([false, true] as $gatewayPass) {
            foreach ($seeds as $seed) {
                $kind = self::ACCOUNT_KINDS[$seed['kind']];
                if (($kind === 'gateway') !== $gatewayPass) {
                    continue;
                }
                $this->accounts[$seed['id']] = $this->upsert('fin_treasury_accounts', ['code' => $seed['id']], [
                    'kind' => $kind,
                    'bank' => $seed['bank'] ?: null,
                    'name' => $seed['name'],
                    'account_number' => $seed['number'] ?: null,
                    'cci' => $seed['cci'] ?? null,
                    'currency' => $seed['currency'],
                    'sede_id' => $this->codeId('iam_sedes', $seed['sede']),
                    'fund_amount' => $seed['fund'] ?? null,
                    'custodian_id' => isset($seed['custodian']) ? $this->userId($seed['custodian']) : null,
                    'settle_to_account_id' => isset($seed['settleTo']) ? $this->accounts[$seed['settleTo']] : null,
                    'opening_balance' => $seed['opening'],
                    'opening_rate' => $seed['openingRate'],
                    'opening_date' => $this->day($seed['openingDate']),
                    'status' => $seed['status'] === 'activa' ? 'active' : 'inactive',
                    'created_by' => $this->userId('U07'),
                ]);
            }
        }
    }

    private function seedTransfers(): void
    {
        foreach (collect(KitSeeds::read('treasuryMovements'))->whereNotNull('transferId')->groupBy('transferId') as $code => $legs) {
            $out = $legs->first(fn (array $leg): bool => $leg['dir'] === 'out' && $leg['type'] !== 'comision_pasarela');
            $in = $legs->firstWhere('dir', 'in');
            if ($out === null || $in === null) {
                continue;
            }
            $this->transfers[$code] = $this->upsert('fin_treasury_transfers', ['code' => $code], [
                'from_account_id' => $this->accounts[$out['accountId']],
                'to_account_id' => $this->accounts[$in['accountId']],
                'amount_from' => $out['amount'] + ($legs->firstWhere('type', 'comision_pasarela')['amount'] ?? 0),
                'amount_to' => $in['amount'],
                'deal_rate' => $out['currency'] !== $in['currency'] ? ($out['fx'] ?? $in['fx']) : null,
                'kind' => self::TRANSFER_KINDS[$out['type']] ?? 'transfer',
                'transfer_date' => $this->day($out['date']),
                'reference' => $out['ref'],
                'created_by' => $this->actor($out['by']),
            ]);
        }
    }

    private function seedReplenishments(): void
    {
        foreach (KitSeeds::read('cashReplenishments') as $seed) {
            $status = ['solicitada' => 'requested', 'aprobada' => 'approved', 'pagada' => 'paid', 'rechazada' => 'rejected'][$seed['status']];
            $id = $this->upsert('fin_cash_replenishments', ['code' => $seed['id']], [
                'account_id' => $this->accounts[$seed['accountId']],
                'amount' => $seed['amount'],
                'status' => $status,
                'requested_by' => $this->actor($seed['requestedBy']),
                'requested_at' => $this->moment($seed['requestedAt']),
                'approved_by' => $this->actor($seed['approvedBy'] ?? null),
                'approved_at' => $this->moment($seed['approvedAt'] ?? null),
                'paid_by' => $this->actor($seed['paidBy'] ?? null),
                'paid_at' => $this->moment($seed['paidAt'] ?? null),
                'paid_from_account_id' => isset($seed['paidFrom']) ? $this->accounts[$seed['paidFrom']] : null,
                'transfer_id' => isset($seed['transferId']) ? ($this->transfers[$seed['transferId']] ?? null) : null,
                'note' => $seed['note'] ?? null,
                'created_by' => $this->actor($seed['requestedBy']),
            ]);
            DB::table('fin_cash_replenishment_events')->where('replenishment_id', $id)->delete();
            $previous = null;
            foreach ($seed['log'] ?? [] as $index => $entry) {
                $to = $index === 0 ? 'requested' : (str_starts_with($entry['m'], 'Aprobada') ? 'approved' : (str_starts_with($entry['m'], 'Pagada') ? 'paid' : $status));
                DB::table('fin_cash_replenishment_events')->insert([
                    'tenant_id' => $this->tenant->getKey(),
                    'replenishment_id' => $id,
                    'from_status' => $previous,
                    'to_status' => $to,
                    'note' => $entry['m'],
                    'user_id' => $this->actor($entry['u']),
                    'created_by' => $this->actor($entry['u']),
                    'created_at' => $this->moment($entry['ts']),
                ]);
                $previous = $to;
            }
            foreach ($seed['movIds'] ?? [] as $movement) {
                $this->movements[$movement]['replenishment'] = $id;
            }
        }
    }

    private function seedMovements(): void
    {
        foreach (array_reverse(KitSeeds::read('treasuryMovements')) as $seed) {
            $orig = $seed['orig'] ?? null;
            $by = $this->actor($seed['by']);
            $id = $this->upsert('fin_treasury_movements', ['code' => $seed['id']], [
                'account_id' => $this->accounts[$seed['accountId']],
                'movement_date' => $this->day($seed['date']),
                'direction' => $seed['dir'],
                'type' => self::MOVEMENT_TYPES[$seed['type']] ?? ($seed['dir'] === 'in' ? 'other_income' : 'other_expense'),
                'amount' => $seed['amount'],
                'currency' => $seed['currency'],
                'fx_rate' => $seed['currency'] === 'USD' ? ($seed['fx'] ?? $this->usdRate()) : null,
                'orig_amount' => $orig['amount'] ?? null,
                'orig_currency' => $orig['currency'] ?? null,
                'orig_fx_rate' => $orig['fx'] ?? null,
                'source_type' => self::SOURCES[$seed['srcKind'] ?? 'manual'] ?? 'manual',
                'source_id' => $this->sourceId($seed),
                'source_key' => $seed['srcKey'] ?? null,
                'transfer_id' => isset($seed['transferId']) ? ($this->transfers[$seed['transferId']] ?? null) : null,
                'replenishment_id' => $this->movements[$seed['id']]['replenishment'] ?? null,
                'reservation_id' => $this->codeId('booking_reservations', $seed['resId'] ?? null),
                'category' => $seed['category'] ?? null,
                'description' => $seed['desc'],
                'reference' => $seed['ref'] ?? null,
                'counterparty' => $seed['counterparty'] ?? null,
                'sede_id' => $this->codeId('iam_sedes', $seed['sede'] ?? null),
                'status' => 'posted',
                'created_by' => $by,
                'created_at' => $this->moment($seed['createdAt']),
            ]);
            $this->movements[$seed['id']]['id'] = $id;

            $receipt = $seed['receipt'] ?? null;
            if ($receipt && isset(self::RECEIPTS[$receipt['type'] ?? ''])) {
                $type = self::RECEIPTS[$receipt['type']];
                $ruc = preg_match('/^\d{11}$/', (string) ($receipt['ruc'] ?? '')) === 1 ? $receipt['ruc'] : null;
                if (in_array($type, ['invoice', 'fee_receipt'], true) && $ruc === null) {
                    continue;
                }
                $this->upsert('fin_expense_receipts', ['movement_id' => $id], [
                    'receipt_type' => $type,
                    'series_number' => $receipt['number'] ?? null,
                    'issuer_ruc' => $ruc,
                    'supplier_name' => $seed['counterparty'] ?? 'Sin proveedor',
                    'created_by' => $by,
                ]);
            }
        }
    }

    private function sourceId(array $seed): ?string
    {
        $source = $seed['srcId'] ?? null;

        return match (true) {
            $source === null => null,
            str_starts_with($source, 'PAG-') => $this->codeId('fin_payments', $source),
            str_starts_with($source, 'CXP-') => $this->codeId('fin_payables', $source),
            default => null,
        };
    }

    private function seedCash(): void
    {
        $counts = [];
        foreach (KitSeeds::read('cashCounts') as $seed) {
            $counts[$seed['id']] = $this->upsert('fin_cash_counts', ['code' => $seed['id']], [
                'account_id' => $this->accounts[$seed['accountId']],
                'kind' => $seed['kind'] === 'cierre' ? 'closing' : 'surprise',
                'counted_at' => $this->moment($seed['ts']),
                'denominations' => json_encode($seed['denoms']),
                'counted_amount' => $seed['counted'],
                'expected_amount' => $seed['expected'],
                'difference' => $seed['diff'],
                'result' => ['cuadrado' => 'balanced', 'faltante' => 'short', 'sobrante' => 'over'][$seed['result']],
                'note' => $seed['note'] ?: null,
                'signed_by' => $this->userId($seed['signedBy']),
                'signed_at' => $this->moment($seed['signedAt']),
                'witness_id' => $this->actor($seed['witness'] ?? null),
                'status' => ['firmado' => 'signed', 'pendiente_aprobacion' => 'pending_approval', 'aprobado' => 'approved', 'validado' => 'validated'][$seed['status']],
                'validated_by' => $this->actor($seed['validatedBy'] ?? null),
                'validated_at' => $this->moment($seed['validatedAt'] ?? null),
                'adjustment_movement_id' => isset($seed['adjustmentMovId']) ? ($this->movements[$seed['adjustmentMovId']]['id'] ?? null) : null,
                'created_by' => $this->userId($seed['signedBy']),
            ]);
        }

        foreach (KitSeeds::read('cashSessions') as $seed) {
            $closed = $seed['status'] === 'cerrada';
            $sessionId = $this->upsert('fin_cash_sessions', ['code' => $seed['id']], [
                'account_id' => $this->accounts[$seed['accountId']],
                'session_date' => $this->day($seed['date']),
                'opened_at' => $this->moment($seed['date'].' '.$seed['openedAt']),
                'opened_by' => $this->userId($seed['openedBy']),
                'opening_amount' => $seed['openingAmount'],
                'closed_at' => $closed ? $this->moment($seed['date'].' '.$seed['closedAt']) : null,
                'closed_by' => $closed ? $this->userId($seed['closedBy']) : null,
                'closing_count_id' => $closed ? ($counts[$seed['closingCountId']] ?? null) : null,
                'status' => $closed ? 'closed' : 'open',
                'created_by' => $this->userId($seed['openedBy']),
            ]);
            if ($closed && isset($counts[$seed['closingCountId']])) {
                DB::table('fin_cash_counts')->where('id', $counts[$seed['closingCountId']])->update(['session_id' => $sessionId]);
            }
        }
    }

    private function seedRevaluations(): void
    {
        foreach (KitSeeds::read('fxRevaluations') as $seed) {
            $date = $this->day($seed['date']);
            $this->upsert('fin_fx_revaluations', ['code' => $seed['id']], [
                'account_id' => $this->accounts[$seed['accountId']],
                'period' => substr((string) $date, 0, 7),
                'revaluation_date' => $date,
                'balance_usd' => $seed['balance'],
                'book_rate' => $seed['bookRate'],
                'close_rate' => $seed['closeRate'],
                'diff_pen' => $seed['diffPEN'],
                'created_by' => $this->actor($seed['by']),
                'created_at' => $this->moment($seed['at']),
            ]);
        }
    }
}
