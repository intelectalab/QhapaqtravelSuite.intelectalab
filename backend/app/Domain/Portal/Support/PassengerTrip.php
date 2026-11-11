<?php

declare(strict_types=1);

namespace App\Domain\Portal\Support;

use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Documents\Actions\ClientDocuments;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class PassengerTrip
{
    public const ALERT_TYPES = ['Transporte', 'Horario'];

    public const SECTIONS = [
        'hotels' => ['alojamiento'],
        'transport' => ['traslado', 'tren_entrada'],
        'activities' => ['tour', 'libre'],
    ];

    public function __construct(private readonly ChannelKit $kit, private readonly PortalDirectory $directory, private readonly AuditLogger $audit) {}

    public function reservation(PortalAccount $account, ?string $code = null): stdClass
    {
        if ($code !== null && $code !== '') {
            return $account->reservation($code);
        }

        $today = $this->kit->today();
        $rows = $account->reservations()->reject(fn (stdClass $row): bool => $row->status === 'cancelada');
        $row = $rows->first(fn (stdClass $row): bool => $row->travel_from <= $today && $row->travel_to >= $today)
            ?? $rows->sortBy('travel_from')->first(fn (stdClass $row): bool => $row->travel_from > $today)
            ?? $rows->first();

        return $row ?? throw ApiException::forbidden('PPX-BR-01', 'No encontramos un viaje vinculado a tu cuenta.');
    }

    public function trip(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);
        $detail = $this->directory->trip($account, (string) $reservation->code);
        $today = $detail['today'];
        $from = Carbon::parse($reservation->travel_from);
        $services = collect($detail['days'])->flatMap(fn (array $day): array => collect($day['services'])->map(fn (array $service): array => [...$service, 'date' => $day['date']])->all());
        $inside = $today >= $reservation->travel_from && $today <= $reservation->travel_to;

        return [
            'today' => $today,
            'code' => $reservation->code,
            'title' => $reservation->title,
            'status' => $reservation->status,
            'phase' => $detail['phase'],
            'from' => $reservation->travel_from,
            'to' => $reservation->travel_to,
            'day' => $inside ? (int) $from->diffInDays(Carbon::parse($today)) + 1 : null,
            'days_total' => (int) $from->diffInDays(Carbon::parse($reservation->travel_to)) + 1,
            'days_left' => $detail['days_left'],
            'today_services' => $services->where('date', $today)->values()->all(),
            'next' => $services->first(fn (array $service): bool => $service['date'] > $today || ($service['date'] === $today && $service['state'] !== 'completado')),
            'passengers' => $detail['passengers'],
            'advisor' => $detail['advisor'],
            'alerts' => count($this->incidents($reservation)->reject(fn (stdClass $row): bool => (bool) $row->acked)),
        ];
    }

    public function itinerary(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);
        $today = $this->kit->today();
        $from = Carbon::parse($reservation->travel_from);
        $services = $this->services($reservation);

        return [
            'code' => $reservation->code,
            'days' => $services->groupBy('service_date')->map(fn (Collection $group, string $date): array => [
                'date' => $date,
                'number' => (int) $from->diffInDays(Carbon::parse($date), false) + 1,
                'services' => $group->map(fn (stdClass $row): array => $this->service($row, $today, (string) $reservation->travel_to))->values()->all(),
            ])->values()->all(),
        ];
    }

    public function section(PortalAccount $account, string $section, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);
        $today = $this->kit->today();

        return [
            'code' => $reservation->code,
            'section' => $section,
            'items' => $this->services($reservation)->whereIn('service_kind', self::SECTIONS[$section])
                ->map(fn (stdClass $row): array => $this->service($row, $today, (string) $reservation->travel_to))->values()->all(),
        ];
    }

    public function vouchers(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);

        return ['code' => $reservation->code, 'items' => $this->voucherRows($reservation)->map(fn (stdClass $row): array => $this->voucherSummary($row))->values()->all()];
    }

    public function voucher(PortalAccount $account, string $voucher): array
    {
        $ids = $account->reservations()->pluck('id')->all();
        $row = DB::table('ops_vouchers as v')->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')->whereIn('v.reservation_id', $ids)->where('v.code', $voucher)->where('v.status', '<>', 'anulado')
            ->first(['v.id', 'v.code', 'v.service_label', 'v.service_date', 'v.status', 'v.version', 'v.pax', 'v.reservation_service_id', 'r.code as reservation'])
            ?? throw ApiException::notFound('No encontramos ese voucher en tu viaje.');
        $service = $row->reservation_service_id ? DB::table('booking_reservation_services')->where('id', $row->reservation_service_id)->first(['name', 'service_time', 'confirmation_code', 'service_kind']) : null;
        $this->audit->log('Voucher', (string) $row->code, 'abrir_portal_pasajero', after: (string) $account->user->code);

        return [
            ...$this->voucherSummary($row),
            'reservation' => $row->reservation,
            'service' => $service ? ['name' => $service->name, 'time' => $service->service_time ? substr((string) $service->service_time, 0, 5) : null, 'confirmation' => $service->confirmation_code, 'kind' => $service->service_kind] : null,
            'pdf' => "vouchers/{$row->code}",
        ];
    }

    public function documents(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);
        $policy = DB::table('booking_reservations')->where('id', $reservation->id)->value('policies_snapshot');
        $policies = is_string($policy) ? (json_decode($policy, true) ?: []) : [];
        $invoices = $account->isPassenger() ? collect() : DB::table('fin_invoices')->where('reservation_id', $reservation->id)->whereNotIn('status', ['pendiente_envio', 'anulado'])->orderBy('issue_date')->get(['number', 'doc_type', 'issue_date', 'status']);

        return [
            'code' => $reservation->code,
            'items' => [
                ['kind' => ClientDocuments::ITINERARY, 'label' => 'Itinerario del viaje', 'available' => true],
                ['kind' => ClientDocuments::CONFIRMATION, 'label' => 'Confirmación de la reserva', 'available' => ! in_array($reservation->status, ['borrador', 'pendiente_pago'], true)],
                ...$this->voucherRows($reservation)->map(fn (stdClass $row): array => ['kind' => ClientDocuments::VOUCHER, 'code' => $row->code, 'label' => "Voucher · {$row->service_label}", 'available' => true])->all(),
            ],
            'invoices' => $invoices->map(fn (stdClass $row): array => ['number' => $row->number, 'type' => $row->doc_type, 'date' => $row->issue_date, 'status' => $row->status])->values()->all(),
            'policy' => [
                'cancellation' => $policies['cancellation'] ?? null,
                'tiers' => $policies['penalty_tiers'] ?? [],
            ],
        ];
    }

    public function alerts(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);
        $notices = DB::table('notif_pax_messages')->where('reservation_id', $reservation->id)->whereIn('status', ['enviado', 'entregado', 'leido'])->orderByDesc('sent_at')->limit(20)->get(['code', 'subject', 'body', 'sent_at', 'channel']);

        return [
            'code' => $reservation->code,
            'alerts' => $this->incidents($reservation)->map(fn (stdClass $row): array => [
                'id' => $row->id,
                'code' => $row->code,
                'type' => $row->type,
                'severity' => $row->severity,
                'title' => $row->public_title ?: $row->title,
                'message' => $row->public_message,
                'at' => Carbon::parse($row->created_at)->toIso8601String(),
                'acked' => (bool) $row->acked,
            ])->values()->all(),
            'notices' => $notices->map(fn (stdClass $row): array => ['code' => $row->code, 'subject' => $row->subject, 'body' => $row->body, 'at' => $row->sent_at, 'channel' => $row->channel])->values()->all(),
        ];
    }

    public function incidents(stdClass $reservation): Collection
    {
        return DB::table('ops_incidents as i')
            ->where('i.reservation_id', $reservation->id)->whereIn('i.type', self::ALERT_TYPES)->whereIn('i.status', ['abierta', 'en_proceso'])
            ->orderByDesc('i.created_at')
            ->get(['i.id', 'i.code', 'i.type', 'i.severity', 'i.title', 'i.public_title', 'i.public_message', 'i.created_at', 'i.assignee_id'])
            ->map(function (stdClass $row): stdClass {
                $row->acked = DB::table('ops_incident_pax_acks')->where('incident_id', $row->id)->exists();

                return $row;
            });
    }

    public function contacts(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);
        $today = $this->kit->today();
        $general = DB::table('sys_settings')->where('section', 'general')->value('values');
        $general = is_string($general) ? (json_decode($general, true) ?: []) : [];
        $sede = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->first(['name', 'phone', 'address']);
        $coordinator = DB::table('ops_orders as o')->join('iam_users as u', 'u.id', '=', 'o.coordinator_id')->where('o.reservation_id', $reservation->id)->where('o.status', '<>', 'cancelada')->first(['u.name', 'u.phone', 'u.email']);
        $guide = $this->services($reservation)->first(fn (stdClass $row): bool => $row->service_date >= $today && $row->guide !== null);

        return [
            'code' => $reservation->code,
            'emergency' => ['label' => 'Emergencias 24/7', 'phone' => $general['emergency_phone'] ?? $general['phone'] ?? $sede?->phone, 'office' => $sede ? ['name' => $sede->name, 'phone' => $sede->phone, 'address' => $sede->address] : null],
            'coordinator' => $coordinator ? ['name' => $coordinator->name, 'phone' => $coordinator->phone, 'email' => $coordinator->email] : null,
            'advisor' => $this->directory->trip($account, (string) $reservation->code)['advisor'],
            'guide' => $guide ? ['name' => $guide->guide, 'phone' => $guide->guide_phone, 'service' => $guide->name, 'date' => $guide->service_date] : null,
        ];
    }

    public function messages(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->reservation($account, $code);
        $rows = DB::table('channel_trip_messages as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.sender_user_id')->where('m.reservation_id', $reservation->id)->orderBy('m.created_at')
            ->get(['m.id', 'm.sender_type', 'm.body', 'm.read_at', 'm.created_at', 'm.sender_user_id', 'u.name as sender']);

        return [
            'code' => $reservation->code,
            'unread' => $rows->filter(fn (stdClass $row): bool => $row->sender_type !== 'passenger' && $row->read_at === null)->count(),
            'items' => $rows->map(fn (stdClass $row): array => [
                'id' => $row->id,
                'from' => $row->sender_type,
                'sender' => $row->sender_type === 'passenger' ? ($row->sender_user_id === $account->user->getKey() ? 'Tú' : $row->sender) : ($row->sender ?? 'Agencia'),
                'body' => $row->body,
                'read' => $row->read_at !== null,
                'at' => Carbon::parse($row->created_at)->toIso8601String(),
            ])->values()->all(),
        ];
    }

    private function services(stdClass $reservation): Collection
    {
        return DB::table('booking_reservation_services as s')
            ->leftJoin('ops_assignments as a', 'a.reservation_service_id', '=', 's.id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->where('s.reservation_id', $reservation->id)->whereNotIn('s.status', ['cancelado', 'rechazado'])->whereNull('s.replaced_by_id')
            ->orderBy('s.service_date')->orderByRaw('s.service_time nulls last')->orderBy('s.code')
            ->get(['s.code', 's.name', 's.service_date', 's.service_time', 's.service_kind', 's.status', 's.pax', 's.nights', 's.confirmation_code', 'g.full_name as guide', 'g.phone as guide_phone', 'd.full_name as driver', 'v.plate']);
    }

    private function service(stdClass $row, string $today, string $tripEnd): array
    {
        return [
            'code' => $row->code,
            'name' => $row->name,
            'date' => $row->service_date,
            'time' => $row->service_time ? substr((string) $row->service_time, 0, 5) : null,
            'kind' => $row->service_kind,
            'status' => $row->status,
            'state' => PortalDirectory::serviceState($row, $today, $tripEnd),
            'pax' => (int) $row->pax,
            'nights' => $row->nights !== null ? (int) $row->nights : null,
            'confirmation' => $row->confirmation_code,
            'guide' => $row->guide,
            'driver' => $row->driver,
            'vehicle' => $row->plate,
        ];
    }

    private function voucherRows(stdClass $reservation): Collection
    {
        return DB::table('ops_vouchers')->where('reservation_id', $reservation->id)->where('status', '<>', 'anulado')->orderBy('service_date')
            ->get(['code', 'service_label', 'service_date', 'status', 'version', 'pax']);
    }

    private function voucherSummary(stdClass $row): array
    {
        return ['code' => $row->code, 'label' => $row->service_label, 'date' => $row->service_date, 'status' => $row->status, 'version' => (int) $row->version, 'pax' => (int) $row->pax];
    }
}
