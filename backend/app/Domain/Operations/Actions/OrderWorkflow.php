<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Booking\Actions\ReservationLifecycle;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Operations\Support\OrderDirectory;
use App\Domain\Operations\Support\OrderFlow;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OrderWorkflow
{
    public const DEFAULT_TASKS = [
        'Enviar solicitudes a proveedores',
        'Asignar guías, conductores y vehículos',
        'Emitir vouchers de servicios confirmados',
        'Llamada de bienvenida al cliente',
        'Encuesta de cierre',
    ];

    public function __construct(
        private readonly SequenceService $sequences,
        private readonly OpsCommon $common,
        private readonly AuditLogger $audit,
        private readonly OrderDirectory $directory,
    ) {}

    public function create(string $reservationCode, string $coordinatorId, User $actor): string
    {
        $this->common->ensureCoordinator($coordinatorId);

        return DB::transaction(function () use ($reservationCode, $coordinatorId, $actor): string {
            $reservation = DB::table('booking_reservations')->whereNull('deleted_at')->where('code', $reservationCode)->lockForUpdate()->first(['id', 'code', 'title', 'status', 'travel_from', 'travel_to']);

            if ($reservation === null) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una reserva.');
            }

            if (! in_array($reservation->status, ReservationLifecycle::ORDERABLE, true)) {
                throw ApiException::unprocessable('OPS-BR-01', 'Solo una reserva confirmada, pendiente de pago o de proveedor, reprogramada o en operación genera orden operativa.');
            }

            if (DB::table('ops_orders')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->exists()) {
                throw ApiException::conflict('OPS-BR-02', 'Esta reserva ya tiene una orden operativa.');
            }

            $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->where('status', '<>', 'cancelado')
                ->whereIn('service_kind', ['tour', 'traslado'])->orderBy('service_date')->orderBy('service_time')->get(['id', 'name', 'service_date', 'service_time']);
            $code = $this->sequences->next('ops_order', year: (int) substr((string) $reservation->travel_from, 0, 4));
            $orderId = (string) Str::uuid7();
            DB::table('ops_orders')->insert([
                'id' => $orderId,
                'code' => $code,
                'reservation_id' => $reservation->id,
                'title' => $reservation->title,
                'status' => $services->isEmpty() ? 'planificada' : 'pendiente_asignacion',
                'coordinator_id' => $coordinatorId,
                'date_from' => $reservation->travel_from,
                'date_to' => $reservation->travel_to,
                'created_by' => $actor->getKey(),
            ]);

            foreach (self::DEFAULT_TASKS as $position => $title) {
                DB::table('ops_order_tasks')->insert(['order_id' => $orderId, 'title' => $title, 'position' => $position, 'created_by' => $actor->getKey()]);
            }

            foreach ($services as $service) {
                DB::table('ops_assignments')->insert([
                    'order_id' => $orderId,
                    'reservation_service_id' => $service->id,
                    'service_date' => $service->service_date,
                    'service_time' => $service->service_time,
                    'service_label' => $service->name,
                    'status' => 'pendiente',
                    'created_by' => $actor->getKey(),
                ]);
            }

            $this->audit->log('Orden operativa', $code, 'crear', null, "{$reservation->code} · {$services->count()} servicios");

            return $code;
        });
    }

    public function update(string $code, string $coordinatorId, User $actor): void
    {
        $order = $this->order($code);
        $this->ensureOpen($order);
        $this->common->ensureCoordinator($coordinatorId);
        DB::table('ops_orders')->where('id', $order->id)->update(['coordinator_id' => $coordinatorId, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Orden operativa', $code, 'cambiar_coordinador', $order->coordinator_id, $coordinatorId);
    }

    public function advance(string $code, string $target, User $actor): void
    {
        $order = $this->order($code);

        if (! OrderFlow::allows($order->status, $target)) {
            throw ApiException::conflict('OPS-BR-05', 'La orden no puede pasar a ese estado desde el actual.');
        }

        $assignments = DB::table('ops_assignments')->where('order_id', $order->id)->pluck('status');

        if ($target === 'asignada' && $assignments->contains('pendiente')) {
            $pending = $assignments->filter(fn (string $status) => $status === 'pendiente')->count();
            throw ApiException::conflict('OPS-BR-05', "Hay {$pending} servicio(s) sin recursos. Asígnalos antes de continuar.");
        }

        if ($target === 'confirmada') {
            $unconfirmed = $assignments->reject(fn (string $status) => in_array($status, ['confirmada', 'en_curso', 'completada'], true))->count();
            $waiting = DB::table('booking_reservation_services')->where('reservation_id', $order->reservation_id)->whereIn('status', ['pendiente', 'solicitado'])->count();

            if ($unconfirmed > 0 || $waiting > 0) {
                throw ApiException::conflict('OPS-BR-05', "Falta confirmar {$unconfirmed} asignación(es) con el recurso y {$waiting} servicio(s) con el proveedor.");
            }
        }

        if ($target === 'completada') {
            if (! $actor->can('operations.close')) {
                throw ApiException::forbidden('FORBIDDEN', 'Tu rol no puede cerrar operaciones.', ['operations.close']);
            }

            $failed = collect($this->directory->checks($order->id, $order->reservation_id))->reject(fn (array $check) => $check['ok']);

            if ($failed->isNotEmpty()) {
                throw ApiException::unprocessable('OPS-BR-80', 'Aún no se puede cerrar: '.mb_strtolower($failed->pluck('label')->implode(', ')).'.');
            }
        }

        DB::transaction(function () use ($order, $target, $actor): void {
            DB::table('ops_orders')->where('id', $order->id)->update([
                'status' => $target,
                'closed_at' => $target === 'completada' ? now() : null,
                'closed_by' => $target === 'completada' ? $actor->getKey() : null,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);

            $reservationStatus = match ($target) {
                'en_ejecucion' => ['from' => 'confirmada', 'to' => 'en_operacion', 'action' => 'iniciar_operacion'],
                'completada' => ['from' => 'en_operacion', 'to' => 'completada', 'action' => 'completar'],
                default => null,
            };

            if ($reservationStatus !== null) {
                $moved = DB::table('booking_reservations')->where('id', $order->reservation_id)->where('status', $reservationStatus['from'])->update(['status' => $reservationStatus['to'], 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

                if ($moved > 0) {
                    $reservationCode = (string) DB::table('booking_reservations')->where('id', $order->reservation_id)->value('code');
                    $this->audit->log('Reserva', $reservationCode, $reservationStatus['action'], $reservationStatus['from'], $reservationStatus['to'], actor: $actor);
                }
            }
        });

        $this->audit->log('Orden operativa', $code, $target === 'completada' ? 'cerrar' : 'cambio_estado', $order->status, $target);
    }

    public function cancel(string $code, string $reason, User $actor): void
    {
        $order = $this->order($code);
        $this->ensureOpen($order);

        if ($order->status === 'en_ejecucion') {
            throw ApiException::conflict('OPS-BR-05', 'La operación ya está en ejecución: registra una incidencia en lugar de cancelarla.');
        }

        DB::transaction(function () use ($order, $reason, $actor): void {
            DB::table('ops_orders')->where('id', $order->id)->update(['status' => 'cancelada', 'cancelled_at' => now(), 'cancel_reason' => $reason, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            DB::table('ops_assignments')->where('order_id', $order->id)->whereNotIn('status', ['completada'])->update(['guide_id' => null, 'driver_id' => null, 'vehicle_id' => null, 'status' => 'pendiente', 'updated_at' => now()]);
        });

        $this->audit->log('Orden operativa', $code, 'cancelar', $order->status, $reason);
    }

    public function addTask(string $code, string $title, User $actor): void
    {
        $order = $this->order($code);
        $this->ensureOpen($order);
        $position = (int) DB::table('ops_order_tasks')->where('order_id', $order->id)->max('position') + 1;
        DB::table('ops_order_tasks')->insert(['order_id' => $order->id, 'title' => $title, 'position' => $position, 'created_by' => $actor->getKey()]);
        $this->audit->log('Orden operativa', $code, 'agregar_tarea', null, $title);
    }

    public function toggleTask(string $taskId, bool $done, User $actor): void
    {
        $task = $this->task($taskId);
        DB::table('ops_order_tasks')->where('id', $task->id)->update(['done' => $done, 'done_by' => $done ? $actor->getKey() : null, 'done_at' => $done ? now() : null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Orden operativa', $task->order_code, $done ? 'completar_tarea' : 'reabrir_tarea', null, $task->title);
    }

    public function deleteTask(string $taskId, User $actor): void
    {
        $task = $this->task($taskId);
        DB::table('ops_order_tasks')->where('id', $task->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Orden operativa', $task->order_code, 'eliminar_tarea', $task->title, null);
    }

    private function order(string $code): object
    {
        return DB::table('ops_orders')->whereNull('deleted_at')->where('code', $code)->first() ?? throw ApiException::notFound('La orden operativa no existe.');
    }

    private function task(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La tarea no existe.');
        }

        $task = DB::table('ops_order_tasks as t')->join('ops_orders as o', 'o.id', '=', 't.order_id')->whereNull('t.deleted_at')->where('t.id', $id)
            ->first(['t.id', 't.title', 'o.code as order_code', 'o.status as order_status']) ?? throw ApiException::notFound('La tarea no existe.');

        if (in_array($task->order_status, ['completada', 'cancelada'], true)) {
            throw ApiException::conflict('OPS-BR-05', 'La orden ya está cerrada.');
        }

        return $task;
    }

    private function ensureOpen(object $order): void
    {
        if (in_array($order->status, ['completada', 'cancelada'], true)) {
            throw ApiException::conflict('OPS-BR-05', 'La orden ya está cerrada.');
        }
    }
}
