<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\PayableDirectory;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class PayableWorkflow
{
    public function __construct(private readonly Consolidation $money, private readonly CodeSequence $sequence, private readonly AuditLogger $audit) {}

    public function createCost(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $reservation = DB::table('booking_reservations')->where('code', $data['reservation'])->whereNull('deleted_at')->first(['id', 'code', 'status']);
            if ($reservation === null || in_array($reservation->status, ['borrador', 'cancelada'], true)) {
                throw ApiException::unprocessable('FIN-BR-23', 'El costo se registra sobre una reserva vigente (no borrador ni cancelada).');
            }

            $provider = $this->activeProvider($data['provider']);
            $code = $this->sequence->next('fin_payables', 'CXP-', 5);
            DB::table('fin_payables')->insert([
                'code' => $code,
                'provider_id' => $provider->id,
                'reservation_id' => $reservation->id,
                'kind' => 'costo_adicional',
                'cost_type' => $data['cost_type'],
                'concept' => $data['concept'],
                'amount' => round((float) $data['amount'], 2),
                'currency' => $data['currency'],
                'fx_rate' => $this->money->fxFor($data['currency'], $data['fx_rate'] ?? null),
                'due_date' => $data['due_date'] ?? $this->money->now()->addDays(15)->toDateString(),
                'status' => 'abierta',
                'supplier_doc_number' => $data['supplier_doc'] ?? null,
                'evidence_note' => $data['evidence'] ?? null,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Costo', $code, 'registrar', null, "{$reservation->code} · {$data['currency']} {$data['amount']} · {$provider->name}");

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        DB::transaction(function () use ($code, $data, $actor): void {
            $payable = $this->open($code);
            $this->ensureActive($payable);
            $values = [
                'concept' => $data['concept'],
                'due_date' => $data['due_date'],
                'supplier_doc_number' => $data['supplier_doc'] ?? null,
                'evidence_note' => $data['evidence'] ?? null,
            ];

            if (isset($data['amount']) && round((float) $data['amount'], 2) !== round((float) $payable->amount, 2)) {
                if ($payable->approved_at !== null || (float) $payable->paid_amount > 0) {
                    throw ApiException::conflict('FIN-BR-19', 'El importe solo se corrige antes de aprobar la obligación.');
                }
                $values['amount'] = round((float) $data['amount'], 2);
            }

            DB::table('fin_payables')->where('id', $payable->id)->update([...$values, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cuenta por pagar', $payable->code, 'editar', $payable->concept, $values['concept']);
        });
    }

    public function approve(string $code, User $actor): array
    {
        return DB::transaction(function () use ($code, $actor): array {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if ($payable->approved_at !== null) {
                throw ApiException::conflict('FIN-BR-19', 'La obligación ya está aprobada.');
            }

            $warnings = [];
            if (DB::table('catalog_providers')->where('id', $payable->provider_id)->value('status') !== 'activo') {
                $warnings[] = 'El proveedor no está activo.';
            }

            DB::table('fin_payables')->where('id', $payable->id)->update(['approved_at' => now(), 'approved_by' => $actor->getKey(), 'status' => 'aprobada', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            FinanceHistory::record('payable', $payable->id, 'aprobada', $warnings ? implode(' ', $warnings) : null, $actor);
            $this->audit->log($payable->kind === 'costo_adicional' ? 'Costo' : 'Cuenta por pagar', $payable->code, 'aprobar', $payable->status, 'aprobada');

            return $warnings;
        });
    }

    public function pay(string $code, array $data, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $actor): string {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if ($payable->approved_at === null) {
                throw ApiException::unprocessable('FIN-BR-19', 'PROC-046: aprueba la obligación antes de pagarla.');
            }

            $balance = round((float) $payable->amount - (float) $payable->paid_amount, 2);
            $amount = round((float) $data['amount'], 2);
            if ($amount - $balance > ReceivableLedger::TOLERANCE) {
                throw ApiException::unprocessable('FIN-BR-22', 'El pago no puede exceder el saldo de la obligación.');
            }

            $payoutCode = $this->sequence->next('fin_payable_payouts', 'PPR-', 4);
            DB::table('fin_payable_payouts')->insert([
                'code' => $payoutCode,
                'payable_id' => $payable->id,
                'paid_on' => $data['paid_on'],
                'amount' => $amount,
                'fx_rate' => $this->money->fxFor($payable->currency, $data['fx_rate'] ?? $payable->fx_rate),
                'method' => $data['method'],
                'operation_ref' => $data['operation_ref'],
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);

            $paid = round((float) $payable->paid_amount + $amount, 2);
            $settled = (float) $payable->amount - $paid <= ReceivableLedger::TOLERANCE;
            DB::table('fin_payables')->where('id', $payable->id)->update([
                'paid_amount' => min($paid, (float) $payable->amount),
                'status' => $settled ? 'pagada' : 'parcial',
                'scheduled_date' => $settled ? null : $payable->scheduled_date,
                'scheduled_bank_account_id' => $settled ? null : $payable->scheduled_bank_account_id,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            FinanceHistory::record('payable', $payable->id, $settled ? 'pagada' : 'parcial', "{$payoutCode} · {$data['operation_ref']}", $actor);
            $this->audit->log('Cuenta por pagar', $payable->code, 'pagar', (string) $balance, (string) round($balance - $amount, 2));

            return $payoutCode;
        });
    }

    public function cancel(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if ((float) $payable->paid_amount > 0) {
                throw ApiException::conflict('FIN-BR-18', 'La obligación ya tiene pagos registrados; no se puede anular.');
            }

            DB::table('fin_payables')->where('id', $payable->id)->update(['status' => 'cancelada', 'observation' => $reason, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            FinanceHistory::record('payable', $payable->id, 'cancelada', $reason, $actor);
            $this->audit->log('Cuenta por pagar', $payable->code, 'cancelar', $payable->status, $reason);
        });
    }

    private function activeProvider(string $ref): object
    {
        $provider = DB::table('catalog_providers')->where('ref', $ref)->whereNull('deleted_at')->first(['id', 'name', 'status']);

        if ($provider === null || $provider->status !== 'activo') {
            throw ApiException::unprocessable('PRD-BR-007', 'Elige un proveedor activo.');
        }

        return $provider;
    }

    private function ensureActive(object $payable): void
    {
        if ($payable->status === 'cancelada' || (float) $payable->amount - (float) $payable->paid_amount <= ReceivableLedger::TOLERANCE) {
            throw ApiException::conflict('FIN-BR-18', $payable->status === 'cancelada' ? 'La obligación está anulada.' : 'La obligación ya está pagada.');
        }
    }

    private function open(string $code): object
    {
        $payable = DB::table('fin_payables')->where('code', $code)->whereNull('deleted_at')->lockForUpdate()->first();

        if ($payable === null) {
            throw ApiException::notFound('La cuenta por pagar no existe.');
        }

        return $payable;
    }

    public static function costTypes(): array
    {
        return array_keys(PayableDirectory::COST_TYPES);
    }
}
