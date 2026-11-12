<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\TreasuryDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Support\Facades\DB;

final class TreasuryMovementWorkflow
{
    public function __construct(private readonly SequenceService $sequences, private readonly Consolidation $money, private readonly AuditLogger $audit) {}

    public function record(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $account = DB::table('fin_treasury_accounts')->where('code', $data['account'])->whereNull('deleted_at')->lockForUpdate()->first(['id', 'code', 'name', 'currency', 'kind', 'status', 'sede_id', 'opening_balance']);

            if ($account === null || $account->status !== 'active') {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una cuenta activa.');
            }

            if ($account->kind !== 'bank') {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Los movimientos manuales se registran en cuentas bancarias. Las cajas chicas usan gastos y arqueos, y las pasarelas su liquidación.');
            }

            if (! in_array($data['category'], TreasuryDirectory::CATEGORIES[$data['direction']], true)) {
                throw ApiException::unprocessable('VALIDATION_ERROR', $data['direction'] === 'in' ? 'Elige una categoría de ingreso.' : 'Elige una categoría de egreso.');
            }

            $amount = Decimal::money($data['amount']);
            $direction = $data['direction'];
            if ($direction === 'out') {
                $flow = DB::table('fin_treasury_movements')->where('account_id', $account->id)->where('status', 'posted')
                    ->selectRaw("coalesce(sum(case when direction = 'in' then amount else -amount end), 0) as net")->value('net');
                if ($amount->isGreaterThan(Decimal::of($account->opening_balance)->plus(Decimal::of($flow)))) {
                    throw ApiException::unprocessable('TES-BR-01', 'El egreso supera el saldo disponible de la cuenta.');
                }
            }

            $code = $this->sequences->next('treasury_movement');
            DB::table('fin_treasury_movements')->insert([
                'code' => $code,
                'account_id' => $account->id,
                'movement_date' => $data['date'],
                'direction' => $direction,
                'type' => $direction === 'in' ? 'other_income' : 'other_expense',
                'amount' => (string) $amount,
                'currency' => $account->currency,
                'fx_rate' => $this->money->fxFor($account->currency),
                'source_type' => 'manual',
                'category' => $data['category'],
                'description' => $data['description'],
                'reference' => $data['reference'] ?? null,
                'counterparty' => $data['counterparty'] ?? null,
                'sede_id' => $account->sede_id,
                'status' => 'posted',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Movimiento de tesorería', $code, 'registrar', null, "{$account->code} · {$direction} · {$account->currency} {$amount}");

            return $code;
        });
    }

    public function void(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $movement = DB::table('fin_treasury_movements')->where('code', $code)->lockForUpdate()->first(['id', 'code', 'status', 'source_type', 'type', 'replenishment_id', 'transfer_id']);

            if ($movement === null) {
                throw ApiException::notFound('El movimiento no existe.');
            }

            $expense = $movement->type === 'petty_expense' && $movement->replenishment_id === null;
            $gateway = in_array($movement->type, ['gateway_settlement', 'gateway_fee'], true);
            $transfer = $movement->source_type === 'transfer' && $movement->transfer_id !== null;

            if ($movement->status !== 'posted' || ! self::voidable($movement)) {
                throw ApiException::conflict('TES-BR-02', $movement->type === 'petty_expense' ? 'El gasto ya se rindió en una reposición: anúlalo desde la reposición.' : 'Solo se anulan movimientos manuales, transferencias, gastos de caja sin rendir y liquidaciones de pasarela; los cobros y pagos se corrigen desde su origen.');
            }

            $ids = ($gateway || $transfer) && $movement->transfer_id ? DB::table('fin_treasury_movements')->where('transfer_id', $movement->transfer_id)->where('status', 'posted')->pluck('id')->push($movement->id)->unique()->all() : [$movement->id];
            DB::table('fin_treasury_movements')->whereIn('id', $ids)->update(['status' => 'voided', 'void_reason' => $reason, 'voided_by' => $actor->getKey(), 'voided_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($movement->type === 'replenishment' && $movement->replenishment_id !== null) {
                DB::table('fin_cash_replenishments')->where('id', $movement->replenishment_id)->where('status', 'paid')->update(['status' => 'approved', 'paid_at' => null, 'paid_by' => null, 'transfer_id' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }
            $this->audit->log('Movimiento de tesorería', $movement->code, 'anular', 'posted', $reason);
        });
    }

    public static function voidable(object $movement): bool
    {
        return $movement->source_type === 'manual'
            || ($movement->type === 'petty_expense' && $movement->replenishment_id === null)
            || in_array($movement->type, ['gateway_settlement', 'gateway_fee'], true)
            || ($movement->source_type === 'transfer' && $movement->transfer_id !== null);
    }
}
