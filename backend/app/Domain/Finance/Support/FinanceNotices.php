<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Admin\Support\EmailNotifications;
use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Support\Facades\DB;

final class FinanceNotices
{
    public function __construct(private readonly StaffNotices $notices, private readonly EmailNotifications $emails) {}

    public function received(string $paymentId, string $actorId): void
    {
        $payment = $this->payment($paymentId);

        if ($payment === null || $payment->kind !== 'cobro') {
            return;
        }

        $amount = trim($payment->currency).' '.Decimal::round2((string) $payment->amount);
        $this->emails->queue('pago.recibido', (string) $payment->email, ['cliente' => (string) $payment->client, 'reserva' => (string) $payment->reservation, 'monto' => $amount], ['client_id' => $payment->client_id, 'reservation_id' => $payment->reservation_id, 'source_type' => 'fin_payment', 'source_id' => $paymentId]);
        $this->notices->toRoles(['finance'], 'pago.recibido', "{$payment->code} · pago recibido", "{$payment->reservation} · {$payment->client} · {$amount}", 'fin_payment', $paymentId, $payment->reservation_id, [], $actorId);
    }

    public function rejected(string $paymentId, string $reason): void
    {
        $payment = $this->payment($paymentId);

        if ($payment === null) {
            return;
        }

        $agency = $this->notices->agency();
        $amount = trim($payment->currency).' '.Decimal::round2((string) $payment->amount);
        $this->notices->email($payment->email, 'pago.rechazado', "No pudimos validar tu pago · {$agency}", "Hola, {$payment->client}:\n\nNo pudimos validar tu pago de {$amount} para la reserva {$payment->reservation}.\nMotivo: {$reason}\n\nPuedes pagar de nuevo desde tu portal o escribirnos.\n\n{$agency}", 'fin_payment', $paymentId, 'client', ['client_id' => $payment->client_id, 'reservation_id' => $payment->reservation_id]);
        $this->notices->toUser($payment->owner_id, 'pago.rechazado', "{$payment->code} · pago rechazado", "{$payment->reservation} · {$reason}", 'fin_payment', $paymentId, $payment->reservation_id);
    }

    public function reverted(string $paymentId, string $reason): void
    {
        $payment = $this->payment($paymentId);

        if ($payment === null) {
            return;
        }

        $agency = $this->notices->agency();
        $amount = trim($payment->currency).' '.Decimal::round2((string) $payment->amount);
        $this->notices->email($payment->email, 'pago.revertido', "Revertimos un pago de tu reserva · {$agency}", "Hola, {$payment->client}:\n\nRevertimos el pago de {$amount} registrado en la reserva {$payment->reservation}.\nMotivo: {$reason}\n\nTu saldo pendiente se actualizó en el portal.\n\n{$agency}", 'fin_payment', $paymentId, 'client', ['client_id' => $payment->client_id, 'reservation_id' => $payment->reservation_id]);
        $this->notices->toUser($payment->owner_id, 'pago.revertido', "{$payment->code} · pago revertido", "{$payment->reservation} · {$reason}", 'fin_payment', $paymentId, $payment->reservation_id);
    }

    public function supplierPaid(string $payableCode, string $amount): ?string
    {
        $payable = DB::table('fin_payables as p')->join('catalog_providers as v', 'v.id', '=', 'p.provider_id')->leftJoin('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->where('p.code', $payableCode)->first(['p.id', 'p.code', 'p.currency', 'p.reservation_id', 'r.code as reservation', 'v.name', 'v.email']);

        if ($payable === null) {
            return null;
        }

        $agency = $this->notices->agency();

        return $this->notices->email($payable->email, 'pago.proveedor', "Te pagamos {$payable->code} · {$agency}", "Hola, {$payable->name}:\n\nRegistramos el pago de ".trim($payable->currency)." {$amount} por {$payable->code}".($payable->reservation ? " (reserva {$payable->reservation})" : '').".\n\nPuedes ver el detalle en la extranet de proveedores.\n\n{$agency}", 'fin_payable', $payable->id, 'provider', ['reservation_id' => $payable->reservation_id]);
    }

    private function payment(string $id): ?object
    {
        return DB::table('fin_payments as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->where('p.id', $id)->first(['p.id', 'p.code', 'p.kind', 'p.amount', 'p.currency', 'p.reservation_id', 'r.code as reservation', 'r.owner_id', 'r.client_id', 'c.name as client', 'c.email']);
    }
}
