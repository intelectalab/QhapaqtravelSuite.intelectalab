<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Support;

use App\Domain\Channels\Support\ChannelKit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PassengerAppPreview
{
    public function __construct(private readonly ChannelKit $kit) {}

    public function show(?string $code): array
    {
        $today = $this->kit->today();
        $reservations = DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->whereNull('r.deleted_at')
            ->whereNotIn('r.status', ['cancelada', 'borrador'])
            ->orderBy('r.travel_from')
            ->get(['r.id', 'r.code', 'r.title', 'r.status', 'r.travel_from', 'r.travel_to', 'c.name as client']);
        $selected = $reservations->firstWhere('code', $code)
            ?? $reservations->firstWhere('status', 'en_operacion')
            ?? $reservations->first(fn (object $row): bool => $row->travel_to >= $today)
            ?? $reservations->last();

        return [
            'today' => $today,
            'reservations' => $reservations->map(fn (object $row): array => ['code' => $row->code, 'title' => $row->title, 'client' => $row->client, 'status' => $row->status, 'from' => $row->travel_from])->values(),
            'trip' => $selected ? $this->trip($selected, $today) : null,
        ];
    }

    private function trip(object $reservation, string $today): array
    {
        $services = DB::table('booking_reservation_services as s')
            ->leftJoin('ops_assignments as a', 'a.reservation_service_id', '=', 's.id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->where('s.reservation_id', $reservation->id)
            ->where('s.status', '<>', 'cancelado')
            ->orderBy('s.service_date')
            ->orderBy('s.service_time')
            ->get(['s.code', 's.name', 's.service_date', 's.service_time', 's.service_kind', 's.status', 's.confirmation_code', 'g.full_name as guide', 'g.phone as guide_phone', 'd.full_name as driver', 'v.plate']);
        $from = Carbon::parse($reservation->travel_from);
        $total = $from->diffInDays(Carbon::parse($reservation->travel_to)) + 1;
        $current = $today >= $reservation->travel_from && $today <= $reservation->travel_to ? (int) $from->diffInDays(Carbon::parse($today)) + 1 : null;
        $chat = DB::table('channel_trip_messages as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.sender_user_id')->where('m.reservation_id', $reservation->id)->orderBy('m.created_at')->get(['m.sender_type', 'm.body', 'm.created_at', 'u.name as sender']);
        $alerts = DB::table('ops_incidents')->where('reservation_id', $reservation->id)->whereIn('status', ['abierta', 'en_proceso'])->orderByDesc('created_at')->get(['code', 'type', 'severity', 'title', 'public_title', 'public_message', 'created_at']);
        $vouchers = DB::table('ops_vouchers')->where('reservation_id', $reservation->id)->where('status', '<>', 'anulado')->orderBy('service_date')->get(['code', 'service_label', 'service_date', 'status', 'version']);
        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')->get(['full_name', 'pax_type', 'is_lead']);
        $next = $services->first(fn (object $row): bool => $row->service_date >= $today && in_array($row->status, ['confirmado', 'solicitado', 'pendiente'], true));

        return [
            'code' => $reservation->code,
            'title' => $reservation->title,
            'client' => $reservation->client,
            'status' => $reservation->status,
            'from' => $reservation->travel_from,
            'to' => $reservation->travel_to,
            'day' => $current,
            'days_total' => $total,
            'next' => $next ? ['name' => $next->name, 'date' => $next->service_date, 'time' => $next->service_time ? substr((string) $next->service_time, 0, 5) : null] : null,
            'passengers' => $passengers->map(fn (object $row): array => ['name' => $row->full_name, 'type' => $row->pax_type, 'lead' => (bool) $row->is_lead])->values(),
            'itinerary' => $services->groupBy('service_date')->map(fn ($group, string $date): array => [
                'date' => $date,
                'day' => (int) $from->diffInDays(Carbon::parse($date)) + 1,
                'services' => $group->map(fn (object $row): array => [
                    'code' => $row->code,
                    'name' => $row->name,
                    'time' => $row->service_time ? substr((string) $row->service_time, 0, 5) : null,
                    'kind' => $row->service_kind,
                    'status' => $row->status,
                    'confirmation' => $row->confirmation_code,
                    'guide' => $row->guide,
                    'driver' => $row->driver,
                    'vehicle' => $row->plate,
                ])->values(),
            ])->values(),
            'chat' => $chat->map(fn (object $row): array => ['from' => $row->sender_type, 'sender' => $row->sender, 'body' => $row->body, 'at' => $row->created_at])->values(),
            'alerts' => $alerts->map(fn (object $row): array => ['code' => $row->code, 'type' => $row->type, 'severity' => $row->severity, 'title' => $row->public_title ?: $row->title, 'message' => $row->public_message, 'at' => $row->created_at])->values(),
            'vouchers' => $vouchers->map(fn (object $row): array => ['code' => $row->code, 'label' => $row->service_label, 'date' => $row->service_date, 'status' => $row->status, 'version' => (int) $row->version])->values(),
        ];
    }
}
