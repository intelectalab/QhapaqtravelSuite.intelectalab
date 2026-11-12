<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Channels\Support\EcommerceOrderRelease;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class WebOrderSettlement
{
    private const OPEN_ORDER = ['pago_pendiente', 'pago_por_validar', 'pago_rechazado'];

    public function __construct(private readonly AuditLogger $audit, private readonly SyncServicePayables $payables, private readonly EcommerceOrderRelease $release) {}

    public static function ready(string $reservationId): bool
    {
        $due = DB::table('fin_receivables')->where('reservation_id', $reservationId)->whereNull('deleted_at')->where('status', '<>', 'cancelada');

        return (clone $due)->exists() && ! (clone $due)->where('kind', '<>', 'saldo')->where('status', '<>', 'pagada')->exists();
    }

    public function confirm(string $reservationId, ?User $actor = null): bool
    {
        $reservation = DB::table('booking_reservations')->where('id', $reservationId)->first(['id', 'code', 'status', 'ecom_order_id']);

        if ($reservation === null || $reservation->status !== 'pendiente_pago' || ! self::ready($reservationId)) {
            return false;
        }

        $pending = false;

        foreach (DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->get(['id', 'departure_id', 'status']) as $service) {
            $ref = $service->departure_id ? DB::table('catalog_product_departures')->where('id', $service->departure_id)->value('ref') : null;

            if ($ref) {
                DB::table('booking_reservation_services')->where('id', $service->id)->update(['status' => 'confirmado', 'confirmation_code' => $ref, 'confirmed_by_name' => 'Cupo propio (salida programada)', 'confirmed_at' => now(), 'updated_at' => now()]);
            } elseif ($service->status !== 'confirmado') {
                $pending = true;
            }
        }

        $status = $pending ? 'pendiente_proveedor' : 'confirmada';
        DB::table('booking_reservations')->where('id', $reservationId)->update(['status' => $status, 'updated_at' => now()]);
        $this->audit->log('Reserva', $reservation->code, 'confirmar', 'pendiente_pago', "{$status} (pago web aplicado)");
        $this->payables->handle($reservationId, $actor);

        if ($reservation->ecom_order_id) {
            $this->closeOrder((string) $reservation->ecom_order_id);
        }

        return true;
    }

    public function rejected(object $payment, string $reason): void
    {
        $orderId = $payment->source === 'ecommerce' && $payment->reservation_id ? DB::table('booking_reservations')->where('id', $payment->reservation_id)->value('ecom_order_id') : null;
        $order = $orderId ? DB::table('channel_ecom_orders')->where('id', $orderId)->first(['id', 'code', 'status']) : null;

        if ($order === null || $order->status !== 'pago_por_validar') {
            return;
        }

        $note = "Abono no validado por Finanzas: {$reason}";
        $this->release->releaseConsumed((string) $order->id, $note);
        $this->release->release((string) $order->id, 'liberada', $note, 'abono no validado');
        DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'cancelado', 'cancel_reason' => mb_substr($note, 0, 300), 'updated_at' => now()]);
        DB::table('channel_ecom_payment_attempts')->where('payment_id', $payment->id)->update(['result' => 'rechazado', 'message' => "Pago no validado: {$reason}"]);
        $this->audit->log('Pedido web', $order->code, 'cancelar', 'pago_por_validar', "cancelado · {$note}");
    }

    private function closeOrder(string $orderId): void
    {
        $order = DB::table('channel_ecom_orders')->where('id', $orderId)->first(['code', 'status']);

        if ($order === null || ! in_array($order->status, self::OPEN_ORDER, true) || DB::table('booking_reservations')->where('ecom_order_id', $orderId)->where('status', 'pendiente_pago')->exists()) {
            return;
        }

        DB::table('channel_ecom_orders')->where('id', $orderId)->update(['status' => 'confirmado', 'updated_at' => now()]);
        $this->audit->log('Pedido web', $order->code, 'confirmar', $order->status, 'confirmado');
    }
}
