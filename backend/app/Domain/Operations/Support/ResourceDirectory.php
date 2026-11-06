<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ResourceDirectory
{
    public const LANGUAGES = ['ES' => 'Español', 'EN' => 'Inglés', 'QU' => 'Quechua', 'DE' => 'Alemán', 'FR' => 'Francés', 'PT' => 'Portugués', 'IT' => 'Italiano'];

    public const PERSON_STATUS = ['disponible', 'asignado', 'descanso', 'vacaciones'];

    public const VEHICLE_STATUS = ['disponible', 'asignado', 'mantenimiento'];

    public function __construct(private readonly OpsCommon $common) {}

    public function overview(User $viewer): array
    {
        $today = $this->common->today();
        $limit = $this->common->now()->addDays(30)->toDateString();
        $assignments = $this->assignments();
        $upcoming = $assignments->filter(fn (array $row) => $row['date'] >= $today && $row['status'] !== 'completada' && $row['order_status'] !== 'cancelada');
        $count = fn (string $key, string $id) => $upcoming->filter(fn (array $row) => ($row[$key]['id'] ?? null) === $id)->sortBy(fn (array $row) => $row['date'].($row['time'] ?? ''))->values();
        $providers = DB::table('catalog_providers')->pluck('name', 'id');

        $guides = DB::table('ops_guides')->whereNull('deleted_at')->orderBy('code')->get()->map(function (object $guide) use ($count, $providers): array {
            $agenda = $count('guide', $guide->id);

            return [
                'id' => $guide->id,
                'code' => $guide->code,
                'name' => $guide->full_name,
                'languages' => $this->languages($guide->languages),
                'license' => $guide->license_number,
                'rating' => $guide->rating !== null ? (float) $guide->rating : null,
                'status' => $guide->status,
                'phone' => $guide->phone,
                'provider' => $guide->provider_id ? ($providers[$guide->provider_id] ?? null) : null,
                'linked' => $guide->user_id !== null,
                'upcoming' => $agenda->count(),
                'next' => $agenda->first(),
            ];
        })->values();

        $drivers = DB::table('ops_drivers')->whereNull('deleted_at')->orderBy('code')->get()->map(function (object $driver) use ($count, $providers, $today, $limit): array {
            $agenda = $count('driver', $driver->id);

            return [
                'id' => $driver->id,
                'code' => $driver->code,
                'name' => $driver->full_name,
                'license' => $driver->license_number,
                'license_class' => $driver->license_class,
                'expires_on' => $driver->license_expires_on,
                'document' => $this->documentState($driver->license_expires_on, $today, $limit),
                'status' => $driver->status,
                'phone' => $driver->phone,
                'provider' => $driver->provider_id ? ($providers[$driver->provider_id] ?? null) : null,
                'linked' => $driver->user_id !== null,
                'upcoming' => $agenda->count(),
                'next' => $agenda->first(),
            ];
        })->values();

        $vehicles = DB::table('ops_vehicles')->whereNull('deleted_at')->orderBy('plate')->get()->map(function (object $vehicle) use ($count, $providers, $today, $limit): array {
            $agenda = $count('vehicle', $vehicle->id);

            return [
                'id' => $vehicle->id,
                'plate' => $vehicle->plate,
                'type' => $vehicle->vehicle_type,
                'capacity' => (int) $vehicle->capacity,
                'soat_expires_on' => $vehicle->soat_expires_on,
                'document' => $this->documentState($vehicle->soat_expires_on, $today, $limit),
                'status' => $vehicle->status,
                'provider_id' => $vehicle->provider_id,
                'provider' => $vehicle->provider_id ? ($providers[$vehicle->provider_id] ?? null) : null,
                'upcoming' => $agenda->count(),
                'next' => $agenda->first(),
            ];
        })->values();

        return [
            'today' => $today,
            'can' => ['assign' => $viewer->can('operations.assign')],
            'guides' => $guides,
            'drivers' => $drivers,
            'vehicles' => $vehicles,
            'assignments' => $assignments->filter(fn (array $row) => $row['order_status'] !== 'cancelada')->values(),
            'languages' => collect(self::LANGUAGES)->map(fn (string $label, string $code) => ['value' => $code, 'label' => $label])->values(),
            'carriers' => DB::table('catalog_providers')->whereNull('deleted_at')->where('type', 'Transporte')->orderBy('name')->get(['id', 'name']),
            'options' => $viewer->can('operations.assign') ? $this->options() : null,
        ];
    }

    public function assignments(array $where = []): Collection
    {
        $query = DB::table('ops_assignments as a')
            ->join('ops_orders as o', 'o.id', '=', 'a.order_id')
            ->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')
            ->join('booking_reservation_services as s', 's.id', '=', 'a.reservation_service_id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->whereNull('o.deleted_at');

        foreach ($where as $column => $value) {
            $query->where($column, $value);
        }

        $rows = $query->orderBy('a.service_date')->orderBy('a.service_time')->get([
            'a.id', 'a.status', 'a.service_date', 'a.service_time', 'a.service_label', 'a.first_checkin_at', 'a.confirmed_at', 'a.warnings_ack',
            'o.code as order_code', 'o.status as order_status', 'o.title as order_title', 'r.id as reservation_id', 'r.code as reservation_code',
            's.code as service_code', 's.service_kind', 's.status as service_status',
            'g.id as guide_id', 'g.full_name as guide_name', 'd.id as driver_id', 'd.full_name as driver_name', 'v.id as vehicle_id', 'v.plate as vehicle_plate', 'v.vehicle_type', 'v.capacity as vehicle_capacity',
        ]);
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $rows->pluck('reservation_id')->unique())->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');

        return $rows->map(fn (object $row): array => [
            'id' => $row->id,
            'status' => $row->status,
            'date' => $row->service_date,
            'time' => OpsCommon::time($row->service_time),
            'label' => $row->service_label,
            'kind' => $row->service_kind,
            'service_code' => $row->service_code,
            'service_status' => $row->service_status,
            'order_code' => $row->order_code,
            'order_status' => $row->order_status,
            'order_title' => $row->order_title,
            'reservation_code' => $row->reservation_code,
            'passengers' => (int) ($passengers[$row->reservation_id] ?? 0),
            'checkin_at' => $row->first_checkin_at,
            'confirmed_at' => $row->confirmed_at,
            'guide' => $row->guide_id ? ['id' => $row->guide_id, 'name' => $row->guide_name] : null,
            'driver' => $row->driver_id ? ['id' => $row->driver_id, 'name' => $row->driver_name] : null,
            'vehicle' => $row->vehicle_id ? ['id' => $row->vehicle_id, 'name' => "{$row->vehicle_plate} · {$row->vehicle_type}", 'capacity' => (int) $row->vehicle_capacity] : null,
        ])->values();
    }

    public function options(): array
    {
        return [
            'guides' => DB::table('ops_guides')->whereNull('deleted_at')->orderBy('full_name')->get(['id', 'full_name', 'status', 'languages'])
                ->map(fn (object $row): array => ['value' => $row->id, 'label' => $row->full_name, 'hint' => implode(' · ', $this->languages($row->languages)).' · '.$row->status])->values(),
            'drivers' => DB::table('ops_drivers')->whereNull('deleted_at')->orderBy('full_name')->get(['id', 'full_name', 'status', 'license_class'])
                ->map(fn (object $row): array => ['value' => $row->id, 'label' => $row->full_name, 'hint' => trim(($row->license_class ?? '').' · '.$row->status, ' ·')])->values(),
            'vehicles' => DB::table('ops_vehicles')->whereNull('deleted_at')->orderBy('plate')->get(['id', 'plate', 'vehicle_type', 'capacity', 'status'])
                ->map(fn (object $row): array => ['value' => $row->id, 'label' => "{$row->plate} · {$row->vehicle_type}", 'hint' => "{$row->capacity} plazas · {$row->status}"])->values(),
        ];
    }

    public function languages(?string $raw): array
    {
        return array_values(array_filter(array_map('trim', explode(',', trim((string) $raw, '{}')))));
    }

    private function documentState(?string $date, string $today, string $limit): string
    {
        return match (true) {
            $date === null => 'sin_dato',
            $date < $today => 'vencido',
            $date <= $limit => 'por_vencer',
            default => 'vigente',
        };
    }
}
