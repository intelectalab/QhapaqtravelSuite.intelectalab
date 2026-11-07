<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class ExpireAvailabilityHolds extends TenantJob
{
    public const QUEUE = 'critical';

    private const ORDER_REASON = 'Pago no recibido: el pedido web venció sin pago y se liberaron los cupos.';

    protected function run(): string
    {
        $audit = app(AuditLogger::class);
        $holds = $this->expireHolds('catalog_availability_holds', $audit);
        $inventory = $this->expireHolds('booking_inventory_holds', $audit);
        $orders = $this->expireOrders($audit);

        if ($holds + $inventory + $orders === 0) {
            return 'Sin holds ni pedidos vencidos';
        }

        return implode(' · ', array_filter([
            $holds + $inventory > 0 ? self::plural($holds + $inventory, 'hold expirado', 'holds expirados') : null,
            $orders > 0 ? self::plural($orders, 'pedido web vencido', 'pedidos web vencidos') : null,
        ]));
    }

    private function expireHolds(string $table, AuditLogger $audit): int
    {
        $rows = DB::table($table)->where('status', 'hold')->whereNotNull('expires_at')->where('expires_at', '<', now())
            ->orderBy('id')->lockForUpdate()->get(['id', ...($table === 'catalog_availability_holds' ? ['ref'] : [])]);

        if ($rows->isEmpty()) {
            return 0;
        }

        DB::table($table)->whereIn('id', $rows->pluck('id'))->update(['status' => 'expirada', 'updated_at' => now()]);

        foreach ($rows as $row) {
            $audit->log('Disponibilidad', (string) ($row->ref ?? $row->id), 'expirar_hold', 'hold', 'expirada');
        }

        return $rows->count();
    }

    private function expireOrders(AuditLogger $audit): int
    {
        $orders = DB::table('channel_ecom_orders')->whereIn('status', ['pago_pendiente', 'pago_rechazado'])
            ->whereNotNull('hold_expires_at')->where('hold_expires_at', '<', now())
            ->orderBy('id')->lockForUpdate()->get(['id', 'code', 'status']);
        $states = app(ReservationStateMachine::class);

        foreach ($orders as $order) {
            DB::table('catalog_availability_holds')->where('reference_id', $order->id)->where('status', 'hold')
                ->update(['status' => 'expirada', 'updated_at' => now()]);

            foreach (Reservation::query()->where('ecom_order_id', $order->id)->lockForUpdate()->get() as $reservation) {
                if (! $states->can((string) $reservation->status, ReservationStatus::Cancelada->value)) {
                    continue;
                }

                $states->transition($reservation, ReservationStatus::Cancelada);
                $reservation->forceFill(['cancelled_at' => now(), 'cancel_reason' => self::ORDER_REASON])->save();
                DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado', 'completado'])
                    ->update(['status' => 'cancelado', 'updated_at' => now()]);
                DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereIn('status', ['abierta', 'vencida'])
                    ->update(['status' => 'cancelada', 'cancel_reason' => self::ORDER_REASON, 'updated_at' => now()]);
                $audit->log('Reserva', (string) $reservation->code, 'cancelar', 'pendiente_pago', 'cancelada · pedido web vencido');
            }

            DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'expirado', 'updated_at' => now()]);
            $audit->log('Pedido web', (string) $order->code, 'expirar', (string) $order->status, 'expirado');
        }

        return $orders->count();
    }
}
