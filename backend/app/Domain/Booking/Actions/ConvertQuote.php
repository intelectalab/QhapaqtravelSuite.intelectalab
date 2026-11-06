<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Support\ServicesFromItem;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class ConvertQuote
{
    private const DEPOSIT_PCT = '0.40';

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $sequence,
        private readonly AuditLogger $audit,
        private readonly ServicesFromItem $services,
    ) {}

    public function preview(string $code, User $actor): array
    {
        $quote = $this->quote($code, $actor);
        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first();
        $items = $version ? DB::table('quote_items')->where('quote_version_id', $version->id)->orderBy('line_no')->get() : collect();
        $products = $this->products($items);
        $departures = $this->findDepartures($items, $products, $this->today());
        $total = BigDecimal::of((string) ($version->grand_total ?? 0))->toScale(2, RoundingMode::HALF_UP);
        [$deposit, $balance, $dueA, $dueB] = $this->split($total, (string) $quote->travel_from, $this->today());

        return [
            'code' => $quote->code,
            'status' => $quote->status,
            'reservation' => $quote->reservation_id ? DB::table('booking_reservations')->where('id', $quote->reservation_id)->value('code') : null,
            'currency' => $quote->currency,
            'total' => (float) (string) $total,
            'pax' => (int) $quote->pax_adt + (int) $quote->pax_chd + (int) $quote->pax_inf,
            'receivables' => [
                ['concept' => 'Anticipo 40 %', 'amount' => (float) (string) $deposit, 'due' => $dueA->toDateString()],
                ['concept' => 'Saldo 60 %', 'amount' => (float) (string) $balance, 'due' => $dueB->toDateString()],
            ],
            'items' => $items->map(fn (object $item): array => $this->availability($item, $products->get($item->product_id), $departures[$item->id] ?? null))->values()->all(),
        ];
    }

    public function handle(string $code, ?int $lockVersion, ?string $notes, ?string $idempotencyKey, User $actor): array
    {
        $lock = Cache::lock('t:'.$this->context->idOrFail().':quote:'.$code.':convert', 30);

        try {
            $lock->block(5);
        } catch (LockTimeoutException) {
            throw ApiException::conflict('QUOTE_CONVERSION_IN_PROGRESS', 'La conversión ya está en curso. Intenta en unos segundos.');
        }

        try {
            return DB::transaction(fn (): array => $this->convert($code, $lockVersion, $notes, $idempotencyKey, $actor), 3);
        } finally {
            $lock->release();
        }
    }

    private function convert(string $code, ?int $lockVersion, ?string $notes, ?string $idempotencyKey, User $actor): array
    {
        $today = $this->today();
        $quote = $this->quote($code, $actor, true);

        if ($lockVersion !== null && $lockVersion !== (int) $quote->lock_version) {
            throw ApiException::conflict('STALE_VERSION', 'Alguien cambió la cotización mientras la veías. Recarga la página.');
        }

        $existing = DB::table('booking_reservations')->where('quote_id', $quote->id)->first(['id', 'code'])
            ?? ($quote->reservation_id ? DB::table('booking_reservations')->where('id', $quote->reservation_id)->first(['id', 'code']) : null);

        if ($existing) {
            $this->audit->log('Cotización', $quote->code, 'convertir_idempotente', $quote->status, $existing->code, evidence: ['idempotency_key' => $idempotencyKey, 'motivo' => 'solicitud repetida']);

            return ['code' => $existing->code, 'created' => false];
        }

        if ($quote->status !== 'aprobada') {
            throw ApiException::conflict('RT-3', 'Solo una cotización aprobada por el cliente puede generar reserva.');
        }

        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first();
        if (! $version || $version->status !== 'aprobada') {
            throw ApiException::conflict('RT-3', 'La versión vigente de la cotización no está aprobada.');
        }

        $items = DB::table('quote_items')->where('quote_version_id', $version->id)->orderBy('line_no')->get();
        $total = BigDecimal::of((string) $version->grand_total)->toScale(2, RoundingMode::HALF_UP);
        if ($items->isEmpty() || (int) $quote->pax_adt + (int) $quote->pax_chd + (int) $quote->pax_inf <= 0 || ! $total->isPositive()) {
            throw ApiException::unprocessable('RT-3', 'La cotización necesita al menos un servicio, pasajeros y un total mayor a cero.');
        }

        $products = $this->products($items);
        $departureByItem = $this->findDepartures($items, $products, $today);
        $departureIds = array_values(array_unique(array_filter($departureByItem)));
        sort($departureIds);
        $departures = $departureIds ? DB::table('catalog_product_departures')->whereIn('id', $departureIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id') : collect();
        $this->assertAvailability($items, $products, $departureByItem, $departures);

        $reservationCode = $this->sequence->next('booking_reservations', 'RES-'.$today->year.'-', 6);
        $owner = DB::table('iam_users')->where('id', $quote->owner_id)->first(['sede_id']);
        $sedeId = $owner->sede_id ?? DB::table('iam_users')->where('id', $actor->getKey())->value('sede_id') ?? DB::table('iam_sedes')->orderBy('created_at')->value('id');
        $reservationId = (string) DB::table('booking_reservations')->insertGetId([
            'code' => $reservationCode,
            'quote_id' => $quote->id,
            'quote_version_id' => $version->id,
            'quote_version_no' => $version->version_no,
            'client_id' => $quote->client_id,
            'owner_id' => $quote->owner_id,
            'sede_id' => $sedeId,
            'title' => $quote->title,
            'status' => 'confirmada',
            'channel' => $this->channelFor((string) $quote->client_id),
            'travel_from' => $quote->travel_from,
            'travel_to' => $quote->travel_to,
            'currency' => $version->currency,
            'fx_rate' => $version->fx_rate,
            'total_amount' => (string) $total,
            'snapshot_label' => $version->snapshot_label,
            'catalog_snapshot' => $version->catalog_snapshot,
            'policies_snapshot' => $version->policies_snapshot ?: '{}',
            'notes' => trim("Generada desde {$quote->code} v{$version->version_no}. ".(string) $notes),
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        $this->createServices($reservationId, $reservationCode, $items, $products, $departureByItem, $version, $actor);
        $this->createPassengers($reservationId, $quote);
        $this->createReceivables($reservationId, $quote, $total, $today, $actor);

        DB::table('quote_quotes')->where('id', $quote->id)->update([
            'status' => 'convertida',
            'reservation_id' => $reservationId,
            'converted_at' => now(),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->winOpportunity($quote, $today, $actor);
        $this->audit->log('Reserva', $reservationCode, 'crear_desde_cotizacion', "{$quote->code} v{$version->version_no}", "confirmada · {$version->currency} {$total}");
        $this->audit->log('Cotización', $quote->code, 'convertir', 'aprobada', $reservationCode, evidence: ['idempotency_key' => $idempotencyKey]);

        return ['code' => $reservationCode, 'created' => true];
    }

    private function quote(string $code, User $actor, bool $lock = false): object
    {
        $query = Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code);

        return ($lock ? $query->lockForUpdate() : $query)->first() ?? throw ApiException::notFound('La cotización no existe.');
    }

    private function products(Collection $items): Collection
    {
        return DB::table('catalog_products')->whereIn('id', $items->pluck('product_id')->unique()->values()->all())
            ->get(['id', 'code', 'name', 'status', 'availability_model', 'main_provider_id'])->keyBy('id');
    }

    private function findDepartures(Collection $items, Collection $products, CarbonImmutable $today): array
    {
        $map = [];

        foreach ($items as $item) {
            $product = $products->get($item->product_id);
            $map[$item->id] = $product?->availability_model === 'POR_SALIDA'
                ? DB::table('catalog_product_departures')->where('product_id', $item->product_id)->where('departure_date', $item->service_date)->where('departure_date', '>=', $today->toDateString())->whereNotIn('status', ['cerrada', 'cancelada'])->value('id')
                : null;
        }

        return $map;
    }

    private function availability(object $item, ?object $product, ?string $departureId): array
    {
        $base = ['line' => (int) $item->line_no, 'product' => $product->name ?? '', 'date' => $item->service_date, 'pax' => (int) $item->pax];

        if (! $product || $product->status !== 'ACTIVE') {
            return [...$base, 'ok' => false, 'note' => 'El producto ya no está activo.'];
        }

        if ($product->availability_model !== 'POR_SALIDA') {
            return [...$base, 'ok' => true, 'note' => 'Se pide al proveedor y queda sujeto a su confirmación.'];
        }

        $departure = $departureId ? DB::table('catalog_product_departures')->where('id', $departureId)->first(['ref', 'capacity', 'sold']) : null;
        if (! $departure) {
            return [...$base, 'ok' => false, 'note' => 'No hay salida programada en esa fecha.'];
        }

        $free = (int) $departure->capacity - (int) $departure->sold;

        return [...$base, 'ok' => $free >= (int) $item->pax, 'note' => $free >= (int) $item->pax ? "Salida {$departure->ref}: quedan {$free} cupos." : "Salida {$departure->ref}: solo quedan {$free} cupos."];
    }

    private function assertAvailability(Collection $items, Collection $products, array $departureByItem, Collection $departures): void
    {
        $needed = [];

        foreach ($items as $item) {
            $product = $products->get($item->product_id);

            if (! $product || $product->status !== 'ACTIVE') {
                throw ApiException::unprocessable('PRD-BR-002', 'El producto '.($product->name ?? '').' ya no está activo. Crea una nueva versión sin él.');
            }

            if ($product->availability_model !== 'POR_SALIDA') {
                continue;
            }

            $departureId = $departureByItem[$item->id] ?? null;
            if (! $departureId) {
                throw ApiException::conflict('RT-4', "{$product->name} no tiene salida programada el {$item->service_date}. Crea una nueva versión con otra fecha.");
            }

            $needed[$departureId] = ($needed[$departureId] ?? 0) + (int) $item->pax;
            $departure = $departures->get($departureId);

            if ((int) $departure->capacity - (int) $departure->sold < $needed[$departureId]) {
                throw ApiException::conflict('RT-4', "La salida {$departure->ref} de {$product->name} no tiene {$needed[$departureId]} cupos libres. No se convierte a medias: crea una nueva versión con otra fecha.");
            }
        }
    }

    private function createServices(string $reservationId, string $reservationCode, Collection $items, Collection $products, array $departureByItem, object $version, User $actor): void
    {
        $seq = 0;
        $number = (int) substr($reservationCode, -6);

        foreach ($items as $item) {
            $departureId = $departureByItem[$item->id] ?? null;
            $rows = $this->services->build($item, $version, $departureId, $products->get($item->product_id)?->main_provider_id);

            foreach ($rows as $index => $row) {
                $seq++;
                $serviceId = (string) DB::table('booking_reservation_services')->insertGetId([
                    ...$row,
                    'reservation_id' => $reservationId,
                    'code' => sprintf('RS-%d%02d', $number, $seq),
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ]);

                if ($departureId && $index === 0) {
                    DB::table('booking_inventory_holds')->insert(['departure_id' => $departureId, 'reservation_id' => $reservationId, 'booking_service_id' => $serviceId, 'pax' => (int) $item->pax, 'status' => 'confirmada', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                }
            }

            if ($departureId) {
                $pax = (int) $item->pax;
                DB::table('catalog_product_departures')->where('id', $departureId)->update([
                    'sold' => DB::raw("sold + {$pax}"),
                    'status' => DB::raw("case when sold + {$pax} >= capacity then 'completa' else status end"),
                    'updated_by' => $actor->getKey(),
                ]);
            }
        }
    }

    private function createPassengers(string $reservationId, object $quote): void
    {
        $rows = [];
        $seq = 0;

        foreach (['ADT' => $quote->pax_adt, 'CHD' => $quote->pax_chd, 'INF' => $quote->pax_inf] as $type => $count) {
            for ($i = 1; $i <= (int) $count; $i++) {
                $seq++;
                $rows[] = ['reservation_id' => $reservationId, 'seq' => $seq, 'full_name' => "Pasajero {$type} {$i} (por completar)", 'pax_type' => $type, 'is_placeholder' => true, 'is_lead' => $seq === 1];
            }
        }

        DB::table('booking_passengers')->insert($rows);
    }

    private function split(BigDecimal $total, string $fromDate, CarbonImmutable $today): array
    {
        $deposit = $total->multipliedBy(self::DEPOSIT_PCT)->toScale(2, RoundingMode::HALF_UP);
        $from = CarbonImmutable::parse($fromDate, $today->getTimezone())->startOfDay();

        return [$deposit, $total->minus($deposit), $today->addDays(3)->min($from->max($today)), $from->subDays(15)->max($today)];
    }

    private function createReceivables(string $reservationId, object $quote, BigDecimal $total, CarbonImmutable $today, User $actor): void
    {
        [$deposit, $balance, $dueA, $dueB] = $this->split($total, (string) $quote->travel_from, $today);

        foreach ([['anticipo', 'Anticipo 40% — ', $deposit, $dueA], ['saldo', 'Saldo 60% — ', $balance, $dueB]] as [$kind, $concept, $amount, $due]) {
            $code = $this->sequence->next('fin_receivables', 'CXC-', 5);
            DB::table('fin_receivables')->insert([
                'code' => $code,
                'reservation_id' => $reservationId,
                'client_id' => $quote->client_id,
                'kind' => $kind,
                'concept' => mb_substr($concept.$quote->title, 0, 255),
                'amount' => (string) $amount,
                'currency' => $quote->currency,
                'fx_rate' => $quote->fx_rate,
                'due_date' => $due->toDateString(),
                'status' => 'abierta',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Cuenta por cobrar', $code, 'crear', null, "{$quote->currency} {$amount}");
        }
    }

    private function winOpportunity(object $quote, CarbonImmutable $today, User $actor): void
    {
        if (! $quote->opportunity_id) {
            return;
        }

        $opportunity = DB::table('crm_opportunities')->where('id', $quote->opportunity_id)->lockForUpdate()->first(['id', 'code', 'stage']);
        if (! $opportunity || $opportunity->stage === 'ganada') {
            return;
        }

        DB::table('crm_opportunities')->where('id', $opportunity->id)->update(['stage' => 'ganada', 'probability' => 100, 'closed_at' => $today->toDateString(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Oportunidad', $opportunity->code, 'cambio_etapa', $opportunity->stage, 'ganada');
    }

    private function channelFor(string $clientId): string
    {
        return match (mb_strtolower((string) DB::table('crm_clients')->where('id', $clientId)->value('segment_code'))) {
            'corporativo', 'grupos' => 'Corporativo',
            'b2b', 'agencia aliada' => 'B2B',
            default => 'Directo',
        };
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->tenant()->timezone ?: 'America/Lima')->startOfDay();
    }
}
