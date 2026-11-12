<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Operations\Support\ResourceDirectory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AssignmentWorkflow
{
    private const GAP_MINUTES = 360;

    private const NATIONALITY_LANGUAGE = ['Alemana' => 'DE', 'Francesa' => 'FR', 'Brasileña' => 'PT', 'Portuguesa' => 'PT', 'Italiana' => 'IT', 'Estadounidense' => 'EN', 'Británica' => 'EN', 'Canadiense' => 'EN', 'Australiana' => 'EN'];

    public function __construct(
        private readonly OpsCommon $common,
        private readonly ResourceDirectory $resources,
        private readonly AuditLogger $audit,
        private readonly OpsNotices $notices,
    ) {}

    public function preview(string $id, array $data): array
    {
        $assignment = $this->assignment($id);
        $resources = $this->resourcesOf($data);
        $result = array_filter($resources) === [] ? ['blocks' => [], 'warnings' => []] : $this->validate($assignment, $resources);
        $languages = $this->requiredLanguages($assignment->reservation_id);

        return [
            ...$result,
            'ready' => array_filter($resources) !== [] && $result['blocks'] === [],
            'context' => [
                'passengers' => DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->count(),
                'languages' => array_map(fn (string $code) => ResourceDirectory::LANGUAGES[$code] ?? $code, $languages),
                'provider' => DB::table('booking_reservation_services as s')->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')->where('s.id', $assignment->reservation_service_id)->value('p.name'),
                'recipients' => $this->recipients($resources)->count(),
            ],
        ];
    }

    public function checkins(string $id, array $passengerIds, User $actor): array
    {
        $assignment = $this->assignment($id);

        if (! in_array($assignment->status, ['en_curso', 'completada'], true)) {
            throw ApiException::conflict('OPS-BR-50', 'El check-in se registra cuando el servicio ya inició.');
        }

        if ($assignment->service_date > $this->common->today()) {
            throw ApiException::conflict('OPS-BR-50', 'El check-in se registra el día del servicio.');
        }

        $roster = DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->pluck('id')->map(fn (mixed $value): string => (string) $value);
        $wanted = collect($passengerIds)->map(fn (mixed $value): string => (string) $value)->unique()->values();

        if ($wanted->diff($roster)->isNotEmpty()) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige pasajeros de esta reserva.');
        }

        return DB::transaction(function () use ($assignment, $wanted, $actor): array {
            $current = DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereNull('undone_at')->lockForUpdate()->pluck('passenger_id')->map(fn (mixed $value): string => (string) $value);
            $added = $wanted->diff($current)->values();
            $removed = $current->diff($wanted)->values();

            foreach ($added as $passengerId) {
                DB::table('ops_assignment_checkins')->insert(['assignment_id' => $assignment->id, 'passenger_id' => $passengerId, 'checked_at' => now(), 'source' => 'web', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            }

            if ($removed->isNotEmpty()) {
                DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereIn('passenger_id', $removed)->whereNull('undone_at')->update(['undone_at' => now(), 'undone_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            }

            $first = DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereNull('undone_at')->min('checked_at');
            DB::table('ops_assignments')->where('id', $assignment->id)->update(['first_checkin_at' => $first, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($added->isNotEmpty() || $removed->isNotEmpty()) {
                $this->audit->log('Asignación', $assignment->order_code.' · '.$assignment->service_label, 'check_in', null, "{$wanted->count()} presentes · +{$added->count()} / -{$removed->count()}");
            }

            return ['present' => $wanted->count(), 'added' => $added->count(), 'removed' => $removed->count()];
        });
    }

    public function assign(string $id, array $data, User $actor): array
    {
        $assignment = $this->assignment($id);
        $resources = $this->resourcesOf($data);

        if (! in_array($assignment->status, ['pendiente', 'asignada', 'confirmada'], true)) {
            throw ApiException::conflict('OPS-BR-29', 'El servicio ya empezó o terminó: sus recursos no se cambian.');
        }

        if (array_filter($resources) === []) {
            throw ApiException::unprocessable('OPS-BR-20', 'Elige al menos un guía, conductor o vehículo.');
        }

        ['blocks' => $blocks, 'warnings' => $warnings] = $this->validate($assignment, $resources);

        if ($blocks !== []) {
            throw ApiException::conflict('OPS-BR-21', $blocks[0], ['blocks' => $blocks, 'warnings' => $warnings]);
        }

        if ($warnings !== [] && empty($data['ack_warnings'])) {
            throw ApiException::unprocessable('OPS-BR-28', 'Revisa las advertencias y confirma que las asumes: '.implode(' ', $warnings), ['warnings' => $warnings]);
        }

        $previous = $this->recipients($this->resourcesOf((array) $assignment));
        DB::table('ops_assignments')->where('id', $assignment->id)->update([
            ...$resources,
            'status' => 'asignada',
            'confirmed_at' => null,
            'confirmed_via' => null,
            'warnings_ack' => $warnings === [] ? null : json_encode(['items' => $warnings, 'user' => $actor->getKey(), 'at' => now()->toIso8601String()], JSON_UNESCAPED_UNICODE),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->recompute($assignment->order_id);
        $this->audit->log('Asignación', $assignment->order_code.' · '.$assignment->service_label, 'asignar', $assignment->status, 'asignada'.($warnings === [] ? '' : ' · '.count($warnings).' advertencias'));
        $channels = array_values(array_intersect(OpsNotices::CHANNELS, (array) ($data['notify'] ?? [])));
        $current = $this->recipients($resources);
        $notified = $channels === [] ? 0 : $this->notify($assignment, $current);
        $this->notifyRemoved($assignment, $previous->diff($current), 'asignacion.reasignada', 'Tu servicio pasó a otro operador');

        return ['warnings' => $warnings, 'notified' => $notified, 'channels' => $channels, 'delivery' => $channels === [] ? null : 'portal'];
    }

    public function notifySchedule(string $reservationId, string $note): int
    {
        $sent = 0;

        foreach (DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->where('o.reservation_id', $reservationId)->whereNotIn('a.status', ['pendiente', 'completada'])
            ->get(['a.id', 'a.guide_id', 'a.driver_id', 'a.vehicle_id', 'a.service_label', 'a.service_date', 'a.service_time', 'o.code as order_code', 'o.reservation_id']) as $assignment) {
            $users = $this->recipients($this->resourcesOf((array) $assignment));
            $sent += $users->isEmpty() ? 0 : $this->notices->toUsers($users, 'asignacion.cambio_horario', "Cambió la fecha u hora de {$assignment->service_label}", $note, 'ops_assignment', (string) $assignment->id, (string) $assignment->reservation_id);
        }

        return $sent;
    }

    private function notifyRemoved(object $assignment, Collection $users, string $event, string $title): void
    {
        if ($users->isEmpty()) {
            return;
        }

        $date = CarbonImmutable::parse($assignment->service_date)->format('d/m/Y');
        $this->notices->toUsers($users, $event, "{$title}: {$assignment->service_label}", "{$assignment->service_label} del {$date} ({$assignment->order_code}) ya no está a tu cargo.", 'ops_assignment', (string) $assignment->id, $assignment->reservation_id);
    }

    private function notify(object $assignment, Collection $recipients): int
    {
        $time = OpsCommon::time($assignment->service_time);
        $date = CarbonImmutable::parse($assignment->service_date)->format('d/m/Y');
        $body = "Tienes un servicio asignado: {$assignment->service_label} el {$date}".($time ? " a las {$time}" : '')." ({$assignment->order_code}).";

        return $this->notices->toUsers($recipients, 'asignacion.creada', "Servicio asignado: {$assignment->service_label}", $body, 'ops_assignment', $assignment->id, $assignment->reservation_id);
    }

    private function recipients(array $resources): Collection
    {
        if (! $resources['guide_id'] && ! $resources['driver_id']) {
            return collect();
        }

        return DB::table('iam_users')->whereNull('deleted_at')->where('status', 'activo')
            ->where(fn ($query) => $query->when($resources['guide_id'], fn ($inner) => $inner->orWhere('guide_id', $resources['guide_id']))->when($resources['driver_id'], fn ($inner) => $inner->orWhere('driver_id', $resources['driver_id'])))
            ->pluck('id');
    }

    private function resourcesOf(array $data): array
    {
        return ['guide_id' => $data['guide_id'] ?? null, 'driver_id' => $data['driver_id'] ?? null, 'vehicle_id' => $data['vehicle_id'] ?? null];
    }

    public function confirm(string $id, User $actor): void
    {
        $assignment = $this->assignment($id);

        if ($assignment->status !== 'asignada') {
            throw ApiException::conflict('OPS-BR-05', 'Solo se confirma una asignación con recursos asignados.');
        }

        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'confirmada', 'confirmed_at' => now(), 'confirmed_via' => 'web', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->recompute($assignment->order_id);
        $this->audit->log('Asignación', $assignment->order_code.' · '.$assignment->service_label, 'confirmar_recurso', 'asignada', 'confirmada');
    }

    public function release(string $id, User $actor): void
    {
        $assignment = $this->assignment($id);

        if (in_array($assignment->status, ['pendiente', 'completada', 'en_curso'], true)) {
            throw ApiException::conflict('OPS-BR-05', 'Esta asignación no tiene recursos que liberar.');
        }

        $previous = $this->recipients($this->resourcesOf((array) $assignment));
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['guide_id' => null, 'driver_id' => null, 'vehicle_id' => null, 'status' => 'pendiente', 'confirmed_at' => null, 'confirmed_via' => null, 'warnings_ack' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->recompute($assignment->order_id);
        $this->audit->log('Asignación', $assignment->order_code.' · '.$assignment->service_label, 'liberar', $assignment->status, 'pendiente');
        $this->notifyRemoved($assignment, $previous, 'asignacion.liberada', 'Se liberó tu servicio');
    }

    public function recompute(string $orderId): void
    {
        $order = DB::table('ops_orders')->where('id', $orderId)->first(['status', 'reservation_id']);

        if ($order === null || in_array($order->status, ['en_ejecucion', 'completada', 'cancelada'], true)) {
            return;
        }

        $statuses = DB::table('ops_assignments')->where('order_id', $orderId)->pluck('status');

        if ($statuses->isEmpty()) {
            return;
        }

        $next = match (true) {
            $statuses->contains('pendiente') => 'pendiente_asignacion',
            $statuses->every(fn (string $status) => in_array($status, ['confirmada', 'en_curso', 'completada'], true))
                && ! DB::table('booking_reservation_services')->where('reservation_id', $order->reservation_id)->whereIn('status', ['pendiente', 'solicitado'])->exists() => 'confirmada',
            default => 'asignada',
        };

        if ($next !== $order->status) {
            DB::table('ops_orders')->where('id', $orderId)->update(['status' => $next, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
        }
    }

    private function validate(object $assignment, array $resources): array
    {
        $blocks = [];
        $warnings = [];
        $date = $assignment->service_date;
        $today = $this->common->today();
        $soon = $this->common->now()->addDays(30)->toDateString();

        if ($resources['guide_id']) {
            $guide = DB::table('ops_guides')->whereNull('deleted_at')->where('id', $resources['guide_id'])->first() ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El guía no existe.');
            match ($guide->status) {
                'vacaciones' => $blocks[] = "{$guide->full_name} está de vacaciones.",
                'descanso' => $warnings[] = "{$guide->full_name} figura en descanso.",
                default => null,
            };
            $missing = array_diff($this->requiredLanguages($assignment->reservation_id), $this->resources->languages($guide->languages));

            if ($missing !== []) {
                $warnings[] = "{$guide->full_name} no habla ".implode(', ', array_map(fn (string $code) => ResourceDirectory::LANGUAGES[$code] ?? $code, $missing)).'.';
            }

            $this->overlaps('guide_id', $guide->id, $guide->full_name, $assignment, $blocks, $warnings);
            $perGuide = (int) (app(TenantSettings::class)->section('operations')['max_pax_per_guide'] ?? 16);
            $pax = DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->count();

            if ($perGuide > 0 && $pax > $perGuide) {
                $warnings[] = "El grupo tiene {$pax} pasajeros y el máximo por guía es {$perGuide}: considera un segundo guía.";
            }
        }

        if ($resources['driver_id']) {
            $driver = DB::table('ops_drivers')->whereNull('deleted_at')->where('id', $resources['driver_id'])->first() ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El conductor no existe.');
            match ($driver->status) {
                'vacaciones' => $blocks[] = "{$driver->full_name} está de vacaciones.",
                'descanso' => $warnings[] = "{$driver->full_name} figura en descanso.",
                default => null,
            };

            if ($driver->license_expires_on < $date) {
                $blocks[] = "La licencia de {$driver->full_name} vence antes del servicio.";
            } elseif ($driver->license_expires_on <= $soon && $driver->license_expires_on >= $today) {
                $warnings[] = "La licencia de {$driver->full_name} vence en menos de 30 días.";
            }

            $this->overlaps('driver_id', $driver->id, $driver->full_name, $assignment, $blocks, $warnings);
        }

        if ($resources['vehicle_id']) {
            $vehicle = DB::table('ops_vehicles')->whereNull('deleted_at')->where('id', $resources['vehicle_id'])->first() ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El vehículo no existe.');
            $passengers = DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->count();

            if ($vehicle->status === 'mantenimiento') {
                $blocks[] = "El vehículo {$vehicle->plate} está en mantenimiento.";
            }

            if ((int) $vehicle->capacity < $passengers) {
                $blocks[] = "El vehículo {$vehicle->plate} tiene {$vehicle->capacity} plazas y el grupo es de {$passengers}.";
            }

            if ($vehicle->soat_expires_on < $date) {
                $blocks[] = "El SOAT de {$vehicle->plate} vence antes del servicio.";
            } elseif ($vehicle->soat_expires_on <= $soon && $vehicle->soat_expires_on >= $today) {
                $warnings[] = "El SOAT de {$vehicle->plate} vence en menos de 30 días.";
            }

            $this->overlaps('vehicle_id', $vehicle->id, $vehicle->plate, $assignment, $blocks, $warnings);
        }

        return ['blocks' => $blocks, 'warnings' => $warnings];
    }

    private function overlaps(string $column, string $resourceId, string $name, object $assignment, array &$blocks, array &$warnings): void
    {
        $others = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')
            ->where("a.{$column}", $resourceId)->where('a.id', '<>', $assignment->id)->where('a.service_date', $assignment->service_date)
            ->whereNotIn('a.status', ['completada', 'cancelada'])->where('o.status', '<>', 'cancelada')->whereNull('o.deleted_at')
            ->get(['a.order_id', 'a.service_time', 'a.service_label', 'o.code']);

        foreach ($others as $other) {
            $gap = $this->gap($assignment->service_time, $other->service_time);
            $sameOrder = $other->order_id === $assignment->order_id;

            if ($gap < self::GAP_MINUTES && ! $sameOrder) {
                $blocks[] = "{$name} ya tiene {$other->service_label} ({$other->code}) a menos de 6 horas.";
            } elseif ($gap < self::GAP_MINUTES) {
                $warnings[] = "{$name} tiene otro servicio de esta orden a menos de 6 horas: verifica el encadenamiento.";
            } else {
                $warnings[] = "{$name} tiene otro servicio ese día ({$other->code}): verifica los tiempos de retorno.";
            }
        }

        if (! in_array($column, ['guide_id', 'vehicle_id'], true)) {
            return;
        }

        $own = DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id ?? null)->first(['departure_id', 'product_id']);
        $departures = DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
            ->where("d.{$column}", $resourceId)->where('d.departure_date', $assignment->service_date)->where('d.status', '<>', 'cancelada')
            ->when($own?->departure_id !== null, fn ($query) => $query->where('d.id', '<>', $own->departure_id))
            ->when($own?->product_id !== null, fn ($query) => $query->where('d.product_id', '<>', $own->product_id))
            ->get(['d.ref', 'd.departure_time', 'p.name']);

        foreach ($departures as $departure) {
            if ($this->gap($assignment->service_time, $departure->departure_time) < self::GAP_MINUTES) {
                $blocks[] = "{$name} ya está en la salida programada {$departure->ref} ({$departure->name}) a menos de 6 horas.";
            } else {
                $warnings[] = "{$name} tiene la salida programada {$departure->ref} ese día: verifica los tiempos de retorno.";
            }
        }
    }

    private function gap(?string $first, ?string $second): int
    {
        if ($first === null || $second === null) {
            return 0;
        }

        return (int) abs(CarbonImmutable::parse($first)->diffInMinutes(CarbonImmutable::parse($second)));
    }

    private function requiredLanguages(string $reservationId): array
    {
        return DB::table('booking_passengers')->where('reservation_id', $reservationId)->pluck('nationality')
            ->map(fn (?string $nationality) => self::NATIONALITY_LANGUAGE[$nationality ?? ''] ?? null)->filter()->unique()->values()->all();
    }

    private function assignment(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La asignación no existe.');
        }

        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNull('o.deleted_at')->where('a.id', $id)
            ->first(['a.*', 'o.code as order_code', 'o.status as order_status', 'o.reservation_id']) ?? throw ApiException::notFound('La asignación no existe.');

        if (in_array($assignment->order_status, ['completada', 'cancelada'], true)) {
            throw ApiException::conflict('OPS-BR-05', 'La orden ya está cerrada.');
        }

        return $assignment;
    }
}
