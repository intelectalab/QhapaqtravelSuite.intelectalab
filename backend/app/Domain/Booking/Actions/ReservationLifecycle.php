<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Enums\ReservationStatus as S;
use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Booking\Support\ReservationReceivables;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\OrderWorkflow;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class ReservationLifecycle
{
    public const CONFIRMABLE = [S::Borrador->value, S::PendienteDisponibilidad->value, S::PendienteProveedor->value, S::Reprogramada->value];

    public const STARTABLE = [S::Confirmada->value, S::Reprogramada->value, S::PendientePago->value, S::PendienteProveedor->value];

    public const ORDERABLE = [S::Confirmada->value, S::PendientePago->value, S::PendienteProveedor->value, S::Reprogramada->value, S::EnOperacion->value];

    public function __construct(
        private readonly ReservationStateMachine $states,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly Advisors $advisors,
        private readonly ReservationReceivables $receivables,
        private readonly SyncServicePayables $payables,
        private readonly OutboxWriter $outbox,
    ) {}

    public function load(string $code, User $actor): Reservation
    {
        $reservation = Reservation::query()->where('code', $code)->lock('for no key update')->first()
            ?? throw Portfolio::missing($actor, 'booking_reservations', $code, 'La reserva no existe.', 'Esta reserva');
        Gate::forUser($actor)->authorize('view', $reservation);

        return $reservation;
    }

    public function open(string $code, User $actor): Reservation
    {
        $reservation = $this->load($code, $actor);

        if (S::from((string) $reservation->status)->isClosed()) {
            throw ApiException::conflict('RESERVATION_CLOSED', 'La reserva ya está '.($reservation->status === S::Cancelada->value ? 'cancelada' : 'completada').' y no admite cambios.');
        }

        return $reservation;
    }

    public function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->timezone())->startOfDay();
    }

    public function confirm(string $code, User $actor): Reservation
    {
        return DB::transaction(function () use ($code, $actor): Reservation {
            $reservation = $this->open($code, $actor);
            $from = (string) $reservation->status;

            if (! in_array($from, self::CONFIRMABLE, true)) {
                throw ApiException::conflict('RES-BR-07', 'Solo se confirma una reserva en borrador, pendiente de disponibilidad o de proveedor, o reprogramada.');
            }

            if (! DB::table('booking_passengers')->where('reservation_id', $reservation->id)->exists()) {
                throw ApiException::conflict('RES-BR-07', 'La reserva necesita al menos un pasajero para confirmarse.');
            }

            $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->where('is_required', true)
                ->where('status', '<>', 'cancelado')->orderBy('service_date')->get(['id', 'code', 'name', 'status', 'replaced_by_id', 'departure_id', 'pax']);
            $blocked = $services->first(fn (object $service): bool => $service->status === 'rechazado' && $service->replaced_by_id === null);

            if ($blocked !== null) {
                throw ApiException::conflict('RES-BR-07', "El proveedor rechazó «{$blocked->name}» y no tiene alternativa. Registra una alternativa antes de confirmar.");
            }

            $this->holdSeats($reservation, $services, $actor);

            if ($from === S::PendienteProveedor->value && $services->contains(fn (object $service): bool => in_array($service->status, ['pendiente', 'solicitado'], true))) {
                $this->audit->log('Reserva', $reservation->code, 'verificar_disponibilidad', $from, 'servicios por confirmar', actor: $actor);

                return $reservation;
            }

            $this->states->transition($reservation, S::Confirmada);
            $reservation->forceFill(['updated_by' => $actor->getKey()])->save();

            if (! $this->receivables->exist((string) $reservation->id)) {
                $this->receivables->create($reservation, $actor);
            }

            $this->payables->handle((string) $reservation->id, $actor);
            $this->audit->log('Reserva', $reservation->code, 'confirmar', $from, S::Confirmada->value, actor: $actor);
            $this->outbox->add('booking_reservation', (string) $reservation->id, 'ReservationConfirmed', ['reservation_id' => (string) $reservation->id, 'reservation_code' => $reservation->code]);
            ReservationConfirmed::dispatch($this->context->idOrFail(), (string) $reservation->id, $reservation->code, $reservation->quote_id, (string) $actor->getKey());

            return $reservation;
        });
    }

    public function startOperation(string $code, User $actor): Reservation
    {
        return DB::transaction(function () use ($code, $actor): Reservation {
            $reservation = $this->open($code, $actor);
            $from = (string) $reservation->status;

            if (! in_array($from, self::STARTABLE, true)) {
                throw ApiException::conflict('RES-BR-08', 'Solo se inicia la operación de una reserva confirmada, reprogramada o pendiente de pago o de proveedor.');
            }

            $limit = $this->today()->addDay();
            if ($reservation->travel_from !== null && $reservation->travel_from->greaterThan($limit)) {
                throw ApiException::conflict('RES-BR-08', 'La operación se inicia desde el día anterior al viaje. Este viaje empieza el '.$reservation->travel_from->format('d/m/Y').'.');
            }

            $this->states->transition($reservation, S::EnOperacion);
            $reservation->forceFill(['updated_by' => $actor->getKey()])->save();
            $this->audit->log('Reserva', $reservation->code, 'iniciar_operacion', $from, S::EnOperacion->value, actor: $actor);

            return $reservation;
        });
    }

    public function complete(string $code, User $actor): Reservation
    {
        return DB::transaction(function () use ($code, $actor): Reservation {
            $reservation = $this->open($code, $actor);
            $from = $this->states->transition($reservation, S::Completada);
            $reservation->forceFill(['updated_by' => $actor->getKey()])->save();
            $this->audit->log('Reserva', $reservation->code, 'completar', $from, S::Completada->value, actor: $actor);

            return $reservation;
        });
    }

    public function reassign(string $code, string $ownerId, ?string $note, User $actor): Reservation
    {
        return DB::transaction(function () use ($code, $ownerId, $note, $actor): Reservation {
            $reservation = $this->open($code, $actor);

            if (! $this->advisors->has($ownerId)) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un asesor activo.', ['owner_id' => ['Elige un asesor activo.']]);
            }

            $before = (string) $reservation->owner_id;
            if ($before === $ownerId) {
                throw ApiException::conflict('RES-BR-51', 'La reserva ya está a cargo de esa persona.');
            }

            $reservation->forceFill(['owner_id' => $ownerId, 'updated_by' => $actor->getKey()])->save();
            $this->audit->log('Reserva', $reservation->code, 'reasignar', $before, $ownerId.($note ? " · {$note}" : ''), actor: $actor);

            return $reservation;
        });
    }

    public function generateReceivables(string $code, User $actor): array
    {
        return DB::transaction(function () use ($code, $actor): array {
            $reservation = $this->load($code, $actor);

            if ($reservation->status === S::Cancelada->value) {
                throw ApiException::conflict('RES-BR-41', 'Una reserva cancelada no genera cuotas.');
            }

            if ($this->receivables->exist((string) $reservation->id)) {
                throw ApiException::conflict('RES-BR-41', 'La reserva ya tiene cuotas. Ajusta las existentes desde Finanzas.');
            }

            return $this->receivables->create($reservation, $actor);
        });
    }

    public function operationOrder(string $code, ?string $coordinatorId, User $actor, OrderWorkflow $orders): string
    {
        return DB::transaction(function () use ($code, $coordinatorId, $actor, $orders): string {
            $reservation = $this->load($code, $actor);

            if (! in_array((string) $reservation->status, self::ORDERABLE, true)) {
                throw ApiException::conflict('RES-BR-42', 'Solo una reserva confirmada, pendiente de pago o de proveedor, reprogramada o en operación genera orden operativa.');
            }

            return $orders->create($reservation->code, $coordinatorId ?: (string) $actor->getKey(), $actor);
        });
    }

    private function holdSeats(Reservation $reservation, Collection $services, User $actor): void
    {
        $held = DB::table('booking_inventory_holds')->where('reservation_id', $reservation->id)->whereIn('status', ['hold', 'confirmada'])->pluck('departure_id')->all();
        $missing = $services->filter(fn (object $service): bool => $service->departure_id !== null && ! in_array($service->departure_id, $held, true) && $service->status !== 'rechazado')
            ->groupBy('departure_id');

        if ($missing->isEmpty()) {
            return;
        }

        $departures = DB::table('catalog_product_departures')->whereIn('id', $missing->keys()->all())->orderBy('id')->lock('for no key update')->get(['id', 'ref', 'capacity', 'sold'])->keyBy('id');

        foreach ($missing as $departureId => $items) {
            $pax = (int) $items->max('pax');
            $departure = $departures->get($departureId);
            $free = $departure ? (int) $departure->capacity - (int) $departure->sold : 0;

            if ($departure === null || $free < $pax) {
                throw ApiException::conflict('RES-BR-07', 'La salida '.($departure->ref ?? '').' ya no tiene cupo para '.$pax.' pasajeros (quedan '.max(0, $free).').');
            }

            DB::table('booking_inventory_holds')->insert([
                'tenant_id' => $this->context->idOrFail(),
                'departure_id' => $departureId,
                'reservation_id' => $reservation->id,
                'booking_service_id' => $items->first()->id,
                'pax' => $pax,
                'status' => 'confirmada',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            DB::table('catalog_product_departures')->where('id', $departureId)->update([
                'sold' => DB::raw("sold + {$pax}"),
                'status' => DB::raw("case when sold + {$pax} >= capacity then 'completa' else status end"),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Disponibilidad', (string) $departureId, 'retener', null, "{$pax} cupos · {$reservation->code}", actor: $actor);
        }
    }
}
