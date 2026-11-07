<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Channels\Support\B2bCredit;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\PaymentMethods;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Support\Facades\DB;

final class ReceivableWorkflow
{
    public function __construct(
        private readonly SequenceService $sequences,
        private readonly Consolidation $money,
        private readonly PaymentMethods $methods,
        private readonly ReceivableLedger $ledger,
        private readonly AuditLogger $audit,
        private readonly B2bCredit $credit,
    ) {}

    public function registerPayment(string $code, array $data, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $actor): string {
            $receivable = $this->open($code);
            $balance = ReceivableLedger::balance($receivable);
            $amount = Decimal::money($data['amount']);

            if (in_array($receivable->status, ['pagada', 'cancelada'], true) || ! $balance->isPositive()) {
                throw ApiException::unprocessable('RT-09', 'Regla transversal 9: el pago debe asociarse a una obligación con saldo pendiente.');
            }

            if ($amount->isGreaterThan($balance)) {
                throw ApiException::unprocessable('FIN-BR-07', 'El monto no puede exceder el saldo pendiente de la cuota.');
            }

            $method = $this->methods->find($data['method']);
            if ($method === null) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un medio de pago activo.');
            }

            if ($method->requires_reference && empty($data['reference'])) {
                throw ApiException::unprocessable('FIN-BR-08', 'Indica el número de operación del pago.');
            }

            $paymentCode = $this->sequences->next('payment');
            $now = now();
            $paymentId = (string) DB::table('fin_payments')->insertGetId([
                'code' => $paymentCode,
                'reservation_id' => $receivable->reservation_id,
                'receivable_id' => $receivable->id,
                'kind' => 'cobro',
                'source' => 'backoffice',
                'method' => $method->code,
                'amount' => (string) $amount,
                'currency' => $receivable->currency,
                'fx_rate' => $this->money->fxFor($receivable->currency, $data['fx_rate'] ?? $receivable->fx_rate),
                'paid_on' => $data['paid_on'] ?? $this->money->today(),
                'reference' => $data['reference'] ?? null,
                'note' => $data['note'] ?? null,
                'status' => 'aplicado',
                'registered_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'created_at' => $now,
                'updated_at' => $now,
            ], 'id');

            DB::table('fin_payment_applications')->insert([
                'payment_id' => $paymentId,
                'receivable_id' => $receivable->id,
                'amount' => (string) $amount,
                'applied_at' => $now,
                'applied_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            FinanceHistory::record('payment', $paymentId, 'confirmado', 'Pago registrado y validado', $actor);
            FinanceHistory::record('payment', $paymentId, 'aplicado', "Aplicado a {$receivable->code}", $actor);

            $result = $this->ledger->recalculate($receivable->id, $actor);
            $this->audit->log('Pago', $paymentCode, 'registrar', null, "{$receivable->currency} {$amount} · {$method->label}");
            $this->audit->log('Cuenta por cobrar', $receivable->code, 'aplicar', (string) $result->before, (string) $result->after);

            $method->is_b2b_credit
                ? $this->credit->creditPayment($receivable, $paymentId, $paymentCode, (string) $amount, $actor->getKey())
                : $this->credit->paymentApplied(DB::table('fin_payments')->where('id', $paymentId)->first(), $actor->getKey());

            return $paymentCode;
        });
    }

    public function cancel(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $receivable = $this->open($code);

            if (in_array($receivable->status, ['pagada', 'cancelada'], true)) {
                throw ApiException::conflict('FIN-BR-01', $receivable->status === 'pagada' ? 'Una cuota pagada no se anula; revierte primero sus pagos.' : 'La cuota ya está anulada.');
            }

            DB::table('fin_receivables')->where('id', $receivable->id)->update([
                'status' => 'cancelada',
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Cuenta por cobrar', $receivable->code, 'cancelar', $receivable->status, $reason);
        });
    }

    private function open(string $code): object
    {
        $receivable = DB::table('fin_receivables')->where('code', $code)->whereNull('deleted_at')->lockForUpdate()->first();

        if ($receivable === null) {
            throw ApiException::notFound('La cuota no existe.');
        }

        return $receivable;
    }
}
