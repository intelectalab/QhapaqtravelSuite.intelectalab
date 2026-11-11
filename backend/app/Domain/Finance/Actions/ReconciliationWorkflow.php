<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Finance\Support\ReconciliationCandidates;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class ReconciliationWorkflow
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly ReconciliationCandidates $candidates,
        private readonly SequenceService $sequences,
        private readonly Consolidation $money,
    ) {}

    public function confirm(string $code, User $actor): void
    {
        DB::transaction(function () use ($code, $actor): void {
            $line = $this->open($code);
            if ($line->status !== 'sugerido') {
                throw ApiException::conflict('FIN-BR-53', 'Solo se confirman líneas con una coincidencia sugerida.');
            }

            $target = $this->apply($line, $actor);
            $this->settle($line, 'match', null, $actor);
            $this->audit->log('Conciliación', $line->code, 'confirmar_match', 'sugerido', 'conciliado'.($target ? " → {$target}" : ''));
        });
    }

    public function reject(string $code, User $actor): void
    {
        DB::transaction(function () use ($code, $actor): void {
            $line = $this->open($code);
            if ($line->status !== 'sugerido') {
                throw ApiException::conflict('FIN-BR-53', 'Solo se rechazan coincidencias sugeridas.');
            }

            DB::table('fin_bank_lines')->where('id', $line->id)->update(['status' => 'excepcion', 'matched_payment_id' => null, 'matched_payable_id' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Conciliación', $line->code, 'rechazar_match', 'sugerido', 'excepcion');
        });
    }

    public function candidates(string $code): array
    {
        $line = DB::table('fin_bank_lines')->where('code', $code)->first();

        if ($line === null) {
            throw ApiException::notFound('La línea del extracto no existe.');
        }

        return $this->candidates->for($line)->take(30)->map(fn (array $row): array => array_diff_key($row, ['id' => true]))->all();
    }

    public function resolve(string $code, string $resolution, ?string $target, string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $resolution, $target, $note, $actor): void {
            $line = $this->open($code);
            if ($line->status !== 'excepcion') {
                throw ApiException::conflict('FIN-BR-54', 'Solo se resuelven líneas en excepción.');
            }

            if ($resolution === 'asignado') {
                $candidate = $this->candidates->for($line)->firstWhere('code', $target);
                if ($candidate === null) {
                    throw ApiException::unprocessable('FIN-BR-54', 'Elige un '.((float) $line->amount > 0 ? 'pago' : 'obligación').' disponible para asignar.');
                }

                DB::table('fin_bank_lines')->where('id', $line->id)->update([
                    'matched_payment_id' => $candidate['kind'] === 'payment' ? $candidate['id'] : null,
                    'matched_payable_id' => $candidate['kind'] === 'payable' ? $candidate['id'] : null,
                ]);
                $line->matched_payment_id = $candidate['kind'] === 'payment' ? $candidate['id'] : null;
                $line->matched_payable_id = $candidate['kind'] === 'payable' ? $candidate['id'] : null;
                $this->apply($line, $actor);
            } elseif (($resolution === 'otro_ingreso') !== ((float) $line->amount > 0)) {
                throw ApiException::unprocessable('FIN-BR-54', 'Un abono se resuelve como otro ingreso; un cargo, como gasto o comisión bancaria.');
            }

            $this->settle($line, $resolution, $note, $actor);
            $this->audit->log('Conciliación', $line->code, 'resolver_excepcion', 'excepcion', ($resolution === 'asignado' ? "asignado → {$target}" : $resolution)." · {$note}");
        });
    }

    private function apply(object $line, User $actor): ?string
    {
        if ($line->matched_payment_id !== null) {
            $payment = DB::table('fin_payments')->where('id', $line->matched_payment_id)->lockForUpdate()->first(['id', 'code', 'status']);
            if ($payment !== null && $payment->status === 'pendiente') {
                DB::table('fin_payments')->where('id', $payment->id)->update(['status' => 'confirmado', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                FinanceHistory::record('payment', $payment->id, 'confirmado', "Confirmado en conciliación ({$line->code})", $actor);
                $this->audit->log('Pago', $payment->code, 'validar', 'pendiente', "confirmado (conciliación {$line->code})");
            }

            return $payment->code ?? null;
        }

        if ($line->matched_payable_id !== null) {
            $payable = DB::table('fin_payables')->where('id', $line->matched_payable_id)->lockForUpdate()->first();
            if ($payable !== null && $payable->status !== 'cancelada' && ReceivableLedger::balance($payable)->isPositive()) {
                $this->payout($line, $payable, $actor);
            }

            return $payable->code ?? null;
        }

        return null;
    }

    private function payout(object $line, object $payable, User $actor): void
    {
        $fx = $payable->currency === 'PEN' ? null : (string) ($payable->fx_rate ?: $this->money->usdRate());
        $charged = Decimal::of(ltrim((string) $line->amount, '-'));
        $inCurrency = $fx === null ? $charged : $charged->dividedBy($fx, 2, RoundingMode::HALF_UP);
        $balance = ReceivableLedger::balance($payable);
        $amount = Decimal::round2(BigDecimal::min($inCurrency, $balance));
        $code = $this->sequences->next('payout');

        DB::table('fin_payable_payouts')->insert([
            'code' => $code,
            'payable_id' => $payable->id,
            'paid_on' => $line->value_date,
            'amount' => (string) $amount,
            'fx_rate' => $fx,
            'method' => 'cargo_bancario',
            'operation_ref' => mb_substr((string) $line->description, 0, 80),
            'bank_line_id' => $line->id,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        $paid = Decimal::of($payable->paid_amount)->plus($amount);
        $settled = $paid->isGreaterThanOrEqualTo(Decimal::of($payable->amount));
        DB::table('fin_payables')->where('id', $payable->id)->update([
            'paid_amount' => (string) Decimal::round2($settled ? Decimal::of($payable->amount) : $paid),
            'status' => $settled ? 'pagada' : 'parcial',
            'approved_at' => $payable->approved_at ?? now(),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        FinanceHistory::record('payable', $payable->id, $settled ? 'pagada' : 'parcial', "{$code} · cargo bancario ({$line->code})", $actor);
        $this->audit->log('Cuenta por pagar', $payable->code, 'pagar', (string) Decimal::round2($balance), (string) Decimal::round2($balance->minus($amount))." (conciliación {$line->code})");
    }

    private function settle(object $line, string $resolution, ?string $note, User $actor): void
    {
        DB::table('fin_bank_lines')->where('id', $line->id)->update(['status' => 'conciliado', 'resolution' => $resolution, 'resolution_note' => $note, 'resolved_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
    }

    private function open(string $code): object
    {
        $line = DB::table('fin_bank_lines')->where('code', $code)->lockForUpdate()->first();

        if ($line === null) {
            throw ApiException::notFound('La línea del extracto no existe.');
        }

        if ($line->closure_id !== null) {
            throw ApiException::conflict('FIN-BR-55', 'La línea pertenece a una conciliación cerrada.');
        }

        return $line;
    }
}
