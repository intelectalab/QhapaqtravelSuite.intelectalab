<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Actions;

use App\Domain\Bookings\Actions\Support\ServicesFromQuoteItem;
use App\Domain\Bookings\Enums\ReservationStatus;
use App\Domain\Bookings\Events\ReservationConfirmed;
use App\Domain\Bookings\Events\ReservationCreated;
use App\Domain\Bookings\Models\Reservation;
use App\Domain\Bookings\StateMachines\ReservationStateMachine;
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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Caso de uso: convertir una cotización aprobada en reserva (PROC-025). Implementa los pasos 1–18 de la
 * spec 04 §4.3 (el paso 0 —Idempotency-Key— lo resuelve IdempotencyMiddleware; el 19 el controlador).
 *
 * Garantías (RT-22: «una cotización genera como máximo una reserva, aunque se cancele»):
 *   - lock Redis por cotización (paso 1) → evita trabajo duplicado entre workers;
 *   - `SELECT … FOR UPDATE` de la cotización (paso 3) → serializa en PostgreSQL;
 *   - idempotencia de negocio (paso 4) → si ya existe, devuelve la existente (200) y audita `convertir_idempotente`;
 *   - UNIQUE parcial `uq_booking_reservations_tenant_id_quote_id_p` → última red.
 *
 * Devuelve el modelo Reservation; `$reservation->wasRecentlyCreated` distingue 201 (nueva) de 200 (existente).
 * Firma usada por la plantilla Pest ConvertQuoteIdempotencyTest (prueba de 10 procesos concurrentes).
 */
