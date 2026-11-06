<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ReconciliationWorkflow
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function confirm(string $code, User $actor): void
    {
        DB::transaction(function () use ($code, $actor): void {
            $line = $this->open($code);
            if ($line->status !== 'sugerido') {
                throw ApiException::conflict('FIN-BR-53', 'Solo se confirman líneas con una coincidencia sugerida.');
            }

            if ($line->matched_payment_id !== null) {
                $payment = DB::table('fin_payments')->where('id', $line->matched_payment_id)->lockForUpdate()->first(['id', 'code', 'status']);
                if ($payment !== null && $payment->status === 'pendiente') {
                    DB::table('fin_payments')->where('id', $payment->id)->update(['status' => 'confirmado', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                    FinanceHistory::record('payment', $payment->id, 'confirmado', "Confirmado en conciliación ({$line->code})", $actor);
                    $this->audit->log('Pago', $payment->code, 'validar', 'pendiente', "confirmado (conciliación {$line->code})");
                }
            }

            $this->settle($line, 'conciliado', 'match', null, $actor);
            $this->audit->log('Conciliación', $line->code, 'confirmar_match', 'sugerido', 'conciliado');
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

    public function resolve(string $code, string $resolution, string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $resolution, $note, $actor): void {
            $line = $this->open($code);
            if ($line->status !== 'excepcion') {
                throw ApiException::conflict('FIN-BR-54', 'Solo se resuelven líneas en excepción.');
            }

            if (($resolution === 'otro_ingreso') !== ((float) $line->amount > 0)) {
                throw ApiException::unprocessable('FIN-BR-54', 'Un abono se resuelve como otro ingreso; un cargo, como gasto o comisión bancaria.');
            }

            $this->settle($line, 'conciliado', $resolution, $note, $actor);
            $this->audit->log('Conciliación', $line->code, 'resolver_excepcion', 'excepcion', "{$resolution} · {$note}");
        });
    }

    private function settle(object $line, string $status, string $resolution, ?string $note, User $actor): void
    {
        DB::table('fin_bank_lines')->where('id', $line->id)->update(['status' => $status, 'resolution' => $resolution, 'resolution_note' => $note, 'resolved_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
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
