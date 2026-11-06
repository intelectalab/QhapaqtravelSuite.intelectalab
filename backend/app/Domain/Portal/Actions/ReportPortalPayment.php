<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\PaymentMethods;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ReportPortalPayment
{
    public function __construct(
        private readonly PaymentMethods $methods,
        private readonly Consolidation $money,
        private readonly CodeSequence $sequence,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(PortalAccount $account, string $receivableCode, array $data): string
    {
        return DB::transaction(function () use ($account, $receivableCode, $data): string {
            $receivable = $account->receivable($receivableCode);
            DB::table('fin_receivables')->where('id', $receivable->id)->lockForUpdate()->first(['id']);
            $reported = (float) DB::table('fin_payments')->where('receivable_id', $receivable->id)->where('status', 'pendiente')->sum('amount');
            $balance = round((float) $receivable->amount - (float) $receivable->paid_amount - $reported, 2);
            $amount = round((float) $data['amount'], 2);

            if ($receivable->status === 'pagada' || $balance <= ReceivableLedger::TOLERANCE) {
                throw ApiException::unprocessable('RT-09', $reported > 0 ? 'Ya reportaste el saldo de esta cuota. La agencia lo está validando.' : 'Esta cuota ya está pagada.');
            }

            if ($amount - $balance > ReceivableLedger::TOLERANCE) {
                throw ApiException::unprocessable('FIN-BR-07', 'El monto no puede superar el saldo pendiente de la cuota.');
            }

            $method = $this->methods->find($data['method']);
            if ($method === null || $method->is_b2b_credit || $method->code === 'efectivo') {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un medio de pago válido.');
            }

            if ($method->requires_reference && empty($data['reference'])) {
                throw ApiException::unprocessable('FIN-BR-08', 'Indica el número de operación del pago.');
            }

            $code = $this->sequence->next('fin_payments', 'PAG-', 5);
            $user = $account->user;
            $id = (string) DB::table('fin_payments')->insertGetId([
                'code' => $code,
                'reservation_id' => $receivable->reservation_id,
                'receivable_id' => $receivable->id,
                'kind' => 'cobro',
                'source' => 'portal_cliente',
                'method' => $method->code,
                'amount' => $amount,
                'currency' => $receivable->currency,
                'fx_rate' => $this->money->fxFor($receivable->currency, $receivable->fx_rate),
                'paid_on' => $data['paid_on'] ?? $this->money->today(),
                'reference' => $data['reference'] ?? null,
                'note' => $data['note'] ?? null,
                'status' => 'pendiente',
                'registered_by' => $user->getKey(),
                'created_by' => $user->getKey(),
                'updated_by' => $user->getKey(),
                'created_at' => now(),
                'updated_at' => now(),
            ], 'id');

            FinanceHistory::record('payment', $id, 'pendiente', 'Reportado por el cliente desde el portal', $user);
            $this->audit->log('Pago', $code, 'reportar_portal', null, "{$receivable->currency} {$amount} · {$method->label} · {$receivable->code}");

            return $code;
        });
    }
}
