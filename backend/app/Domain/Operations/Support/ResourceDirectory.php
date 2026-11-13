<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\ResourceCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ResourceDirectory
{
    public const LANGUAGES = ['ES' => 'Español', 'EN' => 'Inglés', 'QU' => 'Quechua', 'DE' => 'Alemán', 'FR' => 'Francés', 'PT' => 'Portugués', 'IT' => 'Italiano'];

    public const PERSON_STATUS = ['disponible', 'asignado', 'descanso', 'vacaciones'];

    public const VEHICLE_STATUS = ['disponible', 'asignado', 'mantenimiento'];

    public const DOCUMENT_ALERT_DAYS = 30;

    public const AGENDA_DAYS = 90;

    public function __construct(private readonly OpsCommon $common) {}

    public function overview(User $viewer): array
    {
        $today = $this->common->today();
        $limit = $this->common->now()->addDays(30)->toDateString();
        $assignments = $this->assignments();
        $upcoming = $assignments->filter(fn (array $row) => $row['date'] >= $today && $row['status'] !== 'completada' && $row['order_status'] !== 'cancelada');
        $count = fn (string $key, string $id) => $upcoming->filter(fn (array $row) => ($row[$key]['id'] ?? null) === $id)->sortBy(fn (array $row) => $row['date'].($row['time'] ?? ''))->values();
        $providers = DB::table('catalog_providers')->pluck('name', 'id');
        $users = DB::table('iam_users')->whereNull('deleted_at')->where(fn ($query) => $query->whereNotNull('guide_id')->orWhereNotNull('driver_id'))->get(['id', 'name', 'email', 'status'])->keyBy('id');
        $user = fn (?string $id): ?array => $id !== null && $users->has($id) ? ['id' => $id, 'name' => $users[$id]->name, 'email' => $users[$id]->email, 'status' => $users[$id]->status] : null;

        $guides = DB::table('ops_guides')->whereNull('deleted_at')->orderBy('code')->get()->map(function (object $guide) use ($count, $providers, $user): array {
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
                'user' => $user($guide->user_id),
                'upcoming' => $agenda->count(),
                'next' => $agenda->first(),
            ];
        })->values();

        $drivers = DB::table('ops_drivers')->whereNull('deleted_at')->orderBy('code')->get()->map(function (object $driver) use ($count, $providers, $today, $limit, $user): array {
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
                'user' => $user($driver->user_id),
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
            'departures' => $this->occupations($today, $this->common->now()->addDays(self::AGENDA_DAYS)->toDateString())->where('source', 'departure')
                ->sortBy(fn (array $item): string => $item['date'].($item['time'] ?? ''))->map(fn (array $item): array => collect($item)->except(['source', 'done'])->all())->values(),
            'languages' => collect(self::LANGUAGES)->map(fn (string $label, string $code) => ['value' => $code, 'label' => $label])->values(),
            'carriers' => DB::table('catalog_providers')->whereNull('deleted_at')->where('type', 'Transporte')->orderBy('name')->get(['id', 'name']),
            'options' => $viewer->can('operations.assign') ? $this->options() : null,
            'users' => $viewer->can('operations.assign') ? ['guide' => ResourceCatalog::linkableUsers('guide'), 'driver' => ResourceCatalog::linkableUsers('driver')] : null,
        ];
    }

    public function availability(?string $from): array
    {
        $today = $this->common->today();
        $start = CarbonImmutable::parse($from ?? $today);
        $days = collect(range(0, 6))->map(fn (int $offset) => $start->addDays($offset)->toDateString())->all();
        $occupations = $this->occupations($days[0], $days[6]);

        $groups = [
            ['kind' => 'guide', 'label' => 'Guías', 'rows' => DB::table('ops_guides')->whereNull('deleted_at')->orderBy('full_name')->get()->map(fn (object $row): array => $this->availabilityRow('guide', $row, $row->full_name, implode(' · ', $this->languages($row->languages)).' · '.$row->license_number, null, $days, $occupations))->values()],
            ['kind' => 'driver', 'label' => 'Conductores', 'rows' => DB::table('ops_drivers')->whereNull('deleted_at')->orderBy('full_name')->get()->map(fn (object $row): array => $this->availabilityRow('driver', $row, $row->full_name, trim(($row->license_class ?? '').' '.$row->license_number), $row->license_expires_on, $days, $occupations))->values()],
            ['kind' => 'vehicle', 'label' => 'Vehículos', 'rows' => DB::table('ops_vehicles')->whereNull('deleted_at')->orderBy('plate')->get()->map(fn (object $row): array => $this->availabilityRow('vehicle', $row, "{$row->plate} · {$row->vehicle_type}", "{$row->capacity} plazas", $row->soat_expires_on, $days, $occupations))->values()],
        ];

        return [
            'today' => $today,
            'from' => $days[0],
            'previous' => $start->subDays(7)->toDateString(),
            'next' => $start->addDays(7)->toDateString(),
            'days' => $days,
            'groups' => $groups,
        ];
    }

    public function assignmentList(array $filters): array
    {
        $from = ($filters['from'] ?? null) === 'today' ? $this->common->today() : ($filters['from'] ?? null);
        $incomplete = in_array($filters['incomplete'] ?? null, ['true', '1'], true);
        $resource = $filters['resource'] ?? null;

        return $this->assignments()
            ->when($from !== null, fn (Collection $rows) => $rows->filter(fn (array $row): bool => $row['date'] >= $from))
            ->when($incomplete, fn (Collection $rows) => $rows->filter(fn (array $row): bool => $row['status'] === 'pendiente'))
            ->when($resource !== null, fn (Collection $rows) => $rows->filter(fn (array $row): bool => in_array($resource, [$row['guide']['id'] ?? null, $row['driver']['id'] ?? null, $row['vehicle']['id'] ?? null], true)))
            ->values()
            ->all();
    }

    public function documentAlerts(): array
    {
        $today = $this->common->today();
        $limit = $this->common->now()->addDays(self::DOCUMENT_ALERT_DAYS)->toDateString();
        $rows = [];

        foreach (DB::table('ops_drivers')->whereNull('deleted_at')->whereNotNull('license_expires_on')->where('license_expires_on', '<=', $limit)->get(['id', 'full_name', 'license_expires_on', 'status']) as $driver) {
            $rows[] = $this->alertRow('driver', (string) $driver->id, (string) $driver->full_name, 'Licencia de conducir', (string) $driver->license_expires_on, (string) $driver->status, $today, $limit);
        }

        foreach (DB::table('ops_vehicles')->whereNull('deleted_at')->whereNotNull('soat_expires_on')->where('soat_expires_on', '<=', $limit)->get(['id', 'plate', 'vehicle_type', 'soat_expires_on', 'status']) as $vehicle) {
            $rows[] = $this->alertRow('vehicle', (string) $vehicle->id, "{$vehicle->plate} · {$vehicle->vehicle_type}", 'SOAT', (string) $vehicle->soat_expires_on, (string) $vehicle->status, $today, $limit);
        }

        $items = collect($rows)->sortBy('expires_on')->values();

        return [
            'today' => $today,
            'window_days' => self::DOCUMENT_ALERT_DAYS,
            'counts' => ['expired' => $items->where('state', 'vencido')->count(), 'expiring' => $items->where('state', 'por_vencer')->count()],
            'items' => $items,
        ];
    }

    private function alertRow(string $kind, string $id, string $name, string $document, string $expires, string $status, string $today, string $limit): array
    {
        return [
            'kind' => $kind,
            'id' => $id,
            'name' => $name,
            'document' => $document,
            'expires_on' => $expires,
            'days_left' => (int) CarbonImmutable::parse($today)->diffInDays(CarbonImmutable::parse($expires), false),
            'state' => $this->documentState($expires, $today, $limit),
            'status' => $status,
        ];
    }

    public function agenda(string $kind, string $id): ?array
    {
        $table = ResourceCatalog::TABLES[$kind];
        $resource = Str::isUuid($id) ? DB::table($table)->whereNull('deleted_at')->where('id', $id)->first() : null;

        if ($resource === null) {
            return null;
        }

        $today = $this->common->today();
        $items = $this->occupations($today, $this->common->now()->addDays(self::AGENDA_DAYS)->toDateString())
            ->filter(fn (array $item): bool => $item['kind'] === $kind && $item['resource_id'] === $id)
            ->sortBy(fn (array $item): string => $item['date'].($item['time'] ?? ''))
            ->map(fn (array $item): array => collect($item)->except(['kind', 'resource_id'])->all())
            ->values();

        return [
            'kind' => $kind,
            'id' => $resource->id,
            'name' => $kind === 'vehicle' ? "{$resource->plate} · {$resource->vehicle_type}" : $resource->full_name,
            'status' => $resource->status,
            'from' => $today,
            'days' => self::AGENDA_DAYS,
            'items' => $items,
        ];
    }

    private function availabilityRow(string $kind, object $row, string $name, string $sub, ?string $document, array $days, Collection $occupations): array
    {
        $cells = array_map(function (string $day) use ($kind, $row, $document, $occupations): array {
            $items = $occupations->filter(fn (array $item) => $item['kind'] === $kind && $item['resource_id'] === $row->id && $item['date'] === $day);
            $items = $items->reject(fn (array $item) => $item['source'] === 'departure' && $items->contains(fn (array $other) => $other['source'] === 'order' && $other['time'] === $item['time']))->sortBy('time')->values();
            $off = in_array($row->status, ['vacaciones', 'mantenimiento'], true);

            return [
                'date' => $day,
                'state' => match (true) {
                    $off => $row->status,
                    $document !== null && $document < $day => 'documento_vencido',
                    $items->isNotEmpty() => 'ocupado',
                    $row->status === 'descanso' => 'descanso',
                    default => 'libre',
                },
                'document' => $document === null ? null : ($document < $day ? 'vencido' : ($document === $day ? 'vence_hoy' : null)),
                'items' => $off ? [] : $items->map(fn (array $item) => collect($item)->except(['kind', 'resource_id'])->all())->all(),
            ];
        }, $days);

        return ['id' => $row->id, 'kind' => $kind, 'name' => $name, 'sub' => $sub, 'status' => $row->status, 'busy' => count(array_filter($cells, fn (array $cell) => $cell['items'] !== [])), 'days' => $cells];
    }

    private function occupations(string $from, string $to): Collection
    {
        $assignments = DB::table('ops_assignments as a')
            ->join('ops_orders as o', 'o.id', '=', 'a.order_id')
            ->whereNull('o.deleted_at')
            ->where('o.status', '<>', 'cancelada')
            ->whereBetween('a.service_date', [$from, $to])
            ->get(['a.guide_id', 'a.driver_id', 'a.vehicle_id', 'a.service_date', 'a.service_time', 'a.service_label', 'a.status', 'o.code']);

        $departures = DB::table('catalog_product_departures as d')
            ->join('catalog_products as p', 'p.id', '=', 'd.product_id')
            ->where('d.status', '<>', 'cancelada')
            ->whereBetween('d.departure_date', [$from, $to])
            ->where(fn ($query) => $query->whereNotNull('d.guide_id')->orWhereNotNull('d.vehicle_id'))
            ->get(['d.guide_id', 'd.vehicle_id', 'd.departure_date', 'd.departure_time', 'd.ref', 'p.name']);

        $items = collect();
        foreach ($assignments as $row) {
            foreach (['guide' => $row->guide_id, 'driver' => $row->driver_id, 'vehicle' => $row->vehicle_id] as $kind => $id) {
                if ($id !== null) {
                    $items->push(['kind' => $kind, 'resource_id' => $id, 'date' => $row->service_date, 'time' => OpsCommon::time($row->service_time), 'label' => $row->service_label, 'ref' => $row->code, 'source' => 'order', 'done' => $row->status === 'completada']);
                }
            }
        }
        foreach ($departures as $row) {
            foreach (['guide' => $row->guide_id, 'vehicle' => $row->vehicle_id] as $kind => $id) {
                if ($id !== null) {
                    $items->push(['kind' => $kind, 'resource_id' => $id, 'date' => $row->departure_date, 'time' => OpsCommon::time($row->departure_time), 'label' => $row->name, 'ref' => $row->ref, 'source' => 'departure', 'done' => false]);
                }
            }
        }

        return $items;
    }

    public function assignments(array $where = [], ?array $between = null): Collection
    {
        $query = DB::table('ops_assignments as a')
            ->join('ops_orders as o', 'o.id', '=', 'a.order_id')
            ->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')
            ->join('booking_reservation_services as s', 's.id', '=', 'a.reservation_service_id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->whereNull('o.deleted_at')
            ->where('o.status', '<>', 'cancelada')
            ->where('a.status', '<>', 'cancelada');

        foreach ($where as $column => $value) {
            $query->where($column, $value);
        }

        if ($between !== null) {
            $query->whereBetween('a.service_date', $between);
        }

        $rows = $query->orderBy('a.service_date')->orderBy('a.service_time')->get([
            'a.id', 'a.lock_version', 'a.status', 'a.service_date', 'a.service_time', 'a.service_label', 'a.first_checkin_at', 'a.confirmed_at', 'a.warnings_ack',
            'o.code as order_code', 'o.status as order_status', 'o.title as order_title', 'r.id as reservation_id', 'r.code as reservation_code',
            's.code as service_code', 's.service_kind', 's.status as service_status',
            'g.id as guide_id', 'g.full_name as guide_name', 'd.id as driver_id', 'd.full_name as driver_name', 'v.id as vehicle_id', 'v.plate as vehicle_plate', 'v.vehicle_type', 'v.capacity as vehicle_capacity',
        ]);
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $rows->pluck('reservation_id')->unique())->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');

        return $rows->map(fn (object $row): array => [
            'id' => $row->id,
            'lock_version' => (int) $row->lock_version,
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
