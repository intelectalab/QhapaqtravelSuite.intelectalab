<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Booking\Events\ReservationCreated;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Booking\Support\ConversionPlan;
use App\Domain\Booking\Support\ReservationAssembler;
use App\Domain\Booking\Support\ReservationReceivables;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Enums\QuoteStatus;
use App\Domain\Quotes\Events\QuoteConverted;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Quotes\StateMachines\QuoteStateMachine;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\InventoryLock;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class ConvertQuoteToReservation
{
    private const EVENTS = ['QuoteConverted', 'ReservationCreated', 'ReservationConfirmed'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $tenantDb,
        private readonly InventoryLock $inventory,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
        private readonly ReservationAssembler $assembler,
        private readonly ConversionPlan $plan,
        private readonly ReservationReceivables $receivables,
        private readonly QuoteStateMachine $quoteStates,
        private readonly ReservationStateMachine $reservationStates,
    ) {}

    public function handle(string $quoteId, string $idempotencyKey, ?int $lockVersion, User $actor, ?string $notes = null): Reservation
    {
        $tenantId = $this->context->id() ?? (string) $actor->tenant_id;
        $lock = Cache::lock('t:'.$tenantId.':quote:'.$quoteId.':convert', 30);

        try {
            $lock->block(5);
        } catch (LockTimeoutException) {
            throw ApiException::conflict('QUOTE_CONVERSION_IN_PROGRESS', 'La conversión ya está en curso. Intenta en unos segundos.');
        }

        try {
            return $this->tenantDb->run(
                $tenantId,
                fn (): Reservation => $this->convert($quoteId, $idempotencyKey, $lockVersion, $actor, $notes),
                attempts: 3,
            );
        } finally {
            $lock->release();
        }
    }

    private function convert(string $quoteId, string $idempotencyKey, ?int $lockVersion, User $actor, ?string $notes): Reservation
    {
        $today = $this->plan->today();
        $quote = Quote::query()->whereKey($quoteId)->lockForUpdate()->first() ?? throw ApiException::notFound('La cotización no existe.');
        $quote->assertLockVersion($lockVersion);

        $existing = $this->existingReservation($quote);
        if ($existing !== null) {
            $this->audit->log('Cotización', $quote->code, 'convertir_idempotente', $quote->status, $existing->code,
                evidence: ['idempotency_key' => $idempotencyKey, 'motivo' => 'solicitud repetida'], actor: $actor);
            $existing->wasRecentlyCreated = false;

            return $existing;
        }

        if ($quote->status !== QuoteStatus::Aprobada->value) {
            throw ApiException::conflict('RT-3', sprintf(
                'Solo una cotización aprobada por el cliente puede generar reserva (estado actual: %s).',
                QuoteStatus::tryFrom((string) $quote->status)?->label() ?? $quote->status,
            ));
        }

        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first()
            ?? throw ApiException::conflict('RT-3', 'La cotización no tiene una versión vigente.');
        if ($version->status !== 'aprobada') {
            throw ApiException::conflict('RT-3', 'La versión vigente de la cotización no está aprobada.');
        }

        $items = $this->plan->items((string) $version->id);
        $grandTotal = Decimal::round2((string) $version->grand_total);
        if ($items->isEmpty() || $quote->paxTotal() <= 0 || ! $grandTotal->isPositive()) {
            throw ApiException::unprocessable('RT-3', 'La cotización necesita al menos un servicio, pasajeros y un total mayor a cero.');
        }

        $products = $this->plan->products($items);
        $departureByItem = $this->plan->departures($items, $products, $today);
        $departureIds = array_values(array_unique(array_filter($departureByItem)));

        return $this->inventory->withLocks('departure', $departureIds, function () use (
            $quote, $version, $items, $products, $departureByItem, $departureIds, $grandTotal, $today, $actor, $idempotencyKey, $notes,
        ): Reservation {
            $departures = $this->inventory->lockRows('catalog_product_departures', $departureIds);
            $this->plan->assertAvailable($items, $products, $departureByItem, $departures);

            $reservation = $this->createReservation($quote, $version, $grandTotal, $actor, $notes);
            $this->createServicesAndHolds($reservation, $items, $products, $departureByItem, $version, $actor);
            $this->assembler->placeholders($reservation, (int) $quote->pax_adt, (int) $quote->pax_chd, (int) $quote->pax_inf);
            $this->receivables->create($reservation, $actor, $grandTotal);

            $before = $this->quoteStates->transition($quote, QuoteStatus::Convertida);
            $quote->forceFill(['reservation_id' => $reservation->id, 'converted_at' => now(), 'updated_by' => $actor->getKey()])->save();

            $this->winOpportunity($quote, $today, $actor);

            $this->audit->log('Reserva', $reservation->code, 'crear_desde_cotizacion', "{$quote->code} v{$version->version_no}",
                "confirmada · {$reservation->currency} {$grandTotal}", actor: $actor);
            $this->audit->log('Cotización', $quote->code, 'convertir', $before, 'convertida → '.$reservation->code,
                evidence: ['idempotency_key' => $idempotencyKey], actor: $actor);

            $this->publish($reservation, $quote, $idempotencyKey, $actor);

            return $reservation;
        });
    }

    private function existingReservation(Quote $quote): ?Reservation
    {
        return Reservation::query()->withTrashed()->where('quote_id', $quote->id)->first()
            ?? ($quote->reservation_id !== null ? Reservation::query()->withTrashed()->find($quote->reservation_id) : null);
    }

    private function createReservation(Quote $quote, object $version, BigDecimal $grandTotal, User $actor, ?string $notes): Reservation
    {
        $reservation = new Reservation;
        $reservation->forceFill([
            'code' => $this->sequences->next('reservation'),
            'quote_id' => $quote->id,
            'quote_version_id' => $version->id,
            'quote_version_no' => $version->version_no,
            'client_id' => $quote->client_id,
            'owner_id' => $quote->owner_id,
            'sede_id' => $this->assembler->sedeFor((string) $quote->owner_id, $actor),
            'title' => $quote->title,
            'status' => ReservationStatus::Confirmada->value,
            'channel' => $this->assembler->channelFor((string) $quote->client_id),
            'travel_from' => $quote->travel_from,
            'travel_to' => $quote->travel_to,
            'currency' => $version->currency,
            'fx_rate' => $version->fx_rate,
            'total_amount' => (string) $grandTotal,
            'snapshot_label' => $version->snapshot_label,
            'catalog_snapshot' => json_decode((string) $version->catalog_snapshot, true),
            'policies_snapshot' => json_decode((string) $version->policies_snapshot, true) ?: [],
            'notes' => trim("Generada desde {$quote->code} v{$version->version_no}. ".(string) $notes),
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        if (! $this->reservationStates->isValidInitial((string) $reservation->status)) {
            throw ApiException::conflict('STATE_TRANSITION_NOT_ALLOWED', 'El estado inicial de la reserva no es válido.');
        }

        $reservation->save();

        return $reservation;
    }

    private function createServicesAndHolds(Reservation $reservation, Collection $items, Collection $products, array $departureByItem, object $version, User $actor): void
    {
        $seq = 0;

        foreach ($items as $item) {
            $seq = $this->assembler->addServices($reservation, $item, $departureByItem[$item->id] ?? null, (string) $version->discount_pct,
                (string) $version->currency, (string) $version->fx_rate, $products->get($item->product_id)?->main_provider_id, $seq, $actor);
        }
    }

    private function winOpportunity(Quote $quote, CarbonImmutable $today, User $actor): void
    {
        if ($quote->opportunity_id === null) {
            return;
        }

        $opportunity = DB::table('crm_opportunities')->where('id', $quote->opportunity_id)->lockForUpdate()->first(['id', 'code', 'stage']);
        if ($opportunity === null || $opportunity->stage === 'ganada') {
            return;
        }

        DB::table('crm_opportunities')->where('id', $opportunity->id)->update([
            'stage' => 'ganada', 'probability' => 100, 'closed_at' => $today->toDateString(), 'updated_by' => $actor->getKey(), 'updated_at' => now(),
        ]);
        $this->audit->log('Oportunidad', $opportunity->code, 'cambio_etapa', $opportunity->stage, 'ganada', actor: $actor);
    }

    private function publish(Reservation $reservation, Quote $quote, string $idempotencyKey, User $actor): void
    {
        $reservationId = (string) $reservation->getKey();
        $quoteId = (string) $quote->getKey();
        $payload = ['reservation_id' => $reservationId, 'reservation_code' => $reservation->code, 'quote_id' => $quoteId, 'idempotency_key' => $idempotencyKey];

        foreach (self::EVENTS as $event) {
            $this->outbox->add('booking_reservation', $reservationId, $event, $payload);
        }

        $tenantId = $this->context->idOrFail();
        $actorId = (string) $actor->getKey();
        QuoteConverted::dispatch($tenantId, $reservationId, $reservation->code, $quoteId, $actorId);
        ReservationCreated::dispatch($tenantId, $reservationId, $reservation->code, $quoteId, $actorId);
        ReservationConfirmed::dispatch($tenantId, $reservationId, $reservation->code, $quoteId, $actorId);
    }
}
