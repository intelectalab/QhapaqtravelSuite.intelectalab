<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Finance\Support\DerivedTokens;
use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\CheckinPasses;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class Checkin
{
    public const WAIVER_STATES = ['no_aplica' => 'No aplica', 'pendiente' => 'Sin firmar', 'falta_tutor' => 'Falta el tutor', 'firmado' => 'Firmado'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly CheckinPasses $passes,
        private readonly AuditLogger $audit,
        private readonly GrowthFeatureGate $gate,
    ) {}

    public function scan(string $token, ?string $device, User $actor): array
    {
        $this->gate->require(CheckinPasses::RULE);

        return DB::transaction(function () use ($token, $device, $actor): array {
            $pass = DB::table('ops_checkin_passes')->where('token_hash', DerivedTokens::hash(trim($token)))->lockForUpdate()->first();

            if ($pass === null) {
                throw ApiException::notFound('El código QR no corresponde a un pase de esta agencia.');
            }

            $service = DB::table('booking_reservation_services')->where('id', $pass->service_id)->first(['id', 'code', 'name', 'service_date', 'service_time']);
            $passenger = DB::table('booking_passengers')->where('id', $pass->passenger_id)->first(['id', 'full_name', 'birth_date', 'age', 'pax_type']);
            $this->assertAssigned((string) $service->id, $actor);

            if ($pass->status === 'usado') {
                throw ApiException::conflict('PASS_ALREADY_USED', $passenger->full_name.' ya ingresó a las '.Carbon::parse((string) $pass->scanned_at)->timezone($this->context->timezone())->format('H:i').'. Un pase se usa una sola vez.');
            }

            if ($pass->status === 'anulado') {
                throw ApiException::conflict('PASS_VOID', 'Este pase fue anulado. Pide al pasajero el pase vigente desde su portal.');
            }

            $today = Carbon::now($this->context->timezone())->toDateString();

            if ((string) $service->service_date !== $today) {
                throw ApiException::unprocessable('SERVICE_NOT_TODAY', 'El pase es para «'.$service->name.'» del '.Carbon::parse((string) $service->service_date)->format('d/m/Y').'; hoy no se puede registrar.');
            }

            $template = $this->passes->activeTemplate();

            if ($this->passes->waiverRequired($template)) {
                $state = CheckinPasses::waiverState($passenger, $template, $this->passes->signatures((string) $pass->reservation_id, $template), $today);

                if ($state !== 'firmado') {
                    throw ApiException::unprocessable('WAIVER_REQUIRED', $state === 'falta_tutor'
                        ? $passenger->full_name.' es menor de edad: el deslinde necesita el nombre de su madre, padre o tutor.'
                        : $passenger->full_name.' no firmó el deslinde de responsabilidad. Puede firmarlo ahora desde su portal.');
                }
            }

            DB::table('ops_checkin_passes')->where('id', $pass->id)->update(['status' => 'usado', 'scanned_at' => now(), 'scanned_by' => $actor->getKey(), 'scan_device_id' => $device ? mb_substr($device, 0, 80) : null]);
            DB::table('ops_assignments')->where('reservation_service_id', $service->id)->whereNull('first_checkin_at')->update(['first_checkin_at' => now()]);
            $this->audit->log('Check-in', (string) $service->code, 'checkin', after: $passenger->full_name.($device ? ' · '.$device : ''), actor: $actor);

            return [
                'result' => 'ingreso',
                'passenger' => $passenger->full_name,
                'service' => ['id' => $service->id, 'code' => $service->code, 'name' => $service->name],
                'scanned_at' => now()->toIso8601String(),
                'counts' => $this->counts((string) $service->id),
                'message' => $passenger->full_name.' registró su ingreso.',
            ];
        });
    }

    public function manifest(string $serviceKey, User $actor): array
    {
        $this->gate->require(CheckinPasses::RULE);

        if ($serviceKey === 'hoy' || preg_match('/^\d{4}-\d{2}-\d{2}$/', $serviceKey) === 1) {
            return $this->day($serviceKey === 'hoy' ? Carbon::now($this->context->timezone())->toDateString() : $serviceKey, $actor);
        }

        $service = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->whereNull('r.deleted_at')->where(Str::isUuid($serviceKey) ? 's.id' : 's.code', $serviceKey)
            ->first(['s.id', 's.code', 's.name', 's.service_date', 's.service_time', 's.service_kind', 's.status', 's.reservation_id', 'r.code as reservation', 'r.title as reservation_title']);

        if ($service === null) {
            throw ApiException::notFound('El servicio no existe.');
        }

        $this->assertAssigned((string) $service->id, $actor);
        $this->passes->ensure((string) $service->reservation_id);
        $template = $this->passes->activeTemplate();
        $signatures = $this->passes->signatures((string) $service->reservation_id, $template);
        $date = (string) $service->service_date;
        $passes = DB::table('ops_checkin_passes')->where('service_id', $service->id)->where('status', '<>', 'anulado')->get(['passenger_id', 'status', 'scanned_at', 'scanned_by', 'scan_device_id'])->keyBy('passenger_id');
        $scanners = DB::table('iam_users')->whereIn('id', $passes->pluck('scanned_by')->filter()->unique())->pluck('name', 'id');
        $assignment = DB::table('ops_assignments as a')->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->where('a.reservation_service_id', $service->id)->first(['g.full_name as guide', 'd.full_name as driver', 'a.status']);

        $passengers = DB::table('booking_passengers')->where('reservation_id', $service->reservation_id)->where('is_placeholder', false)->orderByDesc('is_lead')->orderBy('seq')
            ->get(['id', 'full_name', 'pax_type', 'birth_date', 'age', 'doc_type', 'doc_number', 'phone', 'diet_notes', 'is_lead'])
            ->map(function (object $passenger) use ($passes, $template, $signatures, $date, $scanners): array {
                $pass = $passes->get($passenger->id);
                $state = CheckinPasses::waiverState($passenger, $template, $signatures, $date);

                return [
                    'id' => $passenger->id,
                    'name' => $passenger->full_name,
                    'pax_type' => $passenger->pax_type,
                    'is_lead' => (bool) $passenger->is_lead,
                    'minor' => CheckinPasses::isMinor($passenger, $date),
                    'document' => trim(($passenger->doc_type ?? '').' '.($passenger->doc_number ? '•••'.mb_substr((string) $passenger->doc_number, -3) : '')),
                    'diet_notes' => $passenger->diet_notes,
                    'pass_status' => $pass->status ?? 'sin_pase',
                    'pass_label' => $pass ? (CheckinPasses::STATUSES[$pass->status] ?? $pass->status) : 'Sin pase',
                    'scanned_at' => $pass && $pass->scanned_at ? Carbon::parse((string) $pass->scanned_at)->toIso8601String() : null,
                    'scanned_by' => $pass && $pass->scanned_by ? ($scanners[$pass->scanned_by] ?? null) : null,
                    'device' => $pass->scan_device_id ?? null,
                    'waiver' => $state,
                    'waiver_label' => self::WAIVER_STATES[$state],
                    'signed_name' => $signatures->get($passenger->id)->signed_name ?? null,
                ];
            })->values();

        return [
            'service' => [
                'id' => $service->id,
                'code' => $service->code,
                'name' => $service->name,
                'date' => $date,
                'time' => $service->service_time ? mb_substr((string) $service->service_time, 0, 5) : null,
                'kind' => $service->service_kind,
                'status' => $service->status,
                'is_today' => $date === Carbon::now($this->context->timezone())->toDateString(),
                'reservation' => ['code' => $service->reservation, 'title' => $service->reservation_title],
                'guide' => $assignment->guide ?? null,
                'driver' => $assignment->driver ?? null,
            ],
            'waiver_template' => $template ? ['code' => $template->code, 'name' => $template->name, 'version' => (int) $template->version, 'requires_guardian_for_minors' => (bool) $template->requires_guardian_for_minors] : null,
            'passengers' => $passengers->all(),
            'counts' => [
                'total' => $passengers->count(),
                'checked_in' => $passengers->where('pass_status', 'usado')->count(),
                'pending' => $passengers->where('pass_status', 'emitido')->count(),
                'waiver_missing' => $passengers->whereIn('waiver', ['pendiente', 'falta_tutor'])->count(),
            ],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function day(string $date, User $actor): array
    {
        $staff = $this->staff($actor);
        $query = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('ops_assignments as a', 'a.reservation_service_id', '=', 's.id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->whereNull('r.deleted_at')->whereNotIn('r.status', ['borrador', 'cancelada'])
            ->where('s.service_date', $date)->whereIn('s.service_kind', CheckinPasses::KINDS)
            ->when($staff !== null, fn (Builder $scope) => $scope->where($staff['column'], $staff['id']))
            ->orderBy('s.service_time')->orderBy('s.code');

        $services = $query->get(['s.id', 's.code', 's.name', 's.service_time', 's.pax', 's.status', 's.reservation_id', 'r.code as reservation', 'g.full_name as guide']);

        foreach ($services->pluck('reservation_id')->unique() as $reservationId) {
            $this->passes->ensure((string) $reservationId);
        }

        $counts = DB::table('ops_checkin_passes')->whereIn('service_id', $services->pluck('id'))->where('status', '<>', 'anulado')
            ->select(['service_id', DB::raw('count(*) as total'), DB::raw("count(*) filter (where status = 'usado') as used")])->groupBy('service_id')->get()->keyBy('service_id');

        return [
            'date' => $date,
            'services' => $services->map(fn (object $row) => [
                'id' => $row->id,
                'code' => $row->code,
                'name' => $row->name,
                'time' => $row->service_time ? mb_substr((string) $row->service_time, 0, 5) : null,
                'reservation' => $row->reservation,
                'guide' => $row->guide,
                'status' => $row->status,
                'total' => (int) ($counts[$row->id]->total ?? 0),
                'checked_in' => (int) ($counts[$row->id]->used ?? 0),
            ])->values()->all(),
            'totals' => [
                'services' => $services->count(),
                'passengers' => (int) $counts->sum('total'),
                'checked_in' => (int) $counts->sum('used'),
            ],
        ];
    }

    private function counts(string $serviceId): array
    {
        $row = DB::table('ops_checkin_passes')->where('service_id', $serviceId)->where('status', '<>', 'anulado')
            ->selectRaw("count(*) as total, count(*) filter (where status = 'usado') as used")->first();

        return ['total' => (int) $row->total, 'checked_in' => (int) $row->used, 'pending' => (int) $row->total - (int) $row->used];
    }

    private function staff(User $actor): ?array
    {
        if ($actor->getAttribute('guide_id') !== null) {
            return ['column' => 'a.guide_id', 'id' => (string) $actor->getAttribute('guide_id')];
        }

        if ($actor->getAttribute('driver_id') !== null) {
            return ['column' => 'a.driver_id', 'id' => (string) $actor->getAttribute('driver_id')];
        }

        return null;
    }

    private function assertAssigned(string $serviceId, User $actor): void
    {
        $staff = $this->staff($actor);

        if ($staff === null) {
            return;
        }

        $assigned = DB::table('ops_assignments as a')->where('a.reservation_service_id', $serviceId)->where($staff['column'], $staff['id'])->exists();

        if (! $assigned) {
            throw ApiException::forbidden('CHECKIN_NOT_ASSIGNED', 'No estás asignado a este servicio. Solo el guía o conductor asignado registra el ingreso.', ['operations.assign']);
        }
    }
}