final class ConvertQuoteToReservation
{
    /** Anticipo 40 % / saldo 60 % (RES-BR-03; D-04: porcentaje por confirmar con negocio). */
    private const DEPOSIT_PCT = '0.40';

    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $tenantDb,
        private readonly InventoryLock $inventory,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
        private readonly ServicesFromQuoteItem $servicesFromItem,
        private readonly QuoteStateMachine $quoteStates,
        private readonly ReservationStateMachine $reservationStates,
    ) {
    }

    public function handle(string $quoteId, string $idempotencyKey, ?int $lockVersion, User $actor, ?string $notes = null): Reservation
    {
        // El tenant sale del contexto (request/job) o, si la Action se invoca fuera de una solicitud, del actor.
        $tenantId = $this->context->id() ?? (string) $actor->tenant_id;

        // Paso 1 — lock distribuido por cotización: t:{tenant}:quote:{id}:convert (TTL 30 s, espera 5 s).
        $lock = Cache::lock('t:'.$tenantId.':quote:'.$quoteId.':convert', 30);

        try {
            $lock->block(5);
        } catch (LockTimeoutException) {
            throw ApiException::conflict('QUOTE_CONVERSION_IN_PROGRESS', 'Conversión en curso para esta cotización. Intente en unos segundos.');
        }

        try {
            // Paso 2 — transacción con SET LOCAL app.tenant_id (dentro de la solicitud se convierte en SAVEPOINT).
            return $this->tenantDb->run(
                $tenantId,
                fn () => $this->convert($quoteId, $idempotencyKey, $lockVersion, $actor, $notes),
                attempts: 3,
            );
        } finally {
            $lock->release();
        }
    }

    private function convert(string $quoteId, string $idempotencyKey, ?int $lockVersion, User $actor, ?string $notes): Reservation
    {
        $today = CarbonImmutable::now($this->context->timezone())->startOfDay();

        // Paso 3 — bloqueo de la cotización y control optimista (If-Match).
        $quote = Quote::query()->whereKey($quoteId)->lockForUpdate()->first() ?? throw ApiException::notFound();
        $quote->assertLockVersion($lockVersion);

        // Paso 4 — idempotencia de negocio: ya convertida ⇒ 200 con la reserva existente, sin crear nada.
        $existing = Reservation::query()->withTrashed()->where('quote_id', $quote->id)->first()
            ?? ($quote->reservation_id !== null ? Reservation::query()->withTrashed()->find($quote->reservation_id) : null);
        if ($existing !== null) {
            $this->audit->log('Cotización', $quote->code, 'convertir_idempotente', $quote->status, $existing->code,
                evidence: ['idempotency_key' => $idempotencyKey, 'motivo' => 'solicitud repetida'], actor: $actor);
            $existing->wasRecentlyCreated = false;

            return $existing;
        }

        // Paso 5 — precondiciones (RT-3).
        if ($quote->status !== QuoteStatus::Aprobada->value) {
            throw ApiException::conflict('RT-3', sprintf(
                'Solo una cotización aprobada puede generar reserva (estado actual: %s).',
                QuoteStatus::tryFrom((string) $quote->status)?->label() ?? $quote->status,
            ));
        }
        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first()
            ?? throw ApiException::conflict('RT-3', 'La cotización no tiene una versión vigente.');
        if ($version->status !== 'aprobada') {
            throw ApiException::conflict('RT-3', 'La versión vigente de la cotización no está aprobada.');
        }
        $items = DB::table('quote_items')->where('quote_version_id', $version->id)->orderBy('line_no')->get();
        $paxTotal = (int) $quote->pax_adt + (int) $quote->pax_chd + (int) $quote->pax_inf;
        $grandTotal = Decimal::round2((string) $version->grand_total);
        if ($items->isEmpty() || $paxTotal <= 0 || ! $grandTotal->isPositive()) {
            throw ApiException::unprocessable('RT-3', 'La cotización necesita al menos un ítem, pasajeros y un total mayor a cero.');
        }

        // Pasos 6–7 — bloqueo de inventario y re-verificación de disponibilidad DENTRO de la transacción (H-03).
        $productIds = $items->pluck('product_id')->unique()->values()->all();
        $products = DB::table('catalog_products')->whereIn('id', $productIds)
            ->get(['id', 'code', 'name', 'status', 'availability_model', 'main_provider_id'])->keyBy('id');
        $departureByItem = $this->findDepartures($items, $products, $today);

        return $this->inventory->withLocks('departure', array_values(array_unique(array_filter($departureByItem))), function () use (
            $quote, $version, $items, $products, $departureByItem, $grandTotal, $today, $actor, $idempotencyKey, $notes,
        ): Reservation {
            $departures = $this->inventory->lockRows('catalog_product_departures', array_values(array_unique(array_filter($departureByItem))));
            $this->assertAvailability($items, $products, $departureByItem, $departures);

            // Paso 8 — código RES-AAAA-NNNNNN.
            $code = $this->sequences->next('reservation');

            // Pasos 11–12 — cabecera con snapshot y políticas congeladas de la versión (RES-BR-02).
            $owner = User::query()->findOrFail($quote->owner_id);
            $reservation = new Reservation();
            $reservation->forceFill([
                'code' => $code,
                'quote_id' => $quote->id,
                'quote_version_id' => $version->id,
                'quote_version_no' => $version->version_no,
                'client_id' => $quote->client_id,
                'owner_id' => $quote->owner_id,
                'sede_id' => $owner->sede_id,
                'title' => $quote->title,
                'status' => ReservationStatus::Confirmada->value,
                'channel' => $this->channelFor((string) $quote->client_id),
                'travel_from' => $quote->travel_from,
                'travel_to' => $quote->travel_to,
                'currency' => $version->currency,
                'fx_rate' => $version->fx_rate,
                'total_amount' => (string) $grandTotal,
                'snapshot_label' => $version->snapshot_label,
                'catalog_snapshot' => json_decode((string) $version->catalog_snapshot, true),
                'policies_snapshot' => json_decode((string) $version->policies_snapshot, true) ?: [],
                'notes' => trim(sprintf('Generada desde %s v%d. %s', $quote->code, $version->version_no, (string) $notes)),
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);
            if (! $this->reservationStates->isValidInitial((string) $reservation->status)) {
                throw ApiException::conflict('STATE_TRANSITION_NOT_ALLOWED', 'Estado inicial de reserva no válido.');
            }
            $reservation->save();

            // Pasos 9–10 — servicios por componente y consumo de cupos de salida.
            $this->createServicesAndHolds($reservation, $items, $products, $departureByItem, $version, $actor);

            // Paso 13 — fichas placeholder de pasajeros.
            $this->createPlaceholderPassengers($reservation, $quote);

            // Paso 14 — CxC 40/60.
            $this->createReceivables($reservation, $grandTotal, $today, $actor);

            // Paso 15 — cotización: aprobada → convertida (máquina de estados), reservation_id, converted_at.
            $before = $this->quoteStates->transition($quote, QuoteStatus::Convertida);
            $quote->forceFill(['reservation_id' => $reservation->id, 'converted_at' => now(), 'updated_by' => $actor->id])->save();

            // Paso 16 — oportunidad ganada.
            $this->winOpportunity($quote, $today, $actor);

            // Paso 17 — auditoría (dentro de la transacción).
            $this->audit->log('Reserva', $code, 'crear_desde_cotizacion', "{$quote->code} v{$version->version_no}",
                'confirmada · '.$reservation->currency.' '.$grandTotal, actor: $actor);
            $this->audit->log('Cotización', $quote->code, 'convertir', $before, 'convertida → '.$code, actor: $actor);

            // Paso 18 — outbox (efectos externos garantizados) + eventos de dominio (después del COMMIT).
            $payload = ['reservation_id' => $reservation->id, 'reservation_code' => $code, 'quote_id' => $quote->id, 'idempotency_key' => $idempotencyKey];
            foreach (['QuoteConverted', 'ReservationCreated', 'ReservationConfirmed'] as $event) {
                $this->outbox->add('booking_reservation', $reservation->id, $event, $payload);
            }
            $tenantId = $this->context->idOrFail();
            QuoteConverted::dispatch($tenantId, $reservation->id, $code, $quote->id, $actor->id);
            ReservationCreated::dispatch($tenantId, $reservation->id, $code, $quote->id, $actor->id);
            ReservationConfirmed::dispatch($tenantId, $reservation->id, $code, $quote->id, $actor->id);

            return $reservation; // wasRecentlyCreated = true ⇒ 201
        });
    }

    /**
     * Paso 6: salida por fecha para productos POR_SALIDA (tabla real `catalog_product_departures`, C-21).
     *
     * @return array<string, ?string> quote_item_id → departure_id
     */
    private function findDepartures($items, $products, CarbonImmutable $today): array
    {
        $map = [];
        foreach ($items as $item) {
            $product = $products[$item->product_id] ?? null;
            $map[$item->id] = null;
            if ($product?->availability_model !== 'POR_SALIDA') {
                continue;
            }
            $map[$item->id] = DB::table('catalog_product_departures')
                ->where('product_id', $item->product_id)
                ->where('departure_date', $item->service_date)
                ->where('departure_date', '>=', $today->toDateString())
                ->whereNotIn('status', ['cerrada', 'cancelada'])
                ->value('id');
        }

        return $map;
    }

    /** Paso 7: RT-4 / PRD-BR-012 / PRD-BR-002. Sin conversión parcial (RES-BR-01): un ítem sin cupo bloquea todo. */
    private function assertAvailability($items, $products, array $departureByItem, array $departures): void
    {
        $needed = []; // varios ítems pueden usar la misma salida
        foreach ($items as $item) {
            $product = $products[$item->product_id] ?? null;
            if ($product === null || $product->status !== 'ACTIVE') {
                throw ApiException::unprocessable('PRD-BR-002', sprintf('El producto %s no está activo.', $product->code ?? $item->product_id));
            }
            if ($product->availability_model !== 'POR_SALIDA') {
                continue; // PRD-BR-013: hold sujeto a confirmación del proveedor (advertencia, no bloqueo)
            }
            $depId = $departureByItem[$item->id] ?? null;
            if ($depId === null) {
                throw $this->noAvailability($item, 'No hay salida programada en la fecha del servicio.');
            }
            $needed[$depId] = ($needed[$depId] ?? 0) + (int) $item->pax;
            $dep = $departures[$depId];
            if ((int) $dep->capacity - (int) $dep->sold < $needed[$depId]) {
                throw $this->noAvailability($item, sprintf('La salida %s no tiene %d cupo(s) libre(s).', $dep->ref, $needed[$depId]));
            }
        }
    }

    private function noAvailability(object $item, string $message): ApiException
    {
        // Alternativas: otras salidas futuras no cerradas con cupo suficiente (el usuario crea una nueva versión).
        $alternatives = DB::table('catalog_product_departures')
            ->where('product_id', $item->product_id)
            ->where('departure_date', '>=', now()->toDateString())
            ->whereNotIn('status', ['cerrada', 'cancelada', 'completa'])
            ->whereRaw('capacity - sold >= ?', [(int) $item->pax])
            ->orderBy('departure_date')->limit(5)
            ->get(['ref', 'departure_date', DB::raw('capacity - sold as available')]);

        return ApiException::conflict('RT-4', $message.' No se puede convertir parcialmente: cree una nueva versión con otra fecha.', [
            'quote_item_id' => $item->id,
            'alternatives' => $alternatives,
        ]);
    }

    private function createServicesAndHolds(Reservation $reservation, $items, $products, array $departureByItem, object $version, User $actor): void
    {
        $seq = 0;
        $number = SequenceService::numberOf($reservation->code);

        foreach ($items as $item) {
            $product = $products[$item->product_id];
            $depId = $departureByItem[$item->id] ?? null;
            $rows = $this->servicesFromItem->build($item, (string) $version->discount_pct, (string) $version->currency,
                (string) $version->fx_rate, $depId, $product->main_provider_id);

            foreach ($rows as $row) {
                $seq++;
                $serviceId = DB::table('booking_reservation_services')->insertGetId([
                    ...$row,
                    'tenant_id' => $this->context->idOrFail(),
                    'reservation_id' => $reservation->id,
                    // SUPUESTO: código derivado como en el prototipo (RES-2026-000350 → RS-35001, RS-35002…).
                    'code' => sprintf('RS-%d%02d', $number, $seq),
                    'created_by' => $actor->id,
                    'updated_by' => $actor->id,
                ]);

                if ($depId !== null && $row === $rows[0]) {
                    // Hold confirmado una vez por ítem (no por componente) — booking_inventory_holds.
                    DB::table('booking_inventory_holds')->insert([
                        'tenant_id' => $this->context->idOrFail(),
                        'departure_id' => $depId,
                        'reservation_id' => $reservation->id,
                        'booking_service_id' => $serviceId,
                        'pax' => (int) $item->pax,
                        'status' => 'confirmada',
                        'created_by' => $actor->id,
                        'updated_by' => $actor->id,
                    ]);
                }
            }

            if ($depId !== null) {
                // sold += pax; estado `completa` si se llena (en el SET, `sold` es el valor anterior a la fila).
                // CHECK (sold <= capacity) de catalog_product_departures es la última red.
                $pax = (int) $item->pax;
                DB::table('catalog_product_departures')->where('id', $depId)->update([
                    'sold' => DB::raw("sold + {$pax}"),
                    'status' => DB::raw("case when sold + {$pax} >= capacity then 'completa' else status end"),
                    'updated_by' => $actor->id,
                ]);
            }
        }
    }

    private function createPlaceholderPassengers(Reservation $reservation, Quote $quote): void
    {
        $rows = [];
        $seq = 0;
        foreach (['ADT' => $quote->pax_adt, 'CHD' => $quote->pax_chd, 'INF' => $quote->pax_inf] as $type => $count) {
            for ($i = 1; $i <= (int) $count; $i++) {
                $rows[] = [
                    'tenant_id' => $this->context->idOrFail(),
                    'reservation_id' => $reservation->id,
                    'seq' => ++$seq,
                    'full_name' => "Pasajero {$type} {$i} (por completar)",
                    'pax_type' => $type,
                    'is_placeholder' => true,
                    'is_lead' => $seq === 1, // UNIQUE parcial: un solo titular por reserva (RES-V21-04)
                ];
            }
        }
        DB::table('booking_passengers')->insert($rows);
    }

    /**
     * Paso 14 — CxC 40/60: a = round2(total × 0.40); b = total − a.
     * due_a = min(hoy + 3, max(hoy, travel_from)); due_b = max(hoy, travel_from − 15).
     * Ejemplo spec: total 243 144.90, hoy 2026-09-29, viaje 2026-11-18 → 97 257.96 (02/10) y 145 886.94 (03/11).
     */
    private function createReceivables(Reservation $reservation, BigDecimal $total, CarbonImmutable $today, User $actor): void
    {
        $a = Decimal::round2($total->multipliedBy(self::DEPOSIT_PCT));
        $b = $total->minus($a);
        $from = CarbonImmutable::parse($reservation->travel_from->toDateString(), $today->getTimezone()); // misma zona que $today
        $dueA = $today->addDays(3)->min($from->max($today));
        $dueB = $from->subDays(15)->max($today);

        foreach ([['anticipo', 'Anticipo 40% — ', $a, $dueA], ['saldo', 'Saldo 60% — ', $b, $dueB]] as [$kind, $concept, $amount, $due]) {
            $code = $this->sequences->next('receivable'); // SUPUESTO: doc_type `receivable`, prefijo CXC- (semilla CXC-00716)
            DB::table('fin_receivables')->insert([
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'reservation_id' => $reservation->id,
                'client_id' => $reservation->client_id,
                'kind' => $kind,
                'concept' => mb_substr($concept.$reservation->title, 0, 255),
                'amount' => (string) $amount,
                'currency' => $reservation->currency,
                'fx_rate' => $reservation->fx_rate,
                'due_date' => $due->toDateString(),
                'status' => 'abierta',
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);
            $this->audit->log('Cuenta por cobrar', $code, 'crear', '', $reservation->currency.' '.$amount, actor: $actor);
        }
    }

    private function winOpportunity(Quote $quote, CarbonImmutable $today, User $actor): void
    {
        if ($quote->opportunity_id === null) {
            return;
        }
        $opp = DB::table('crm_opportunities')->where('id', $quote->opportunity_id)->lockForUpdate()->first(['id', 'code', 'stage']);
        if ($opp === null || $opp->stage === 'ganada') {
            return;
        }
        // CHECK ck_crm_opportunities_2: ganada ⇒ probability = 100 y closed_at no nulo.
        DB::table('crm_opportunities')->where('id', $opp->id)->update([
            'stage' => 'ganada', 'probability' => 100, 'closed_at' => $today->toDateString(), 'updated_by' => $actor->id,
        ]);
        $this->audit->log('Oportunidad', $opp->code, 'cambio_etapa', $opp->stage, 'ganada', actor: $actor);
    }

    /**
     * Canal = segmento del cliente: Corporativo/B2B; Grupos → Corporativo; resto Directo (spec 04 §4.3 paso 12).
     * SUPUESTO: `crm_clients.segment_code` guarda el código del segmento ('Corporativo', 'B2B', 'Grupos'…).
     */
    private function channelFor(string $clientId): string
    {
        $segment = mb_strtolower((string) DB::table('crm_clients')->where('id', $clientId)->value('segment_code'));

        return match ($segment) {
            'corporativo', 'grupos' => 'Corporativo',
            'b2b' => 'B2B',
            default => 'Directo',
        };
    }
}
