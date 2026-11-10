<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Operations\Support\ResourceDirectory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
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
    ) {}

    public function assign(string $id, array $data, User $actor): array
    {
        $assignment = $this->assignment($id);
        $resources = ['guide_id' => $data['guide_id'] ?? null, 'driver_id' => $data['driver_id'] ?? null, 'vehicle_id' => $data['vehicle_id'] ?? null];

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

        return ['warnings' => $warnings];
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

        DB::table('ops_assignments')->where('id', $assignment->id)->update(['guide_id' => null, 'driver_id' => null, 'vehicle_id' => null, 'status' => 'pendiente', 'confirmed_at' => null, 'confirmed_via' => null, 'warnings_ack' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->recompute($assignment->order_id);
        $this->audit->log('Asignación', $assignment->order_code.' · '.$assignment->service_label, 'liberar', $assignment->status, 'pendiente');
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
            ->where('a.status', '<>', 'completada')->where('o.status', '<>', 'cancelada')->whereNull('o.deleted_at')
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
