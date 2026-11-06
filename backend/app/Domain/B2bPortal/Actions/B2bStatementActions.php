<?php

declare(strict_types=1);

namespace App\Domain\B2bPortal\Actions;

use App\Domain\B2bPortal\Support\B2bAccount;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\PaymentMethods;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class B2bStatementActions
{
    public function __construct(
        private readonly PaymentMethods $methods,
        private readonly Consolidation $money,
        private readonly CodeSequence $sequence,
        private readonly AuditLogger $audit,
    ) {}

    public function reportPayment(B2bAccount $account, string $receivableCode, array $data): string
    {
        return DB::transaction(function () use ($account, $receivableCode, $data): string {
            $receivable = $account->receivable($receivableCode);
            DB::table('fin_receivables')->where('id', $receivable->id)->lockForUpdate()->first(['id']);
            $reported = (float) DB::table('fin_payments')->where('receivable_id', $receivable->id)->where('status', 'pendiente')->sum('amount');
            $balance = round((float) $receivable->amount - (float) $receivable->paid_amount - $reported, 2);
            $amount = round((float) $data['amount'], 2);

            if ($receivable->status === 'pagada' || $balance <= ReceivableLedger::TOLERANCE) {
                throw ApiException::unprocessable('B2B-BR-14', $reported > 0 ? 'Ya informaste el saldo de esta cuota. Finanzas lo está validando.' : 'Esta cuota ya está pagada.');
            }

            if ($amount - $balance > ReceivableLedger::TOLERANCE) {
                throw ApiException::unprocessable('B2B-BR-14', 'El monto no puede superar el saldo pendiente de la cuota.');
            }

            $method = $this->methods->find($data['method']);
            if ($method === null || $method->is_b2b_credit || $method->code === 'efectivo') {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un medio de pago válido.');
            }

            $code = $this->sequence->next('fin_payments', 'PAG-', 5);
            $user = $account->user;
            $id = (string) DB::table('fin_payments')->insertGetId([
                'code' => $code,
                'reservation_id' => $receivable->reservation_id,
                'receivable_id' => $receivable->id,
                'kind' => 'cobro',
                'source' => 'b2b',
                'method' => $method->code,
                'amount' => $amount,
                'currency' => $receivable->currency,
                'fx_rate' => $this->money->fxFor($receivable->currency, $receivable->fx_rate),
                'paid_on' => $data['paid_on'] ?? $this->money->today(),
                'reference' => $data['reference'],
                'note' => $data['note'] ?? null,
                'status' => 'pendiente',
                'reported_by_agency' => true,
                'registered_by' => $user->getKey(),
                'created_by' => $user->getKey(),
                'updated_by' => $user->getKey(),
            ], 'id');

            FinanceHistory::record('payment', $id, 'pendiente', "Informado por la agencia {$account->agency->code} desde el portal B2B", $user);
            $this->audit->log('Pago', $code, 'informar_b2b', null, "{$receivable->currency} {$amount} · {$method->label} · {$receivable->code}");

            return $code;
        });
    }

    public function requestSettlement(B2bAccount $account): string
    {
        return DB::transaction(function () use ($account): string {
            $commissions = DB::table('fin_commissions')->where('beneficiary_agency_id', $account->agency->id)->whereNull('deleted_at')
                ->whereIn('status', ['calculada', 'aprobada'])->whereNull('settlement_request_id')->lockForUpdate()
                ->get(['id', 'amount', 'currency', 'fx_rate']);

            if ($commissions->isEmpty()) {
                throw ApiException::unprocessable('B2B-BR-15', 'No hay comisiones pendientes de liquidar.');
            }

            $fx = $this->money->usdRate();
            $total = round($commissions->sum(fn (object $row): float => $this->money->pen($row->amount, $row->currency, $row->fx_rate ?? $fx)), 2);
            $code = $this->sequence->next('channel_b2b_settlement_requests', 'LIQ-'.substr($this->money->today(), 0, 4).'-', 5);
            $id = (string) DB::table('channel_b2b_settlement_requests')->insertGetId([
                'code' => $code,
                'agency_id' => $account->agency->id,
                'amount_pen' => $total,
                'fx_rate' => $fx,
                'commission_ids' => '{'.$commissions->pluck('id')->implode(',').'}',
                'status' => 'solicitada',
                'requested_by' => $account->user->getKey(),
                'created_by' => $account->user->getKey(),
                'updated_by' => $account->user->getKey(),
            ], 'id');

            DB::table('fin_commissions')->whereIn('id', $commissions->pluck('id'))->update(['settlement_request_id' => $id, 'updated_at' => now()]);
            $this->audit->log('Agencia B2B', (string) $account->agency->code, 'solicitar_liquidacion', null, "{$code} · PEN {$total} · {$commissions->count()} comisiones");

            return $code;
        });
    }
}
