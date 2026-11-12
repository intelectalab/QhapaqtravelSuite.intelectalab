<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Facades\DB;

final class ReservationNotices
{
    public function __construct(private readonly StaffNotices $notices) {}

    public function cancelRequested(string $reservationId, string $reason, string $actorId): void
    {
        $row = $this->row($reservationId);
        $this->notices->toManagers('reserva.anulacion_solicitada', "{$row->code} · anulación solicitada", "{$row->client}: {$reason}", 'booking_reservation', $reservationId, $reservationId, $actorId);
    }

    public function cancelDecided(string $reservationId, ?string $requesterId, bool $approved, ?string $note, string $actorId): void
    {
        $row = $this->row($reservationId);
        $verb = $approved ? 'aprobada' : 'rechazada';
        $this->notices->toUser($requesterId, "reserva.anulacion_{$verb}", "{$row->code} · anulación {$verb}", trim($row->client.($note ? " · {$note}" : '')), 'booking_reservation', $reservationId, $reservationId, $actorId);
    }

    public function changeRequested(string $reservationId, string $description, string $actorId): void
    {
        $row = $this->row($reservationId);
        $this->notices->toManagers('reserva.modificacion_pendiente', "{$row->code} · modificación por aprobar", "{$row->client}: {$description}", 'booking_reservation', $reservationId, $reservationId, $actorId);
    }

    public function changeDecided(string $reservationId, ?string $requesterId, bool $approved, ?string $note, string $actorId): void
    {
        $row = $this->row($reservationId);
        $verb = $approved ? 'aprobada' : 'rechazada';
        $this->notices->toUser($requesterId, "reserva.modificacion_{$verb}", "{$row->code} · modificación {$verb}", trim($row->client.($note ? " · {$note}" : '')), 'booking_reservation', $reservationId, $reservationId, $actorId);
    }

    public function providerRejected(string $reservationId, string $service, string $reason, ?string $actorId = null): void
    {
        $row = $this->row($reservationId);
        $this->notices->toUser($row->owner_id, 'reserva.rechazo_proveedor', "{$row->code} · el proveedor rechazó un servicio", "{$service}: {$reason}", 'booking_reservation', $reservationId, $reservationId, $actorId);
    }

    public function reassigned(string $reservationId, string $ownerId, string $actorId): void
    {
        $row = $this->row($reservationId);
        $this->notices->toUser($ownerId, 'reserva.reasignada', "{$row->code} · ahora está a tu cargo", $row->client, 'booking_reservation', $reservationId, $reservationId, $actorId);
    }

    public function cancelled(string $reservationId, string $actorId): void
    {
        $row = $this->row($reservationId);
        $coordinators = DB::table('ops_orders')->where('reservation_id', $reservationId)->whereNotNull('coordinator_id')->pluck('coordinator_id');
        $this->notices->toRoles(['finance'], 'reserva.cancelada', "{$row->code} · reserva cancelada", "{$row->client}: revisa reembolsos, penalidades y la operación.", 'booking_reservation', $reservationId, $reservationId, $coordinators, $actorId);
    }

    public function orderCreated(string $orderId, string $orderCode, ?string $coordinatorId, ?string $actorId): void
    {
        $order = DB::table('ops_orders as o')->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')->where('o.id', $orderId)->first(['r.id', 'r.code', 'r.title']);
        $this->notices->toUser($coordinatorId, 'orden.creada', "{$orderCode} · nueva orden operativa a tu cargo", $order ? "{$order->code} · {$order->title}" : null, 'ops_order', $orderId, $order?->id, $actorId);
    }

    public function orderReassigned(string $orderId, string $orderCode, string $coordinatorId, string $actorId): void
    {
        $this->notices->toUser($coordinatorId, 'orden.responsable', "{$orderCode} · ahora coordinas esta orden", null, 'ops_order', $orderId, DB::table('ops_orders')->where('id', $orderId)->value('reservation_id'), $actorId);
    }

    private function row(string $reservationId): object
    {
        $row = DB::table('booking_reservations as r')->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')->where('r.id', $reservationId)->first(['r.code', 'r.owner_id', 'c.name as client']);

        return (object) ['code' => (string) ($row->code ?? ''), 'owner_id' => $row?->owner_id, 'client' => (string) ($row->client ?? '')];
    }
}
