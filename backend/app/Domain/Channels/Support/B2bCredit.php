<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class B2bCredit
{
    public function __construct(private readonly Consolidation $money, private readonly AuditLogger $audit) {}

    public function chargeReservation(string $agencyId, string $reservationId, string $code, float $amount, float $sourceAmount, string $sourceCurrency, ?float $fx, string $userId): float
    {
        return $this->move($agencyId, 'cargo_reserva', $amount, [
            'reservation_id' => $reservationId,
            'source_amount' => $sourceAmount,
            'source_currency' => $sourceCurrency,
            'fx_rate' => $fx,
            'note' => "Reserva {$code}",
        ], $userId, 'consumo_credito');
    }

    public function paymentApplied(object $payment, string $userId): void
    {
        $reservation = $this->reservation($payment->reservation_id);

        if ($reservation === null || $this->isCreditMethod($payment->method)) {
            return;
        }

        if (DB::table('channel_b2b_credit_movements')->where('payment_id', $payment->id)->where('movement_type', 'pago_aplicado')->exists()) {
            return;
        }

        $agency = $this->agency($reservation->agency_id);
        $outstanding = $this->outstanding($reservation->id);

        if ($outstanding <= ReceivableLedger::TOLERANCE) {
            return;
        }

        $amount = min($outstanding, $this->toCredit((float) $payment->amount, (string) $payment->currency, $payment->fx_rate, (string) $agency->credit_currency));

        $this->move($agency->id, 'pago_aplicado', -$amount, [
            'reservation_id' => $reservation->id,
            'payment_id' => $payment->id,
            'source_amount' => $payment->amount,
            'source_currency' => $payment->currency,
            'fx_rate' => $payment->currency === $agency->credit_currency ? null : ($payment->fx_rate ?: $this->money->usdRate()),
            'note' => "Pago {$payment->code} · {$reservation->code}",
        ], $userId, 'liberar_credito');
    }

    public function creditPayment(object $receivable, string $paymentId, string $paymentCode, float $amount, string $userId): void
    {
        $reservation = $this->reservation($receivable->reservation_id);
        $agency = $reservation !== null
            ? $this->agency($reservation->agency_id)
            : DB::table('channel_b2b_agencies')->where('crm_client_id', $receivable->client_id)->whereNull('deleted_at')->lockForUpdate()->first();

        if ($agency === null || $agency->status !== 'activa') {
            throw ApiException::unprocessable('FIN-BR-10', 'El crédito B2B solo aplica a agencias asociadas y activas.');
        }

        if ($reservation !== null && $this->outstanding($reservation->id) > ReceivableLedger::TOLERANCE) {
            return;
        }

        $inCredit = $this->toCredit($amount, (string) $receivable->currency, $receivable->fx_rate, (string) $agency->credit_currency);

        if ($inCredit - ((float) $agency->credit_limit - (float) $agency->credit_used) > ReceivableLedger::TOLERANCE) {
            throw ApiException::unprocessable('FIN-BR-10', 'El monto supera la línea de crédito disponible de la agencia.');
        }

        $this->move($agency->id, 'cargo_reserva', $inCredit, [
            'reservation_id' => $receivable->reservation_id,
            'payment_id' => $paymentId,
            'source_amount' => $amount,
            'source_currency' => $receivable->currency,
            'fx_rate' => $receivable->currency === $agency->credit_currency ? null : ($receivable->fx_rate ?: $this->money->usdRate()),
            'note' => "Pago {$paymentCode} con crédito B2B · {$receivable->code}",
        ], $userId, 'consumo_credito');
    }

    public function paymentReverted(object $payment, string $userId): void
    {
        $moved = DB::table('channel_b2b_credit_movements')->where('payment_id', $payment->id)->get(['agency_id', 'amount', 'currency', 'reservation_id']);
        $net = round((float) $moved->sum('amount'), 2);

        if ($moved->isEmpty() || abs($net) <= ReceivableLedger::TOLERANCE) {
            return;
        }

        $first = $moved->first();
        $this->move((string) $first->agency_id, 'reversion_pago', -$net, [
            'reservation_id' => $first->reservation_id,
            'payment_id' => $payment->id,
            'source_amount' => $payment->amount,
            'source_currency' => $payment->currency,
            'note' => $net < 0 ? "Reversión del pago {$payment->code}" : "Reversión del pago con crédito {$payment->code}",
        ], $userId, $net < 0 ? 'consumo_credito' : 'liberar_credito');
    }

    public function reservationCancelled(string $reservationId, string $code, string $userId): void
    {
        $reservation = $this->reservation($reservationId);

        if ($reservation === null) {
            return;
        }

        $outstanding = $this->outstanding($reservationId);

        if ($outstanding <= ReceivableLedger::TOLERANCE) {
            return;
        }

        $this->move((string) $reservation->agency_id, 'anulacion_reserva', -$outstanding, ['reservation_id' => $reservationId, 'note' => "Anulación de {$code}"], $userId, 'liberar_credito');
    }

    public function outstanding(string $reservationId): float
    {
        return round((float) DB::table('channel_b2b_credit_movements')->where('reservation_id', $reservationId)->sum('amount'), 2);
    }

    private function move(string $agencyId, string $type, float $amount, array $context, string $userId, string $action): float
    {
        $agency = $this->agency($agencyId);
        $before = round((float) $agency->credit_used, 2);
        $balance = max(0.0, round($before + $amount, 2));
        $amount = round($balance - $before, 2);

        DB::table('channel_b2b_credit_movements')->insert([
            ...$context,
            'agency_id' => $agency->id,
            'movement_type' => $type,
            'amount' => $amount,
            'currency' => $agency->credit_currency,
            'balance_after' => $balance,
            'created_by' => $userId,
        ]);

        $values = ['credit_used' => $balance, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()];
        $unblock = $agency->status === 'bloqueada' && $agency->block_reason === 'credito_excedido' && $balance <= (float) $agency->credit_limit;

        if ($unblock) {
            $values = [...$values, 'status' => 'activa', 'block_reason' => null];
        }

        DB::table('channel_b2b_agencies')->where('id', $agency->id)->update($values);
        $this->audit->log('Agencia B2B', (string) $agency->code, $action, number_format($before, 2, '.', ''), number_format($balance, 2, '.', '').' · '.($context['note'] ?? $type));

        if ($unblock) {
            $this->audit->log('Agencia B2B', (string) $agency->code, 'desbloquear', 'bloqueada', 'activa · crédito utilizado dentro de la línea');
        }

        return $amount;
    }

    private function reservation(?string $reservationId): ?object
    {
        if ($reservationId === null) {
            return null;
        }

        return DB::table('booking_reservations')->where('id', $reservationId)->whereNotNull('agency_id')->first(['id', 'code', 'agency_id']);
    }

    private function agency(string $agencyId): object
    {
        return DB::table('channel_b2b_agencies')->where('id', $agencyId)->lockForUpdate()->first(['id', 'code', 'status', 'block_reason', 'credit_currency', 'credit_limit', 'credit_used'])
            ?? throw ApiException::notFound('La agencia B2B no existe.');
    }

    private function isCreditMethod(?string $method): bool
    {
        return (bool) DB::table('fin_payment_methods')->where('code', $method)->value('is_b2b_credit');
    }

    private function toCredit(float $amount, string $currency, mixed $fx, string $creditCurrency): float
    {
        if ($currency === $creditCurrency) {
            return round($amount, 2);
        }

        $rate = (float) $fx ?: $this->money->usdRate();

        return round($currency === 'USD' ? $amount * $rate : $amount / $rate, 2);
    }
}
