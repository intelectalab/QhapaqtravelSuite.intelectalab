<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Booking\Events\ReservationCreated;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Booking\Support\DirectBookingPlan;
use App\Domain\Booking\Support\ReservationAssembler;
use App\Domain\Booking\Support\ReservationReceivables;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\InventoryLock;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class CreateDirectReservation
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $tenantDb,
        private readonly InventoryLock $inventory,
        private readonly DirectBookingPlan $plans,
        private readonly ReservationAssembler $assembler,
        private readonly ReservationReceivables $receivables,
        private readonly SyncServicePayables $payables,
        private readonly SequenceService $sequences,
        private readonly ReservationStateMachine $states,
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
        private readonly Advisors $advisors,
    ) {}

    public function handle(array $data, User $actor): Reservation
    {
        $client = Portfolio::scope(DB::table('crm_clients')->whereNull('deleted_at'), $actor, 'owner_id')
            ->where(preg_match('/^[0-9a-f-]{36}$/i', (string) $data['client_id']) === 1 ? 'id' : 'code', $data['client_id'])
            ->first(['id', 'code', 'name'])
            ?? throw ApiException::unprocessable('RES-BR-04', 'Elige un cliente de tu cartera.', ['client_id' => ['Elige un cliente de tu cartera.']]);
        $ownerId = $this->owner($data, $actor);
        $plan = $this->plans->build([...$data, 'client_id' => $client->id], $actor, true);
        $departureIds = $plan['departure'] ? [(string) $plan['departure']['id']] : [];

        return $this->inventory->withLocks('departure', $departureIds, fn (): Reservation => $this->tenantDb->run(
            $this->context->idOrFail(),
            fn (): Reservation => $this->create($data, $plan, $client, $ownerId, $actor),
            attempts: 3,
        ));
    }

    private function create(array $data, array $plan, object $client, string $ownerId, User $actor): Reservation
    {
        $seats = (int) $plan['pax']['adt'] + (int) $plan['pax']['chd'];
        $available = $plan['available'];

        if ($plan['departure']) {
            $row = $this->inventory->lockRows('catalog_product_departures', [(string) $plan['departure']['id']])[(string) $plan['departure']['id']];
            $available = (int) $row->capacity - (int) $row->sold >= $seats;
        }

        $confirm = (bool) ($data['confirm'] ?? false);
        if ($confirm && ! $available) {
            throw ApiException::conflict('RES-BR-05', 'No hay cupo suficiente para confirmar. Guarda la reserva como borrador y quedará pendiente de disponibilidad.');
        }

        $status = $confirm ? ReservationStatus::Confirmada : ($available ? ReservationStatus::Borrador : ReservationStatus::PendienteDisponibilidad);
        $product = DB::table('catalog_products')->where('id', $plan['product_id'])->first(['id', 'code', 'name']);
        $policies = (array) (DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund']) ?? []);
        $version = DB::table('catalog_product_versions')->where('product_id', $product->id)->orderByDesc('created_at')->value('version');

        $reservation = new Reservation;
        $reservation->forceFill([
            'code' => $this->sequences->next('reservation'),
            'client_id' => $client->id,
            'owner_id' => $ownerId,
            'sede_id' => $this->assembler->sedeFor($ownerId, $actor),
            'title' => mb_substr("{$product->name} — {$client->name}", 0, 200),
            'status' => $status->value,
            'channel' => $plan['channel'],
            'travel_from' => $plan['travel_from'],
            'travel_to' => $plan['travel_to'],
            'currency' => $plan['currency'],
            'fx_rate' => $plan['fx_rate'],
            'total_amount' => $plan['total'],
            'snapshot_label' => $product->code.($version ? " v{$version}" : ''),
            'catalog_snapshot' => ['product' => $product->code, 'name' => $product->name, 'adult_price' => $plan['adult_price'], 'child_price' => $plan['child_price'], 'pax' => $plan['pax']],
            'policies_snapshot' => [$product->code => $policies],
            'notes' => trim('Reserva directa. '.(string) ($data['notes'] ?? '')),
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        if (! $this->states->isValidInitial($status->value)) {
            throw ApiException::conflict('STATE_TRANSITION_NOT_ALLOWED', 'El estado inicial de la reserva no es válido.');
        }

        $reservation->save();

        $item = (object) [
            'id' => null,
            'product_id' => $product->id,
            'qty' => 1,
            'pax' => $seats,
            'unit_price' => (string) BigDecimal::of($plan['total'])->dividedBy($seats, 6, RoundingMode::HALF_UP),
            'unit_cost' => (string) BigDecimal::of($plan['cost'])->dividedBy($seats, 6, RoundingMode::HALF_UP),
            'service_date' => $plan['date'],
        ];
        $this->assembler->addServices($reservation, $item, $plan['departure']['id'] ?? null, '0', $plan['currency'], $plan['fx_rate'], $plan['main_provider_id'], 0, $actor, $available);
        $this->assembler->placeholders($reservation, (int) $plan['pax']['adt'], (int) $plan['pax']['chd'], (int) $plan['pax']['inf']);
        $this->receivables->create($reservation, $actor, BigDecimal::of($plan['total']));
        $this->payables->handle((string) $reservation->id, $actor);

        $this->audit->log('Reserva', $reservation->code, 'crear_directa', null, "{$status->value} · {$plan['currency']} {$plan['total']} · {$seats} pax", actor: $actor);
        $this->publish($reservation, $status, $actor);

        return $reservation;
    }

    private function owner(array $data, User $actor): string
    {
        if (Portfolio::ownOnly($actor) || empty($data['owner_id']) || $data['owner_id'] === $actor->getKey()) {
            return (string) $actor->getKey();
        }

        if (! $this->advisors->has((string) $data['owner_id'])) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un asesor activo.', ['owner_id' => ['Elige un asesor activo.']]);
        }

        return (string) $data['owner_id'];
    }

    private function publish(Reservation $reservation, ReservationStatus $status, User $actor): void
    {
        $id = (string) $reservation->getKey();
        $payload = ['reservation_id' => $id, 'reservation_code' => $reservation->code, 'origin' => 'directa'];
        $tenantId = $this->context->idOrFail();
        $this->outbox->add('booking_reservation', $id, 'ReservationCreated', $payload);
        ReservationCreated::dispatch($tenantId, $id, $reservation->code, null, (string) $actor->getKey());

        if ($status === ReservationStatus::Confirmada) {
            $this->outbox->add('booking_reservation', $id, 'ReservationConfirmed', $payload);
            ReservationConfirmed::dispatch($tenantId, $id, $reservation->code, null, (string) $actor->getKey());
        }
    }
}
