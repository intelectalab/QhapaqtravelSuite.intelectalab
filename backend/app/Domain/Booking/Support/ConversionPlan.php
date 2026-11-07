<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ConversionPlan
{
    public const DEPOSIT_PCT = '0.40';

    public function __construct(private readonly TenantContext $context) {}

    public function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->timezone())->startOfDay();
    }

    public function preview(Quote $quote): array
    {
        $today = $this->today();
        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first();
        $items = $version ? $this->items((string) $version->id) : collect();
        $products = $this->products($items);
        $departures = $this->departures($items, $products, $today);
        $total = Decimal::round2((string) ($version->grand_total ?? '0'));

        return [
            'code' => $quote->code,
            'status' => $quote->status,
            'reservation' => $quote->reservation_id ? DB::table('booking_reservations')->where('id', $quote->reservation_id)->value('code') : null,
            'currency' => $version->currency ?? $quote->currency,
            'total' => (string) $total,
            'pax' => $quote->paxTotal(),
            'receivables' => array_map(fn (array $row): array => [
                'concept' => $row['concept'],
                'amount' => (string) $row['amount'],
                'due' => $row['due']->toDateString(),
            ], $this->receivables($total, $quote->travel_from, $today)),
            'items' => $items->map(fn (object $item): array => $this->availability($item, $products->get($item->product_id), $departures[$item->id] ?? null))->values()->all(),
        ];
    }

    public function items(string $versionId): Collection
    {
        return DB::table('quote_items')->where('quote_version_id', $versionId)->orderBy('line_no')->get();
    }

    public function products(Collection $items): Collection
    {
        return DB::table('catalog_products')->whereIn('id', $items->pluck('product_id')->unique()->values()->all())
            ->get(['id', 'code', 'name', 'status', 'availability_model', 'main_provider_id'])->keyBy('id');
    }

    public function departures(Collection $items, Collection $products, CarbonImmutable $today): array
    {
        $map = [];

        foreach ($items as $item) {
            $map[$item->id] = $products->get($item->product_id)?->availability_model === 'POR_SALIDA'
                ? DB::table('catalog_product_departures')
                    ->where('product_id', $item->product_id)
                    ->where('departure_date', $item->service_date)
                    ->where('departure_date', '>=', $today->toDateString())
                    ->whereNotIn('status', ['cerrada', 'cancelada'])
                    ->value('id')
                : null;
        }

        return $map;
    }

    public function assertAvailable(Collection $items, Collection $products, array $departureByItem, array $departures): void
    {
        $needed = [];

        foreach ($items as $item) {
            $product = $products->get($item->product_id);

            if ($product === null || $product->status !== 'ACTIVE') {
                throw ApiException::unprocessable('PRD-BR-002', 'El producto '.($product->name ?? '').' ya no está activo. Crea una nueva versión sin él.');
            }

            if ($product->availability_model !== 'POR_SALIDA') {
                continue;
            }

            $departureId = $departureByItem[$item->id] ?? null;
            if ($departureId === null) {
                throw $this->noAvailability($item, "{$product->name} no tiene salida programada el {$item->service_date}.");
            }

            $needed[$departureId] = ($needed[$departureId] ?? 0) + (int) $item->pax;
            $departure = $departures[$departureId];

            if ((int) $departure->capacity - (int) $departure->sold < $needed[$departureId]) {
                throw $this->noAvailability($item, "La salida {$departure->ref} de {$product->name} no tiene {$needed[$departureId]} cupos libres.");
            }
        }
    }

    public function receivables(BigDecimal $total, DateTimeInterface $travelFrom, CarbonImmutable $today): array
    {
        $deposit = Decimal::round2($total->multipliedBy(self::DEPOSIT_PCT));
        $from = CarbonImmutable::parse($travelFrom->format('Y-m-d'), $today->getTimezone())->startOfDay();

        return [
            ['kind' => 'anticipo', 'concept' => 'Anticipo 40%', 'amount' => $deposit, 'due' => $today->addDays(3)->min($from->max($today))],
            ['kind' => 'saldo', 'concept' => 'Saldo 60%', 'amount' => $total->minus($deposit), 'due' => $from->subDays(15)->max($today)],
        ];
    }

    private function availability(object $item, ?object $product, ?string $departureId): array
    {
        $base = ['line' => (int) $item->line_no, 'product' => $product->name ?? '', 'date' => $item->service_date, 'pax' => (int) $item->pax];

        if ($product === null || $product->status !== 'ACTIVE') {
            return [...$base, 'ok' => false, 'note' => 'El producto ya no está activo.'];
        }

        if ($product->availability_model !== 'POR_SALIDA') {
            return [...$base, 'ok' => true, 'note' => 'Se pide al proveedor y queda sujeto a su confirmación.'];
        }

        $departure = $departureId ? DB::table('catalog_product_departures')->where('id', $departureId)->first(['ref', 'capacity', 'sold']) : null;
        if ($departure === null) {
            return [...$base, 'ok' => false, 'note' => 'No hay salida programada en esa fecha.'];
        }

        $free = (int) $departure->capacity - (int) $departure->sold;

        return [...$base, 'ok' => $free >= (int) $item->pax, 'note' => $free >= (int) $item->pax ? "Salida {$departure->ref}: quedan {$free} cupos." : "Salida {$departure->ref}: solo quedan {$free} cupos."];
    }

    private function noAvailability(object $item, string $message): ApiException
    {
        $alternatives = DB::table('catalog_product_departures')
            ->where('product_id', $item->product_id)
            ->where('departure_date', '>=', $this->today()->toDateString())
            ->whereNotIn('status', ['cerrada', 'cancelada', 'completa'])
            ->whereRaw('capacity - sold >= ?', [(int) $item->pax])
            ->orderBy('departure_date')
            ->limit(5)
            ->get(['ref', 'departure_date', DB::raw('capacity - sold as available')]);

        return ApiException::conflict('RT-4', $message.' No se convierte a medias: crea una nueva versión con otra fecha.', [
            'quote_item_id' => $item->id,
            'alternatives' => $alternatives,
        ]);
    }
}
