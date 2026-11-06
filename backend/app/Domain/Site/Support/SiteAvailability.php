<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SiteAvailability
{
    public const LABELS = [
        'disponible' => 'Disponible',
        'pocos' => 'Últimos cupos',
        'agotado' => 'Agotado',
        'sin_cupo' => 'Sin cupo para tu grupo',
        'cerrado' => 'Sin operación',
        'fuera_plazo' => 'Fuera de plazo',
        'no_opera' => 'Sin salida',
        'sin_tarifa' => 'Tarifa por publicar',
        'pasado' => 'Fecha pasada',
    ];

    private array $departures = [];

    private array $ranges = [];

    private array $holds = [];

    public function __construct(private readonly SitePricing $pricing) {}

    public function pricing(): SitePricing
    {
        return $this->pricing;
    }

    public function load(array $productIds, string $from, string $to): void
    {
        $missing = array_values(array_diff($productIds, array_keys($this->departures)));

        if ($missing === []) {
            return;
        }

        $departures = DB::table('catalog_product_departures')->whereIn('product_id', $missing)->where('status', '<>', 'cancelada')
            ->where('departure_date', '>=', $from)->where('departure_date', '<=', $to)
            ->orderBy('departure_date')->orderBy('departure_time')
            ->get(['id', 'ref', 'product_id', 'departure_date', 'departure_time', 'capacity', 'sold', 'status', 'meeting_point']);
        $ranges = DB::table('catalog_availability_ranges')->whereIn('product_id', $missing)->whereNull('deleted_at')
            ->where('date_to', '>=', $from)->where('date_from', '<=', $to)
            ->get(['product_id', 'date_from', 'date_to', 'status', 'capacity_per_day', 'note']);
        $holds = DB::table('catalog_availability_holds')->where('status', 'hold')->where('expires_at', '>', now())
            ->where(fn ($q) => $q->whereIn('departure_id', $departures->pluck('id'))->orWhereIn('product_id', $missing))
            ->get(['departure_id', 'product_id', 'service_date', 'quantity']);
        $everDepartures = DB::table('catalog_product_departures')->whereIn('product_id', $missing)->distinct()->pluck('product_id')->all();

        foreach ($missing as $id) {
            $this->departures[$id] = in_array($id, $everDepartures, true) ? $departures->where('product_id', $id)->values() : null;
            $this->ranges[$id] = $ranges->where('product_id', $id)->values();
        }

        foreach ($holds as $hold) {
            $key = $hold->departure_id ?: "{$hold->product_id}|{$hold->service_date}";
            $this->holds[$key] = ($this->holds[$key] ?? 0) + (int) $hold->quantity;
        }
    }

    public function departures(string $productId): Collection
    {
        return ($this->departures[$productId] ?? null) ?? collect();
    }

    public function usesDepartures(string $productId): bool
    {
        return ($this->departures[$productId] ?? null) !== null;
    }

    public function free(stdClass $departure): int
    {
        return max(0, (int) $departure->capacity - (int) $departure->sold - ($this->holds[$departure->id] ?? 0));
    }

    public function day(stdClass $product, string $date, int $seats, Carbon $today): array
    {
        $ahead = (int) round($today->diffInDays(Carbon::parse($date, $today->getTimezone()), false));
        $quote = $this->pricing->quote($product->id, $date);
        $result = ['date' => $date, 'status' => 'disponible', 'spots' => null, 'departure' => null, 'note' => null, 'price' => $quote];

        if ($ahead < 0) {
            return ['status' => 'pasado', 'price' => null] + $result;
        }

        if ($ahead < (int) $product->booking_advance_min_days || $ahead > (int) $product->booking_advance_max_days) {
            return ['status' => 'fuera_plazo', 'note' => "Reserva con al menos {$product->booking_advance_min_days} días de anticipación."] + $result;
        }

        $weekdays = array_map('intval', explode(',', trim((string) $product->operating_weekdays, '{}')));

        if (! in_array(Carbon::parse($date)->dayOfWeek, $weekdays, true)) {
            return ['status' => 'no_opera', 'note' => 'No opera este día de la semana.'] + $result;
        }

        if ($this->usesDepartures($product->id)) {
            $departure = $this->departures($product->id)->firstWhere('departure_date', $date);

            if ($departure === null) {
                return ['status' => 'no_opera', 'note' => 'Sin salida programada.'] + $result;
            }

            $free = $departure->status === 'abierta' ? $this->free($departure) : 0;
            $status = match (true) {
                $free <= 0 => 'agotado',
                $free < $seats => 'sin_cupo',
                $free <= 4 => 'pocos',
                default => 'disponible',
            };
            $result = ['status' => $status, 'spots' => $free, 'departure' => $this->departure($departure, $product)] + $result;
        } else {
            $range = $this->ranges[$product->id]->first(fn (stdClass $r): bool => $r->date_from <= $date && $r->date_to >= $date && $r->status !== 'disponible')
                ?? $this->ranges[$product->id]->first(fn (stdClass $r): bool => $r->date_from <= $date && $r->date_to >= $date);

            if ($range === null && $this->ranges[$product->id]->isNotEmpty()) {
                return ['status' => 'no_opera', 'note' => 'Sin programación para esta fecha.'] + $result;
            }

            if ($range !== null && $range->status !== 'disponible') {
                return ['status' => $range->status === 'agotado' ? 'agotado' : 'cerrado', 'note' => $range->note] + $result;
            }

            if ($range !== null) {
                $free = max(0, (int) $range->capacity_per_day - ($this->holds["{$product->id}|{$date}"] ?? 0));
                $result = ['status' => $free < $seats ? 'sin_cupo' : ($free <= 4 ? 'pocos' : 'disponible'), 'spots' => $free] + $result;
            }
        }

        if ($quote === null) {
            return ['status' => 'sin_tarifa', 'note' => 'Tarifa por publicar para esta fecha.'] + $result;
        }

        return $result;
    }

    public function sellable(array $day): bool
    {
        return in_array($day['status'], ['disponible', 'pocos'], true);
    }

    public function departure(stdClass $departure, stdClass $product): array
    {
        $free = $this->free($departure);

        return [
            'ref' => $departure->ref,
            'date' => $departure->departure_date,
            'time' => substr((string) $departure->departure_time, 0, 5),
            'capacity' => (int) $departure->capacity,
            'sold' => (int) $departure->sold,
            'spots' => $departure->status === 'abierta' ? $free : 0,
            'guaranteed' => (int) $departure->sold >= max(2, (int) $product->minimum_passengers),
            'meeting_point' => $departure->meeting_point,
            'status' => $departure->status,
        ];
    }
}
