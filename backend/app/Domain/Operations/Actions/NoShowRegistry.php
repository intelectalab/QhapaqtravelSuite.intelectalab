<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\NoShowEffects;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class NoShowRegistry
{
    public const SERVICE_STATUSES = ['confirmado', 'en_curso', 'completado'];

    private const SERVICE_COLUMNS = ['id', 'code', 'name', 'status', 'service_date', 'reservation_id', 'product_id', 'pax', 'price_amount', 'currency', 'fx_rate'];

    public function __construct(private readonly NoShowEffects $effects, private readonly OpsCommon $common, private readonly AuditLogger $audit) {}

    public function service(string $reference): object
    {
        return DB::table('booking_reservation_services')->where(Str::isUuid($reference) ? 'id' : 'code', $reference)->first(self::SERVICE_COLUMNS)
            ?? throw ApiException::notFound('El servicio no existe.');
    }

    public function register(string $serviceReference, array $passengerIds, ?string $note, User $actor): array
    {
        return DB::transaction(function () use ($serviceReference, $passengerIds, $note, $actor): array {
            $service = $this->service($serviceReference);
            $this->assertRecordable($service);
            $assignment = DB::table('ops_assignments')->where('reservation_service_id', $service->id)->orderByDesc('created_at')->first(['id']);
            $wanted = collect($passengerIds)->map(fn (mixed $id): string => (string) $id)->unique()->values();
            $roster = DB::table('booking_passengers')->where('reservation_id', $service->reservation_id)->pluck('full_name', 'id')->mapWithKeys(fn (mixed $name, mixed $id): array => [(string) $id => (string) $name]);

            if ($wanted->isEmpty() || $wanted->diff($roster->keys())->isNotEmpty()) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige pasajeros de esta reserva.');
            }

            $present = $assignment ? $this->checkedIn((string) $assignment->id)->intersect($wanted) : collect();

            if ($present->isNotEmpty()) {
                throw ApiException::unprocessable('OPS-BR-52', 'Tiene check-in en este servicio: '.$present->map(fn (string $id): string => $roster[$id])->implode(', ').'. Quita el check-in antes de registrarlo como no-show.');
            }

            $rows = $this->insert($service, $assignment?->id, $wanted->all(), $roster, 'web', $note, $actor);

            if ($rows->isEmpty()) {
                throw ApiException::conflict('OPS-BR-52', 'Esos pasajeros ya figuran como no-show en este servicio.');
            }

            $effects = $this->effects->apply($service, $rows, $actor);

            return ['registered' => $rows->count(), 'ids' => $rows->pluck('id')->values()->all(), 'effects' => $effects];
        });
    }

    public function onFinish(string $serviceId, string $assignmentId, string $source, User $actor): array
    {
        $checked = $this->checkedIn($assignmentId);

        if ($checked->isEmpty()) {
            return ['registered' => 0, 'effects' => null];
        }

        $service = $this->service($serviceId);
        $roster = DB::table('booking_passengers')->where('reservation_id', $service->reservation_id)->orderBy('seq')->pluck('full_name', 'id')->mapWithKeys(fn (mixed $name, mixed $id): array => [(string) $id => (string) $name]);
        $rows = $this->insert($service, $assignmentId, $roster->keys()->diff($checked)->values()->all(), $roster, $source, null, $actor);

        return ['registered' => $rows->count(), 'effects' => $this->effects->apply($service, $rows, $actor)];
    }

    public function updateNote(string $id, ?string $note, User $actor): array
    {
        return DB::transaction(function () use ($id, $note, $actor): array {
            $row = $this->lockedRow($id);

            if ($row->voided_at !== null) {
                throw ApiException::conflict('OPS-BR-52', 'El registro está anulado.');
            }

            $note = $note === null || trim($note) === '' ? null : trim($note);

            if ($note === $row->note) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('ops_no_shows')->where('id', $row->id)->update(['note' => $note, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('No-show', $this->label($row), 'modificar_nota', $row->note, $note, actor: $actor);

            return ['id' => $row->id, 'note' => $note, 'lock_version' => (int) $row->lock_version + 1];
        });
    }

    public function void(string $id, string $reason, User $actor): array
    {
        return DB::transaction(function () use ($id, $reason, $actor): array {
            $row = $this->lockedRow($id);

            if ($row->voided_at !== null) {
                throw ApiException::conflict('OPS-BR-52', 'El registro ya estaba anulado.');
            }

            DB::table('ops_no_shows')->where('id', $row->id)->update(['voided_at' => now(), 'voided_by' => $actor->getKey(), 'void_reason' => $reason, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('No-show', $this->label($row), 'anular', 'registrado', "anulado · {$reason}", actor: $actor);
            $released = $this->releaseCharge($row, $actor);

            return ['id' => $row->id, 'voided' => true, 'charge_cancelled' => $released];
        });
    }

    private function releaseCharge(object $row, User $actor): bool
    {
        if ($row->receivable_id === null || DB::table('ops_no_shows')->where('receivable_id', $row->receivable_id)->whereNull('voided_at')->exists()) {
            return false;
        }

        $receivable = DB::table('fin_receivables')->where('id', $row->receivable_id)->whereNull('deleted_at')->lockForUpdate()->first(['id', 'code', 'status', 'paid_amount']);

        if ($receivable === null || in_array($receivable->status, ['pagada', 'cancelada'], true) || (float) $receivable->paid_amount > 0) {
            return false;
        }

        DB::table('fin_receivables')->where('id', $receivable->id)->update(['status' => 'cancelada', 'cancelled_at' => now(), 'cancel_reason' => 'No-show anulado', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Cuenta por cobrar', $receivable->code, 'cancelar', $receivable->status, 'cancelada · no-show anulado', actor: $actor);

        return true;
    }

    private function insert(object $service, ?string $assignmentId, array $passengerIds, Collection $roster, string $source, ?string $note, User $actor): Collection
    {
        $existing = DB::table('ops_no_shows')->where('reservation_service_id', $service->id)->whereNull('voided_at')->pluck('passenger_id')->map(fn (mixed $id): string => (string) $id);
        $rows = collect();

        foreach (array_diff($passengerIds, $existing->all()) as $passengerId) {
            $id = (string) Str::uuid7();
            DB::table('ops_no_shows')->insert([
                'id' => $id,
                'reservation_id' => $service->reservation_id,
                'reservation_service_id' => $service->id,
                'assignment_id' => $assignmentId,
                'passenger_id' => $passengerId,
                'source' => $source,
                'recorded_at' => now(),
                'note' => $note === null || trim($note) === '' ? null : trim($note),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $rows->push(['id' => $id, 'passenger_id' => $passengerId, 'passenger' => $roster[$passengerId] ?? 'Pasajero']);
        }

        if ($rows->isNotEmpty()) {
            $this->audit->log('No-show', "{$service->code} · ".CarbonImmutable::parse($service->service_date)->format('d/m/Y'), 'registrar', null, mb_substr(($source === 'app_operador' ? 'app del operador' : 'web').' · '.$rows->pluck('passenger')->implode(', '), 0, 250), actor: $actor);
        }

        return $rows;
    }

    private function assertRecordable(object $service): void
    {
        if (! in_array($service->status, self::SERVICE_STATUSES, true)) {
            throw ApiException::conflict('OPS-BR-52', 'El no-show se registra en servicios confirmados, en curso o completados.');
        }

        if ((string) $service->service_date > $this->common->today()) {
            throw ApiException::unprocessable('OPS-BR-52', 'El no-show se registra desde el día del servicio ('.CarbonImmutable::parse($service->service_date)->format('d/m/Y').').');
        }
    }

    private function checkedIn(string $assignmentId): Collection
    {
        return DB::table('ops_assignment_checkins')->where('assignment_id', $assignmentId)->whereNull('undone_at')->pluck('passenger_id')->map(fn (mixed $id): string => (string) $id);
    }

    private function lockedRow(string $id): stdClass
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('El registro de no-show no existe.');
        }

        $row = DB::table('ops_no_shows as n')->join('booking_reservation_services as s', 's.id', '=', 'n.reservation_service_id')->join('booking_passengers as p', 'p.id', '=', 'n.passenger_id')
            ->where('n.id', $id)->lock('for no key update of n')
            ->first(['n.*', 's.code as service_code', 'p.full_name as passenger']);

        if ($row === null) {
            throw ApiException::notFound('El registro de no-show no existe.');
        }

        return $row;
    }

    private function label(object $row): string
    {
        return "{$row->service_code} · {$row->passenger}";
    }
}
