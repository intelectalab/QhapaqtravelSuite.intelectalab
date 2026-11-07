<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;

final class B2bCredit
{
    public function __construct(private readonly Consolidation $money, private readonly AuditLogger $audit) {}

    public function chargeReservation(string $agencyId, string $reservationId, string $code, string|float $amount, string|float $sourceAmount, string $sourceCurrency, string|float|null $fx, string $userId): string
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

        if ($outstanding->isLessThanOrEqualTo(self::tolerance())) {
            return;
        }

        $amount = BigDecimal::min($outstanding, $this->toCredit((string) $payment->amount, (string) $payment->currency, $payment->fx_rate, (string) $agency->credit_currency));

        $this->move($agency->id, 'pago_aplicado', $amount->negated(), [
            'reservation_id' => $reservation->id,
            'payment_id' => $payment->id,
            'source_amount' => $payment->amount,
            'source_currency' => $payment->currency,
            'fx_rate' => $payment->currency === $agency->credit_currency ? null : ($payment->fx_rate ?: $this->money->usdRate()),
            'note' => "Pago {$payment->code} · {$reservation->code}",
        ], $userId, 'liberar_credito');
    }

    public function creditPayment(object $receivable, string $paymentId, string $paymentCode, string|float $amount, string $userId): void
    {
        $reservation = $this->reservation($receivable->reservation_id);
        $agency = $reservation !== null
            ? $this->agency($reservation->agency_id)
            : DB::table('channel_b2b_agencies')->where('crm_client_id', $receivable->client_id)->whereNull('deleted_at')->lockForUpdate()->first();

        if ($agency === null || $agency->status !== 'activa') {
            throw ApiException::unprocessable('FIN-BR-10', 'El crédito B2B solo aplica a agencias asociadas y activas.');
        }

        if ($reservation !== null && $this->outstanding($reservation->id)->isGreaterThan(self::tolerance())) {
            return;
        }

        $inCredit = $this->toCredit(self::decimal($amount), (string) $receivable->currency, $receivable->fx_rate, (string) $agency->credit_currency);
        $free = BigDecimal::of((string) $agency->credit_limit)->minus((string) $agency->credit_used);

        if ($inCredit->minus($free)->isGreaterThan(self::tolerance())) {
            throw ApiException::unprocessable('FIN-BR-10', 'El monto supera la línea de crédito disponible de la agencia.');
        }

        $this->move($agency->id, 'cargo_reserva', $inCredit, [
            'reservation_id' => $receivable->reservation_id,
            'payment_id' => $paymentId,
            'source_amount' => (string) self::decimal($amount),
            'source_currency' => $receivable->currency,
            'fx_rate' => $receivable->currency === $agency->credit_currency ? null : ($receivable->fx_rate ?: $this->money->usdRate()),
            'note' => "Pago {$paymentCode} con crédito B2B · {$receivable->code}",
        ], $userId, 'consumo_credito');
    }

    public function paymentReverted(object $payment, string $userId): void
    {
        $moved = DB::table('channel_b2b_credit_movements')->where('payment_id', $payment->id)->get(['agency_id', 'amount', 'currency', 'reservation_id']);
        $net = $moved->reduce(fn (BigDecimal $sum, object $row): BigDecimal => $sum->plus((string) $row->amount), BigDecimal::zero()->toScale(2));

        if ($moved->isEmpty() || $net->abs()->isLessThanOrEqualTo(self::tolerance())) {
            return;
        }

        $first = $moved->first();
        $this->move((string) $first->agency_id, 'reversion_pago', $net->negated(), [
            'reservation_id' => $first->reservation_id,
            'payment_id' => $payment->id,
            'source_amount' => $payment->amount,
            'source_currency' => $payment->currency,
            'note' => $net->isNegative() ? "Reversión del pago {$payment->code}" : "Reversión del pago con crédito {$payment->code}",
        ], $userId, $net->isNegative() ? 'consumo_credito' : 'liberar_credito');
    }

    public function reservationCancelled(string $reservationId, string $code, string $userId): void
    {
        $reservation = $this->reservation($reservationId);

        if ($reservation === null) {
            return;
        }

        $outstanding = $this->outstanding($reservationId);

        if ($outstanding->isLessThanOrEqualTo(self::tolerance())) {
            return;
        }

        $this->move((string) $reservation->agency_id, 'anulacion_reserva', $outstanding->negated(), ['reservation_id' => $reservationId, 'note' => "Anulación de {$code}"], $userId, 'liberar_credito');
    }

    public function outstanding(string $reservationId): BigDecimal
    {
        return Decimal::round2((string) (DB::table('channel_b2b_credit_movements')->where('reservation_id', $reservationId)->sum('amount')));
    }

    private function move(string $agencyId, string $type, BigDecimal|string|float $amount, array $context, string $userId, string $action): string
    {
        $agency = $this->agency($agencyId);
        $before = Decimal::round2((string) $agency->credit_used);
        $balance = BigDecimal::max(BigDecimal::zero(), Decimal::round2($before->plus(self::decimal($amount))))->toScale(2);
        $amount = $balance->minus($before);

        DB::table('channel_b2b_credit_movements')->insert([
            ...$context,
            'agency_id' => $agency->id,
            'movement_type' => $type,
            'amount' => (string) $amount,
            'currency' => $agency->credit_currency,
            'balance_after' => (string) $balance,
            'created_by' => $userId,
        ]);

        $values = ['credit_used' => (string) $balance, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()];
        $unblock = $agency->status === 'bloqueada' && $agency->block_reason === 'credito_excedido' && $balance->isLessThanOrEqualTo((string) $agency->credit_limit);

        if ($unblock) {
            $values = [...$values, 'status' => 'activa', 'block_reason' => null];
        }

        DB::table('channel_b2b_agencies')->where('id', $agency->id)->update($values);
        $this->audit->log('Agencia B2B', (string) $agency->code, $action, (string) $before, (string) $balance.' · '.($context['note'] ?? $type));

        if ($unblock) {
            $this->audit->log('Agencia B2B', (string) $agency->code, 'desbloquear', 'bloqueada', 'activa · crédito utilizado dentro de la línea');
        }

        return (string) $amount;
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

    private function toCredit(BigDecimal|string $amount, string $currency, mixed $fx, string $creditCurrency): BigDecimal
    {
        $rate = is_numeric($fx) && (float) $fx > 0 ? (string) $fx : number_format($this->money->usdRate(), 6, '.', '');

        return Decimal::round2(Decimal::convert($amount, $currency, $creditCurrency, $rate));
    }

    private static function decimal(BigDecimal|string|float $value): BigDecimal
    {
        return $value instanceof BigDecimal ? $value : BigDecimal::of(is_string($value) ? $value : number_format($value, 2, '.', ''));
    }

    private static function tolerance(): BigDecimal
    {
        return BigDecimal::of((string) ReceivableLedger::TOLERANCE);
    }
}
