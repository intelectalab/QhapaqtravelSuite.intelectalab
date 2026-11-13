<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\TripCatalog;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class TripCatalogEditor
{
    public function __construct(
        private readonly ProductSections $sections,
        private readonly TripCatalog $trip,
        private readonly AuditLogger $audit,
        private readonly CodeSequence $codes,
    ) {}

    public function nights(string $code, ?int $version, string $leg, ?int $min, ?int $max, User $actor): array
    {
        $result = [];
        $this->sections->edit($code, $version, $actor, function (stdClass $product) use ($leg, $min, $max, $actor, &$result): void {
            $current = $this->leg($product->id, $leg);
            if (($min === null) !== ($max === null)) {
                throw ApiException::unprocessable('TB-02', 'Indica el mínimo y el máximo de noches, o deja ambos vacíos para noches fijas.', ['min_nights' => ['Indica el mínimo y el máximo juntos.']]);
            }
            if ($min !== null && ($min > (int) $current->nights || $max < (int) $current->nights)) {
                throw ApiException::unprocessable('TB-02', "Las noches por defecto ({$current->nights}) deben quedar entre el mínimo y el máximo.", ['min_nights' => ["El rango debe incluir las {$current->nights} noche(s) del tramo."]]);
            }
            DB::table('catalog_accommodation_legs')->where('id', $current->id)->update(['min_nights' => $min, 'max_nights' => $max, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->log($product->code, 'tramo_noches', $current->city.' · '.$this->range($current->min_nights, $current->max_nights, (int) $current->nights), $current->city.' · '.$this->range($min, $max, (int) $current->nights));
            $result = (array) DB::table('catalog_accommodation_legs')->where('id', $current->id)->first(['id', 'code', 'product_id', 'sequence', 'city', 'destination_id', 'nights', 'min_nights', 'max_nights', 'updated_at']);
        });

        return $result;
    }

    public function createSeason(string $hotelId, array $data, User $actor): array
    {
        $hotel = $this->trip->hotel($hotelId);
        $id = (string) Str::uuid7();
        $this->sections->edit($hotel->product_code, null, $actor, function () use ($hotel, $data, $actor, $id): void {
            $overlap = DB::table('catalog_hotel_season_rates')->where('hotel_id', $hotel->id)->where('date_from', '<=', $data['date_to'])->where('date_to', '>=', $data['date_from'])->first(['label', 'date_from', 'date_to']);
            if ($overlap !== null) {
                throw $this->overlap($overlap->label);
            }
            try {
                DB::table('catalog_hotel_season_rates')->insert(['id' => $id, 'hotel_id' => $hotel->id, 'label' => trim($data['label']), 'date_from' => $data['date_from'], 'date_to' => $data['date_to'], 'adjust_pct' => (string) $data['adjust_pct'], 'created_by' => $actor->getKey()]);
            } catch (QueryException $e) {
                if (($e->errorInfo[0] ?? null) === '23P01') {
                    throw $this->overlap(null);
                }
                throw $e;
            }
            $this->log($hotel->product_code, 'temporada_hotel_crear', null, "{$hotel->city} · {$hotel->name} · {$data['label']} {$data['date_from']} a {$data['date_to']} · {$data['adjust_pct']} %");
        });

        return TripCatalog::seasonRate(DB::table('catalog_hotel_season_rates')->where('id', $id)->first());
    }

    public function deleteSeason(string $hotelId, string $id, User $actor): void
    {
        $hotel = $this->trip->hotel($hotelId);
        $rate = Str::isUuid($id) ? DB::table('catalog_hotel_season_rates')->where('hotel_id', $hotel->id)->where('id', $id)->first() : null;
        if ($rate === null) {
            throw ApiException::notFound('La temporada no existe.');
        }
        $this->sections->edit($hotel->product_code, null, $actor, function () use ($hotel, $rate): void {
            DB::table('catalog_hotel_season_rates')->where('id', $rate->id)->delete();
            $this->log($hotel->product_code, 'temporada_hotel_eliminar', "{$hotel->city} · {$hotel->name} · {$rate->label} {$rate->date_from} a {$rate->date_to} · {$rate->adjust_pct} %", null);
        });
    }

    public function createTour(string $code, array $data, User $actor): array
    {
        $id = (string) Str::uuid7();
        $this->sections->edit($code, null, $actor, function (stdClass $product) use ($data, $actor, $id): void {
            $leg = $this->leg($product->id, (string) $data['leg_id']);
            $this->ensureProvider($data['provider_id'] ?? null);
            $tourCode = isset($data['code']) && trim((string) $data['code']) !== '' ? Str::upper(trim((string) $data['code'])) : $this->codes->next('catalog_leg_tours', 'TT-', 3);
            $this->ensureTourCode($product->id, $tourCode, null);
            DB::table('catalog_leg_tours')->insert([...$this->tourValues($data, null), 'id' => $id, 'leg_id' => $leg->id, 'code' => $tourCode, 'created_by' => $actor->getKey()]);
            $this->log($product->code, 'tour_tramo_crear', null, "{$tourCode} · {$leg->city} · {$data['name']}");
        });

        return $this->tourView($id);
    }

    public function updateTour(string $code, string $tour, array $data, User $actor): array
    {
        $id = '';
        $this->sections->edit($code, null, $actor, function (stdClass $product) use ($tour, $data, &$id): void {
            $current = DB::table('catalog_leg_tours as t')->join('catalog_accommodation_legs as l', 'l.id', '=', 't.leg_id')->where('l.product_id', $product->id)
                ->where(Str::isUuid($tour) ? 't.id' : 't.code', $tour)->first(['t.*', 'l.city'])
                ?? throw ApiException::notFound('El tour no existe en este producto.');
            $id = $current->id;
            $legId = $current->leg_id;
            if (isset($data['leg_id'])) {
                $legId = $this->leg($product->id, (string) $data['leg_id'])->id;
            }
            if (array_key_exists('provider_id', $data)) {
                $this->ensureProvider($data['provider_id']);
            }
            if (isset($data['code'])) {
                $this->ensureTourCode($product->id, Str::upper(trim((string) $data['code'])), $current->id);
            }
            DB::table('catalog_leg_tours')->where('id', $current->id)->update([...$this->tourValues($data, $current), 'leg_id' => $legId, 'code' => isset($data['code']) ? Str::upper(trim((string) $data['code'])) : $current->code, 'updated_at' => now()]);
            $after = DB::table('catalog_leg_tours')->where('id', $current->id)->first();
            $this->log($product->code, ! (bool) $after->active && (bool) $current->active ? 'tour_tramo_desactivar' : 'tour_tramo_modificar', $this->describeTour($current), $this->describeTour($after));
        });

        return $this->tourView($id);
    }

    public function createTransport(string $code, array $data, User $actor): array
    {
        $id = (string) Str::uuid7();
        $this->sections->edit($code, null, $actor, function (stdClass $product) use ($data, $actor, $id): void {
            $from = $this->leg($product->id, (string) $data['from_leg_id']);
            $to = isset($data['to_leg_id']) ? $this->leg($product->id, (string) $data['to_leg_id']) : null;
            $values = $this->optionValues($data, null, $from->id, $to?->id);
            $this->ensureProvider($data['provider_id'] ?? null);
            $optionCode = isset($data['code']) && trim((string) $data['code']) !== '' ? Str::upper(trim((string) $data['code'])) : $this->codes->next('catalog_transport_options', 'TR-', 3);
            if (DB::table('catalog_transport_options')->where('product_id', $product->id)->where('code', $optionCode)->exists()) {
                throw ApiException::conflict('TB-06', "Ya existe una opción de movilidad con el código {$optionCode}.");
            }
            DB::table('catalog_transport_options')->insert([...$values, 'id' => $id, 'product_id' => $product->id, 'code' => $optionCode, 'created_by' => $actor->getKey()]);
            $this->syncVehicles($id, $values['pricing'], $data['vehicles'] ?? []);
            $this->log($product->code, 'movilidad_crear', null, "{$optionCode} · {$data['name']} · ".($values['pricing'] === 'vehiculo' ? 'por vehículo' : 'por pasajero'));
        });

        return $this->optionView($id);
    }

    public function updateTransport(string $code, string $option, array $data, User $actor): array
    {
        $id = '';
        $this->sections->edit($code, null, $actor, function (stdClass $product) use ($option, $data, &$id): void {
            $current = DB::table('catalog_transport_options')->where('product_id', $product->id)->where(Str::isUuid($option) ? 'id' : 'code', $option)->first()
                ?? throw ApiException::notFound('La opción de movilidad no existe en este producto.');
            $id = $current->id;
            $from = isset($data['from_leg_id']) ? $this->leg($product->id, (string) $data['from_leg_id'])->id : $current->from_leg_id;
            $to = array_key_exists('to_leg_id', $data) ? ($data['to_leg_id'] === null ? null : $this->leg($product->id, (string) $data['to_leg_id'])->id) : $current->to_leg_id;
            if (array_key_exists('provider_id', $data)) {
                $this->ensureProvider($data['provider_id']);
            }
            $values = $this->optionValues($data, $current, $from, $to);
            DB::table('catalog_transport_options')->where('id', $current->id)->update([...$values, 'updated_at' => now()]);
            if (array_key_exists('vehicles', $data) || $values['pricing'] !== $current->pricing) {
                $this->syncVehicles($current->id, $values['pricing'], (array) ($data['vehicles'] ?? []));
            }
            $after = DB::table('catalog_transport_options')->where('id', $current->id)->first();
            $this->log($product->code, ! (bool) $after->active && (bool) $current->active ? 'movilidad_desactivar' : 'movilidad_modificar', $this->describeOption($current), $this->describeOption($after));
        });

        return $this->optionView($id);
    }

    private function tourValues(array $data, ?stdClass $current): array
    {
        $pick = fn (string $key, mixed $fallback): mixed => array_key_exists($key, $data) ? $data[$key] : $fallback;

        return [
            'name' => trim((string) $pick('name', $current->name ?? '')),
            'day_offset' => (int) $pick('day_offset', $current->day_offset ?? 0),
            'start_time' => (string) $pick('start_time', isset($current->start_time) ? substr((string) $current->start_time, 0, 5) : '09:00'),
            'duration_hours' => (string) $pick('duration_hours', $current->duration_hours ?? 1),
            'currency' => Str::upper((string) $pick('currency', $current->currency ?? 'USD')),
            'price_adult' => (string) $pick('price_adult', $current->price_adult ?? 0),
            'price_child' => (string) ($pick('price_child', $current->price_child ?? 0) ?? 0),
            'min_age' => $pick('min_age', $current->min_age ?? null),
            'capacity' => $pick('capacity', $current->capacity ?? null),
            'provider_id' => $pick('provider_id', $current->provider_id ?? null),
            'in_trip_sale' => (bool) $pick('in_trip_sale', $current->in_trip_sale ?? true),
            'active' => (bool) $pick('active', $current->active ?? true),
        ];
    }

    private function optionValues(array $data, ?stdClass $current, string $from, ?string $to): array
    {
        $pick = fn (string $key, mixed $fallback): mixed => array_key_exists($key, $data) ? $data[$key] : $fallback;
        $pricing = (string) $pick('pricing', $current->pricing ?? 'pax');
        $mode = (string) $pick('mode', $current->mode ?? ($to === null ? 'movilidad' : 'bus'));
        if ($to !== null && $to === $from) {
            throw ApiException::unprocessable('TB-06', 'El origen y el destino deben ser ciudades distintas.', ['to_leg_id' => ['Elige otra ciudad de destino.']]);
        }
        if ($to === null && ! in_array($mode, ['traslado', 'movilidad'], true)) {
            throw ApiException::unprocessable('TB-06', 'La movilidad local es traslado o movilidad por día; para vuelo, bus o tren elige la ciudad de destino.', ['to_leg_id' => ['Elige la ciudad de destino.']]);
        }
        $adult = $pricing === 'pax' ? $pick('price_adult', $current->price_adult ?? null) : null;
        if ($pricing === 'pax' && ($adult === null || $adult === '')) {
            throw ApiException::unprocessable('TB-05', 'Indica el precio por adulto de la movilidad por pasajero.', ['price_adult' => ['Indica el precio por adulto.']]);
        }

        return [
            'from_leg_id' => $from,
            'to_leg_id' => $to,
            'mode' => $mode,
            'name' => trim((string) $pick('name', $current->name ?? '')),
            'pricing' => $pricing,
            'currency' => Str::upper((string) $pick('currency', $current->currency ?? 'USD')),
            'price_adult' => $adult === null ? null : (string) $adult,
            'price_child' => $pricing === 'pax' && $pick('price_child', $current->price_child ?? null) !== null ? (string) $pick('price_child', $current->price_child ?? null) : null,
            'duration_hours' => $pick('duration_hours', $current->duration_hours ?? null),
            'provider_id' => $pick('provider_id', $current->provider_id ?? null),
            'in_trip_sale' => (bool) $pick('in_trip_sale', $current->in_trip_sale ?? true),
            'active' => (bool) $pick('active', $current->active ?? true),
        ];
    }

    private function syncVehicles(string $optionId, string $pricing, array $vehicles): void
    {
        $vehicles = $pricing === 'vehiculo' ? array_values($vehicles) : [];
        if ($pricing === 'vehiculo' && $vehicles === []) {
            throw ApiException::unprocessable('TB-05', 'La movilidad por vehículo necesita al menos un vehículo con su capacidad y precio.', ['vehicles' => ['Agrega al menos un vehículo.']]);
        }
        $names = array_map(fn (array $v): string => mb_strtolower(trim((string) $v['name'])), $vehicles);
        if (count($names) !== count(array_unique($names))) {
            throw ApiException::unprocessable('TB-05', 'Cada vehículo va una sola vez por opción.', ['vehicles' => ['Hay vehículos repetidos.']]);
        }
        $existing = DB::table('catalog_transport_vehicles')->where('option_id', $optionId)->get()->keyBy(fn (stdClass $v): string => mb_strtolower($v->name));
        $keep = [];
        foreach ($vehicles as $vehicle) {
            $key = mb_strtolower(trim((string) $vehicle['name']));
            $values = ['name' => trim((string) $vehicle['name']), 'max_pax' => (int) $vehicle['max_pax'], 'price' => (string) $vehicle['price'], 'updated_at' => now()];
            if ($existing->has($key)) {
                DB::table('catalog_transport_vehicles')->where('id', $existing[$key]->id)->update($values);
                $keep[] = $existing[$key]->id;
            } else {
                $id = (string) Str::uuid7();
                DB::table('catalog_transport_vehicles')->insert([...$values, 'id' => $id, 'option_id' => $optionId]);
                $keep[] = $id;
            }
        }
        $drop = $existing->pluck('id')->diff($keep)->values()->all();
        if ($drop !== [] && DB::table('booking_trip_items')->whereIn('vehicle_id', $drop)->exists()) {
            throw ApiException::conflict('TB-05', 'Ese vehículo ya se vendió en reservas: cambia su precio en lugar de quitarlo.');
        }
        DB::table('catalog_transport_vehicles')->whereIn('id', $drop)->delete();
    }

    private function leg(string $productId, string $leg): stdClass
    {
        return DB::table('catalog_accommodation_legs')->where('product_id', $productId)->where(Str::isUuid($leg) ? 'id' : 'code', $leg)->first()
            ?? throw ApiException::notFound('El tramo no existe en este producto.');
    }

    private function ensureProvider(mixed $providerId): void
    {
        if ($providerId !== null && (! Str::isUuid((string) $providerId) || ! DB::table('catalog_providers')->where('id', $providerId)->whereNull('deleted_at')->exists())) {
            throw ApiException::unprocessable('VALIDATION', 'Elige un proveedor del catálogo.', ['provider_id' => ['Elige un proveedor del catálogo.']]);
        }
    }

    private function ensureTourCode(string $productId, string $code, ?string $exceptId): void
    {
        $exists = DB::table('catalog_leg_tours as t')->join('catalog_accommodation_legs as l', 'l.id', '=', 't.leg_id')->where('l.product_id', $productId)->where('t.code', $code)
            ->when($exceptId !== null, fn ($q) => $q->where('t.id', '<>', $exceptId))->exists();
        if ($exists) {
            throw ApiException::conflict('TB-04', "Ya existe un tour con el código {$code} en este circuito.");
        }
    }

    private function tourView(string $id): array
    {
        $tour = DB::table('catalog_leg_tours as t')->join('catalog_accommodation_legs as l', 'l.id', '=', 't.leg_id')->leftJoin('catalog_providers as pr', 'pr.id', '=', 't.provider_id')
            ->where('t.id', $id)->first(['t.*', 'l.city', 'pr.name as provider_name']);

        return TripCatalog::tour($tour, $tour->city);
    }

    private function optionView(string $id): array
    {
        $option = DB::table('catalog_transport_options as o')->leftJoin('catalog_providers as pr', 'pr.id', '=', 'o.provider_id')->where('o.id', $id)->first(['o.*', 'pr.name as provider_name']);
        $option->vehicles = DB::table('catalog_transport_vehicles')->where('option_id', $id)->orderBy('max_pax')->get()->all();
        $cities = DB::table('catalog_accommodation_legs')->whereIn('id', array_filter([$option->from_leg_id, $option->to_leg_id]))->pluck('city', 'id')->all();

        return TripCatalog::option($option, $cities);
    }

    private function overlap(?string $label): ApiException
    {
        return ApiException::conflict('TB-03', $label === null ? 'Las fechas se cruzan con otra temporada del hotel.' : "Las fechas se cruzan con la temporada «{$label}» del hotel.");
    }

    private function range(mixed $min, mixed $max, int $nights): string
    {
        return $min === null ? "{$nights} noche(s) fijas" : "{$min} a {$max} noches (por defecto {$nights})";
    }

    private function describeTour(stdClass $tour): string
    {
        return "{$tour->code} · {$tour->name} · día {$tour->day_offset} ".substr((string) $tour->start_time, 0, 5)." · {$tour->currency} {$tour->price_adult}/{$tour->price_child}".($tour->active ? '' : ' · inactivo');
    }

    private function describeOption(stdClass $option): string
    {
        return "{$option->code} · {$option->name} · {$option->pricing}".($option->price_adult !== null ? " · {$option->currency} {$option->price_adult}" : '').($option->active ? '' : ' · inactiva');
    }

    private function log(string $product, string $action, ?string $before, ?string $after): void
    {
        $this->audit->log('Producto', $product, $action, $before === null ? null : mb_substr($before, 0, 500), $after === null ? null : mb_substr($after, 0, 500));
    }
}
