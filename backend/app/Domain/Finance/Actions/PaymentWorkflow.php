<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Channels\Support\B2bCredit;
use App\Domain\Finance\Events\PaymentApplied;
use App\Domain\Finance\Events\PaymentConfirmed;
use App\Domain\Finance\Events\PaymentReverted;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Site\Support\WebOrderSettlement;
use Illuminate\Support\Facades\DB;

final class PaymentWorkflow
{
    public function __construct(private readonly ReceivableLedger $ledger, private readonly B2bCredit $credit, private readonly AuditLogger $audit, private readonly WebOrderSettlement $web) {}

    public function confirm(string $code, ?string $receivableCode, User $actor): void
    {
        DB::transaction(function () use ($code, $receivableCode, $actor): void {
            $payment = $this->open($code);

            if (! in_array($payment->status, ['pendiente', 'confirmado'], true)) {
                throw ApiException::conflict('FIN-BR-12', 'Solo se validan pagos pendientes o confirmados por aplicar.');
            }

            if ($payment->status === 'pendiente') {
                $this->transition($payment, 'confirmado', 'Pago validado', $actor);
                $this->audit->log('Pago', $payment->code, 'validar', 'pendiente', 'confirmado');
                PaymentConfirmed::dispatch((string) $payment->id, (string) $actor->getKey());
            }

            $receivableCode ??= $payment->receivable_id ? DB::table('fin_receivables')->where('id', $payment->receivable_id)->value('code') : null;

            if ($receivableCode !== null) {
                $this->apply($payment, (string) $receivableCode, $actor);
            }
        });
    }

    public function reject(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $payment = $this->open($code);

            if ($payment->status !== 'pendiente') {
                throw ApiException::conflict('FIN-BR-13', 'Solo se rechazan pagos pendientes de validar.');
            }

            $this->transition($payment, 'rechazado', $reason, $actor, ['reject_reason' => $reason]);
            $this->audit->log('Pago', $payment->code, 'rechazar', 'pendiente', $reason);
            $this->web->rejected($payment, $reason);
        });
    }

    public function retry(string $code, ?int $lockVersion, ?string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $lockVersion, $note, $actor): void {
            $payment = $this->open($code);

            if ($lockVersion !== null) {
                IfMatch::assertMatches($lockVersion, (int) $payment->lock_version, 'El pago');
            }

            if ($payment->status !== 'rechazado') {
                throw ApiException::conflict('FIN-BR-13', 'Solo se reintenta la validación de un pago rechazado.');
            }

            $attempt = (int) $payment->retries + 1;
            $this->transition($payment, 'pendiente', $note ?: "Reintento de validación {$attempt}", $actor, ['retries' => $attempt, 'reject_reason' => null]);
            $this->audit->log('Pago', $payment->code, 'reintentar', 'rechazado', "pendiente · intento {$attempt}".($note ? " · {$note}" : ''));
        });
    }

    public function revert(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $payment = $this->open($code);

            if (! in_array($payment->status, ['confirmado', 'aplicado'], true)) {
                throw ApiException::conflict('FIN-BR-16', 'Solo se revierten pagos confirmados o aplicados.');
            }

            $this->transition($payment, 'revertido', $reason, $actor, ['reverted_at' => now(), 'reverted_by' => $actor->getKey(), 'revert_reason' => $reason]);
            $application = DB::table('fin_payment_applications')->where('payment_id', $payment->id)->whereNull('reversed_at')->first(['id', 'receivable_id']);
            $detail = $reason;

            if ($application !== null) {
                DB::table('fin_payment_applications')->where('id', $application->id)->update(['reversed_at' => now(), 'reversed_by' => $actor->getKey(), 'updated_at' => now()]);
                $result = $this->ledger->recalculate($application->receivable_id, $actor);
                $detail = "{$reason} · saldo {$result->code}: {$result->before} → {$result->after}";
            }

            $this->credit->paymentReverted($payment, $actor->getKey());
            PaymentReverted::dispatch((string) $payment->id, (string) $actor->getKey());
            $this->audit->log('Pago', $payment->code, 'revertir', $payment->status, $detail);
        });
    }

    private function apply(object $payment, string $receivableCode, User $actor): void
    {
        $receivable = DB::table('fin_receivables')->where('code', $receivableCode)->whereNull('deleted_at')->lockForUpdate()->first();

        if ($receivable === null || $receivable->reservation_id !== $payment->reservation_id || $receivable->currency !== $payment->currency) {
            throw ApiException::unprocessable('RT-09', 'Regla transversal 9: aplica el pago a una cuota de la misma reserva y moneda.');
        }

        if (in_array($receivable->status, ['pagada', 'cancelada'], true) || Decimal::of($payment->amount)->isGreaterThan(ReceivableLedger::balance($receivable))) {
            throw ApiException::unprocessable('FIN-BR-14', 'El monto del pago supera el saldo de la cuota elegida.');
        }

        DB::table('fin_payment_applications')->insert([
            'payment_id' => $payment->id,
            'receivable_id' => $receivable->id,
            'amount' => $payment->amount,
            'applied_at' => now(),
            'applied_by' => $actor->getKey(),
            'created_by' => $actor->getKey(),
        ]);
        DB::table('fin_payments')->where('id', $payment->id)->update(['receivable_id' => $receivable->id, 'status' => 'aplicado', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        FinanceHistory::record('payment', $payment->id, 'aplicado', "Aplicado a {$receivable->code}", $actor);
        $result = $this->ledger->recalculate($receivable->id, $actor);
        $this->audit->log('Cuenta por cobrar', $receivable->code, 'aplicar', (string) $result->before, (string) $result->after);
        $this->credit->paymentApplied($payment, $actor->getKey());
        PaymentApplied::dispatch((string) $payment->id, (string) $actor->getKey());
    }

    private function transition(object $payment, string $status, ?string $note, User $actor, array $extra = []): void
    {
        DB::table('fin_payments')->where('id', $payment->id)->update([...$extra, 'status' => $status, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        FinanceHistory::record('payment', $payment->id, $status, $note, $actor);
    }

    private function open(string $code): object
    {
        $payment = DB::table('fin_payments')->where('code', $code)->lockForUpdate()->first();

        if ($payment === null) {
            throw ApiException::notFound('El pago no existe.');
        }

        return $payment;
    }
}
