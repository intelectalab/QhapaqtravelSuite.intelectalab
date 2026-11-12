<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Support;

use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SupplierPortal\Actions\SupplierVouchers;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SupplierOperations
{
    public const OBSERVATION_REASONS = ['Habitación en mantenimiento', 'Tipo de habitación no disponible', 'Sobreventa (overbooking)', 'Datos de huésped incompletos', 'Otro'];

    public const OBSERVATION_IMPACTS = ['baja', 'media', 'alta'];

    public const INCIDENT_TYPES = ['Proveedor', 'Horario', 'Capacidad', 'Pasajero', 'Otro'];

    public const INCIDENT_WINDOW_DAYS = 7;

    public const VISIBLE_LOGS = ['registro', 'comentario', 'estado', 'resolucion'];

    public function __construct(private readonly TenantContext $context) {}

    public function rooming(SupplierAccount $account): array
    {
        $today = $this->today();
        $lists = (clone $account->roomingLists())->orderBy('l.check_in')
            ->get(['l.id', 'l.lock_version', 'l.reservation_id', 'l.check_in', 'l.check_out', 'l.status', 'l.sent_at', 'l.sent_version', 'l.hotel_ack_at', 'l.hotel_confirmed_at', 'r.code as reservation_code', 'r.title as reservation_title']);
        $ids = $lists->pluck('id')->all();
        $rooms = DB::table('ops_rooming_rooms as rr')->leftJoin('ops_incidents as i', 'i.id', '=', 'rr.incident_id')->whereIn('rr.rooming_list_id', $ids)->orderBy('rr.room_number')
            ->get(['rr.id', 'rr.rooming_list_id', 'rr.room_number', 'rr.room_type', 'rr.capacity', 'rr.status', 'rr.hotel_note', 'i.code as incident_code', 'i.status as incident_status'])->groupBy('rooming_list_id');
        $guests = DB::table('ops_rooming_guests as g')->join('booking_passengers as p', 'p.id', '=', 'g.passenger_id')->whereIn('g.rooming_list_id', $ids)->orderBy('p.seq')
            ->get(['g.room_id', 'p.full_name', 'p.pax_type'])->groupBy('room_id');
        $leads = $this->leads($lists->pluck('reservation_id')->unique()->all());

        $items = collect();

        foreach ($lists as $list) {
            $listRooms = [];
            $guestCount = 0;
            $observed = 0;

            foreach ($rooms->get($list->id, []) as $room) {
                $roomGuests = [];

                foreach ($guests->get($room->id, []) as $guest) {
                    $roomGuests[] = ['name' => $guest->full_name, 'type' => $guest->pax_type];
                }

                $guestCount += count($roomGuests);
                $observed += $room->status === 'observada' ? 1 : 0;
                $listRooms[] = [
                    'id' => $room->id,
                    'number' => $room->room_number,
                    'type' => $room->room_type,
                    'capacity' => (int) $room->capacity,
                    'status' => $room->status,
                    'note' => $room->hotel_note,
                    'incident' => $room->incident_code ? ['code' => $room->incident_code, 'status' => $room->incident_status] : null,
                    'guests' => $roomGuests,
                ];
            }

            $items->push([
                'id' => $list->id,
                'lock_version' => (int) $list->lock_version,
                'reservation' => $list->reservation_code,
                'holder' => $leads[$list->reservation_id] ?? Str::before((string) $list->reservation_title, ' — '),
                'check_in' => $list->check_in,
                'check_out' => $list->check_out,
                'nights' => (int) Carbon::parse($list->check_in)->diffInDays(Carbon::parse($list->check_out)),
                'days_to' => (int) Carbon::parse($today)->diffInDays(Carbon::parse($list->check_in), false),
                'in_house' => $list->check_in <= $today && $list->check_out > $today,
                'state' => $list->status === 'modificada' ? ($list->hotel_ack_at !== null && $list->hotel_confirmed_at === null ? 'recibida' : 'por_acusar') : ($list->hotel_confirmed_at !== null ? 'confirmada' : ($list->hotel_ack_at !== null ? 'recibida' : 'por_acusar')),
                'modified' => $list->status === 'modificada',
                'sent_at' => $this->iso($list->sent_at),
                'sent_version' => (int) $list->sent_version,
                'acknowledged_at' => $this->iso($list->hotel_ack_at),
                'confirmed_at' => $this->iso($list->hotel_confirmed_at),
                'guests' => $guestCount,
                'observed' => $observed,
                'rooms' => $listRooms,
            ]);
        }

        return [
            'today' => $today,
            'reasons' => self::OBSERVATION_REASONS,
            'impacts' => self::OBSERVATION_IMPACTS,
            'items' => $items->values(),
            'kpis' => [
                'arrivals_week' => $items->where('days_to', '>=', 0)->where('days_to', '<=', 7)->sum('guests'),
                'in_house' => $items->where('in_house', true)->sum('guests'),
                'observed' => $items->sum('observed'),
            ],
        ];
    }

    public function vouchers(SupplierAccount $account): array
    {
        $today = $this->today();
        $rows = (clone $account->vouchers())->orderByDesc('v.service_date')->orderBy('v.code')
            ->get(['v.code', 'v.lock_version', 'v.version', 'v.issued_at', 'v.service_label', 'v.service_date', 'v.pax', 'v.status', 'v.used_at', 'v.used_via', 'v.void_at', 'v.reservation_id', 'r.code as reservation_code', 'r.title as reservation_title']);
        $leads = $this->leads($rows->pluck('reservation_id')->unique()->all());
        $items = $rows->map(fn (object $row): array => [
            'code' => $row->code,
            'lock_version' => (int) $row->lock_version,
            'version' => (int) $row->version,
            'issued_at' => $this->iso($row->issued_at),
            'service' => $row->service_label,
            'reservation' => $row->reservation_code,
            'holder' => $leads[$row->reservation_id] ?? Str::before((string) $row->reservation_title, ' — '),
            'date' => $row->service_date,
            'days_to' => (int) Carbon::parse($today)->diffInDays(Carbon::parse($row->service_date), false),
            'pax' => (int) $row->pax,
            'status' => $row->status,
            'used_at' => $this->iso($row->used_at),
            'used_via' => $row->used_via,
            'void_at' => $this->iso($row->void_at),
        ])->values();

        return [
            'today' => $today,
            'early_days' => SupplierVouchers::EARLY_DAYS,
            'items' => $items,
            'kpis' => [
                'today' => $items->where('status', 'emitido')->where('date', $today)->count(),
                'used_month' => $items->where('status', 'utilizado')->filter(fn (array $item): bool => substr((string) $item['used_at'], 0, 7) === substr($today, 0, 7))->count(),
            ],
        ];
    }

    public function incidents(SupplierAccount $account): array
    {
        $rows = (clone $account->incidents())->orderByRaw("case when i.status in ('abierta','en_proceso') then 0 else 1 end")->orderByDesc('i.created_at')
            ->get(['i.id', 'i.code', 'i.title', 'i.type', 'i.severity', 'i.status', 'i.created_at', 'i.updated_at', 'i.reported_by', 'r.code as reservation_code']);
        $last = DB::table('ops_incident_logs')->whereIn('incident_id', $rows->pluck('id'))->whereIn('kind', self::VISIBLE_LOGS)->orderByDesc('created_at')->get(['incident_id', 'message', 'created_at'])->unique('incident_id')->keyBy('incident_id');
        $own = DB::table('iam_users')->where('provider_id', $account->id())->pluck('id')->map(fn (mixed $id): string => (string) $id)->all();

        return [
            'today' => $this->today(),
            'types' => self::INCIDENT_TYPES,
            'severities' => IncidentDirectory::SEVERITIES,
            'sla_hours' => IncidentDirectory::SLA_HOURS,
            'services' => $this->incidentServices($account),
            'items' => $rows->map(fn (object $row): array => [
                ...$this->incidentSummary($row),
                'own' => in_array((string) $row->reported_by, $own, true),
                'last' => isset($last[$row->id]) ? ['message' => $last[$row->id]->message, 'at' => $this->iso($last[$row->id]->created_at)] : null,
            ])->values(),
        ];
    }

    public function incident(SupplierAccount $account, string $code): array
    {
        $row = $account->incident($code);
        $agency = (string) $this->context->tenant()->commercial_name;
        $users = DB::table('iam_users')->whereIn('id', DB::table('ops_incident_logs')->where('incident_id', $row->id)->whereNotNull('user_id')->select('user_id'))->get(['id', 'name', 'provider_id'])->keyBy('id');
        $service = $row->reservation_service_id ? DB::table('booking_reservation_services')->where('id', $row->reservation_service_id)->where('provider_id', $account->id())->first(['code', 'name', 'service_date']) : null;

        return [
            ...$this->incidentSummary($row),
            'description' => $row->description,
            'resolution' => $row->resolution,
            'service' => $service ? ['code' => $service->code, 'name' => $service->name, 'date' => $service->service_date] : null,
            'logs' => DB::table('ops_incident_logs')->where('incident_id', $row->id)->where(fn ($query) => $query->whereIn('kind', self::VISIBLE_LOGS)->orWhere('visibility', 'proveedor'))->whereNot('kind', 'alerta')->orderBy('created_at')->get(['id', 'user_id', 'kind', 'message', 'created_at'])
                ->map(function (object $log) use ($users, $account, $agency): array {
                    $author = $log->user_id ? ($users[$log->user_id] ?? null) : null;
                    $mine = $author !== null && (string) $author->provider_id === $account->id();

                    return ['id' => $log->id, 'kind' => $log->kind, 'message' => $log->message, 'at' => $this->iso($log->created_at), 'mine' => $mine, 'author' => $mine ? $author->name : "Operaciones {$agency}"];
                })->values(),
        ];
    }

    public function openIncidents(SupplierAccount $account): int
    {
        return (clone $account->incidents())->whereIn('i.status', IncidentDirectory::OPEN)->count();
    }

    public function pendingRooming(SupplierAccount $account): int
    {
        return (clone $account->roomingLists())->whereNull('l.hotel_confirmed_at')->where('l.status', '<>', 'modificada')->count();
    }

    private function incidentServices(SupplierAccount $account): Collection
    {
        $from = Carbon::parse($this->today())->subDays(self::INCIDENT_WINDOW_DAYS)->toDateString();

        return (clone $account->services())->whereNotIn('s.status', ['cancelado', 'rechazado'])->where('s.service_date', '>=', $from)->orderBy('s.service_date')
            ->get(['s.code', 's.name', 's.service_date', 'r.code as reservation_code'])
            ->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name, 'hint' => "{$row->reservation_code} · {$row->service_date}"])->values();
    }

    private function incidentSummary(object $row): array
    {
        return [
            'code' => $row->code,
            'title' => $row->title,
            'type' => $row->type,
            'severity' => $row->severity,
            'status' => $row->status,
            'reservation' => $row->reservation_code,
            'created_at' => $this->iso($row->created_at),
            'updated_at' => $this->iso($row->updated_at),
            'can_comment' => in_array($row->status, IncidentDirectory::OPEN, true),
        ];
    }

    private function leads(array $reservationIds): Collection
    {
        return DB::table('booking_passengers')->whereIn('reservation_id', $reservationIds)->orderByDesc('is_lead')->orderBy('seq')->get(['reservation_id', 'full_name'])->unique('reservation_id')->pluck('full_name', 'reservation_id');
    }

    private function iso(?string $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toIso8601String();
    }

    private function today(): string
    {
        return Carbon::now($this->context->timezone())->toDateString();
    }
}
