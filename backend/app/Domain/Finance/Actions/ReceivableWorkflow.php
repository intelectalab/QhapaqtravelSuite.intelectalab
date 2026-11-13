<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Admin\Support\EmailNotifications;
use App\Domain\Channels\Support\B2bCredit;
use App\Domain\Finance\Events\PaymentApplied;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\PaymentMethods;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReceivableWorkflow
{
    public function __construct(
        private readonly SequenceService $sequences,
        private readonly Consolidation $money,
        private readonly PaymentMethods $methods,
        private readonly ReceivableLedger $ledger,
        private readonly AuditLogger $audit,
        private readonly B2bCredit $credit,
        private readonly EmailNotifications $notifications,
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
            PaymentApplied::dispatch($paymentId, (string) $actor->getKey());

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

    public function requestAdvance(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $reservation = DB::table('booking_reservations as b')->join('crm_clients as c', 'c.id', '=', 'b.client_id')->where('b.code', $data['reservation'])->whereNull('b.deleted_at')
                ->lock('for no key update of b')->first(['b.id', 'b.code', 'b.status', 'b.client_id', 'b.currency', 'b.fx_rate', 'b.total_amount', 'b.travel_from', 'c.name as client_name', 'c.email as client_email']);

            if ($reservation === null) {
                throw ApiException::notFound('La reserva no existe.');
            }

            if (in_array($reservation->status, ['borrador', 'cancelada'], true)) {
                throw ApiException::unprocessable('FIN-BR-02', 'Solo se piden anticipos de reservas vigentes (no borrador ni cancelada).');
            }

            $available = ReceivableLedger::available($reservation);
            $amount = Decimal::money($data['amount']);

            if ($amount->isGreaterThan($available)) {
                throw ApiException::unprocessable('PROC-041', 'El anticipo supera lo que falta comprometer de la reserva ('.Decimal::display($available, (string) $reservation->currency).').', ['available' => (string) $available]);
            }

            $code = $this->sequences->next('receivable');
            DB::table('fin_receivables')->insert([
                'code' => $code,
                'reservation_id' => $reservation->id,
                'client_id' => $reservation->client_id,
                'kind' => 'anticipo',
                'concept' => $data['concept'],
                'amount' => (string) $amount,
                'currency' => $reservation->currency,
                'fx_rate' => $this->money->fxFor((string) $reservation->currency, $reservation->fx_rate),
                'paid_amount' => '0',
                'due_date' => $data['due_date'],
                'status' => 'abierta',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Cuenta por cobrar', $code, 'solicitar_anticipo', null, "{$reservation->code} · {$reservation->currency} {$amount} · vence {$data['due_date']}");

            if ($data['notify'] ?? false) {
                $this->notifyClient(DB::table('fin_receivables')->where('code', $code)->first(), $reservation, $amount, $actor);
            }

            return $code;
        });
    }

    public function remind(string $code, User $actor): array
    {
        $result = [];
        DB::transaction(function () use ($code, $actor, &$result): void {
            $receivable = $this->open($code);
            $balance = ReceivableLedger::balance($receivable);

            if (in_array($receivable->status, ['pagada', 'cancelada'], true) || ! $balance->isPositive()) {
                throw ApiException::conflict('FIN-BR-05', $receivable->status === 'cancelada' ? 'La cuota está anulada: no se recuerda.' : 'La cuota ya está pagada: no hay nada que recordar.');
            }

            $reservation = DB::table('booking_reservations as b')->join('crm_clients as c', 'c.id', '=', 'b.client_id')->where('b.id', $receivable->reservation_id)
                ->first(['b.id', 'b.code', 'b.client_id', 'b.travel_from', 'c.name as client_name', 'c.email as client_email']);

            if ($reservation === null || ! str_contains((string) $reservation->client_email, '@')) {
                throw ApiException::unprocessable('FIN-BR-05', 'El cliente no tiene un correo registrado. Agrégalo en su ficha para enviarle el recordatorio.');
            }

            $message = $this->notifyClient($receivable, $reservation, $balance, $actor);
            $sentAt = now();
            DB::table('fin_receivable_reminders')->insert([
                'id' => (string) Str::uuid7(), 'tenant_id' => $receivable->tenant_id, 'receivable_id' => $receivable->id, 'channels' => 'email',
                'sent_by' => $actor->getKey(), 'sent_at' => $sentAt, 'balance_at_send' => (string) $balance->toScale(2), 'created_by' => $actor->getKey(), 'created_at' => $sentAt,
            ]);
            DB::table('fin_receivables')->where('id', $receivable->id)->update(['last_reminder_at' => $sentAt, 'updated_by' => $actor->getKey(), 'updated_at' => $sentAt]);
            $this->audit->log('Cuenta por cobrar', $receivable->code, 'recordar', null, "{$reservation->client_email} · saldo {$receivable->currency} {$balance->toScale(2)}");

            $result = ['code' => (string) $receivable->code, 'sent_to' => (string) $reservation->client_email, 'message' => $message];
        });

        return $result;
    }

    public function sendStatement(string $reservationCode, ?string $email, User $actor): array
    {
        return DB::transaction(function () use ($reservationCode, $email, $actor): array {
            $reservation = DB::table('booking_reservations as b')->join('crm_clients as c', 'c.id', '=', 'b.client_id')->where('b.code', $reservationCode)->whereNull('b.deleted_at')
                ->first(['b.id', 'b.code', 'b.status', 'b.client_id', 'b.currency', 'b.travel_from', 'c.name as client_name', 'c.email as client_email'])
                ?? throw ApiException::notFound('La reserva no existe.');
            $address = $email ?? (string) $reservation->client_email;

            if (! str_contains($address, '@')) {
                throw ApiException::unprocessable('FIN-BR-38', 'El cliente no tiene un correo registrado. Agrégalo en su ficha o indica a qué correo enviar el estado de cuenta.');
            }

            $open = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->whereNotIn('status', ['cancelada'])->get(['amount', 'paid_amount']);

            if ($open->isEmpty()) {
                throw ApiException::conflict('FIN-BR-38', 'La reserva aún no tiene cuotas: no hay estado de cuenta que enviar.');
            }

            $balance = Decimal::round2($open->reduce(fn (BigDecimal $sum, object $row): BigDecimal => $sum->plus((string) $row->amount)->minus((string) $row->paid_amount), BigDecimal::zero()));
            $message = $this->notifications->queue('estado_cuenta.enviado', $address, [
                'cliente' => (string) $reservation->client_name,
                'reserva' => (string) $reservation->code,
                'monto' => Decimal::display($balance, (string) $reservation->currency),
                'fecha_viaje' => $reservation->travel_from ? CarbonImmutable::parse((string) $reservation->travel_from)->format('d/m/Y') : '',
                'vendedor' => (string) $actor->name,
            ], ['source_type' => 'booking_reservation', 'source_id' => $reservation->id, 'client_id' => $reservation->client_id, 'reservation_id' => $reservation->id]);
            $this->audit->log('Reserva', (string) $reservation->code, 'enviar_estado_cuenta', null, "{$address} · saldo {$reservation->currency} {$balance}");

            return ['code' => (string) $reservation->code, 'sent_to' => $address, 'balance' => (string) $balance, 'currency' => (string) $reservation->currency, 'message' => $message];
        });
    }

    private function notifyClient(object $receivable, object $reservation, BigDecimal $amount, User $actor): ?string
    {
        return $this->notifications->queue('pago.recordatorio', (string) $reservation->client_email, [
            'cliente' => (string) $reservation->client_name,
            'reserva' => (string) $reservation->code,
            'monto' => Decimal::display($amount, (string) $receivable->currency),
            'fecha_viaje' => $reservation->travel_from ? CarbonImmutable::parse((string) $reservation->travel_from)->format('d/m/Y') : '',
            'vendedor' => (string) $actor->name,
        ], ['source_type' => 'fin_receivable', 'source_id' => $receivable->id, 'client_id' => $reservation->client_id, 'reservation_id' => $reservation->id]);
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
