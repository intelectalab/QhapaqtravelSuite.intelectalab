<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ClientDirectory
{
    private const COUNTED = ['confirmada', 'en_operacion', 'completada', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'incidencia', 'reprogramada'];

    private const DOC_LABELS = ['DNI' => 'DNI', 'RUC' => 'RUC', 'PASAPORTE' => 'Pasaporte', 'CE' => 'CE'];

    public function __construct(private readonly TenantContext $context) {}

    public function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }

    public function list(User $viewer): Collection
    {
        return $this->rows($viewer)->orderBy('c.name')->get()->map(fn (object $row) => $this->summary($row));
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->rows($viewer)->where('c.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $today = $this->today();
        $trips = $this->trips($row->id);
        $current = $trips->first(fn (array $trip) => $trip['from'] <= $today && $trip['to'] >= $today && $trip['status'] !== 'cancelada');
        $pending = DB::table('fin_receivables')->where('client_id', $row->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])
            ->get(['amount', 'paid_amount', 'fx_rate', 'status']);
        $toPen = fn (object $receivable) => ((float) $receivable->amount - (float) $receivable->paid_amount) * (float) ($receivable->fx_rate ?: 1);

        return [
            ...$this->summary($row),
            'tags' => $this->tags($row->tags),
            'birth_date' => $row->birth_date,
            'doc_type' => $row->doc_type,
            'doc_number' => $row->doc_number,
            'owner_id' => $row->owner_id,
            'trips' => $trips->values(),
            'quotes' => DB::table('quote_quotes')->where('client_id', $row->id)->whereNull('deleted_at')->orderByDesc('created_at')
                ->get(['code', 'title', 'status', 'valid_until']),
            'balance_pen' => (int) round($pending->sum($toPen)),
            'overdue_pen' => (int) round($pending->where('status', 'vencida')->sum($toPen)),
            'companions' => $this->companions($row->id, $row->name),
            'current_trip' => $current ? $this->currentTrip($current, $today) : null,
        ];
    }

    private function rows(User $viewer): Builder
    {
        $counted = "r.status in ('".implode("','", self::COUNTED)."')";
        $today = $this->today();

        $query = DB::table('crm_clients as c')
            ->join('iam_users as u', 'u.id', '=', 'c.owner_id')
            ->leftJoin('booking_reservations as r', fn ($join) => $join->on('r.client_id', '=', 'c.id')->whereNull('r.deleted_at'))
            ->whereNull('c.deleted_at')
            ->groupBy('c.id', 'u.id')
            ->select([
                'c.id', 'c.code', 'c.kind', 'c.name', 'c.doc_type', 'c.doc_number', 'c.email', 'c.phone', 'c.city', 'c.country',
                'c.segment_code', 'c.owner_id', 'c.nps_last', 'c.tags', 'c.birth_date', 'c.created_at', 'u.name as owner_name', 'u.avatar_color as owner_color',
            ])
            ->selectRaw("count(r.id) filter (where {$counted}) as trips")
            ->selectRaw("coalesce(sum(r.total_amount * r.fx_rate) filter (where {$counted}), 0) as total_pen")
            ->selectRaw("max(r.travel_from) filter (where {$counted}) as last_trip_from")
            ->selectRaw("coalesce(bool_or({$counted} and r.travel_from <= ?::date and r.travel_to >= ?::date), false) as on_trip", [$today, $today]);

        return Portfolio::scope($query, $viewer, 'c.owner_id');
    }

    private function summary(object $row): array
    {
        return [
            'code' => $row->code,
            'kind' => $row->kind,
            'name' => $row->name,
            'document' => (self::DOC_LABELS[$row->doc_type] ?? $row->doc_type).' '.$row->doc_number,
            'email' => $row->email,
            'phone' => $row->phone,
            'city' => $row->city,
            'country' => $row->country,
            'segment' => $row->segment_code,
            'owner' => ['name' => $row->owner_name, 'color' => $row->owner_color],
            'satisfaction' => $row->nps_last === null ? null : (int) $row->nps_last,
            'trips_count' => (int) $row->trips,
            'total_pen' => (int) round((float) $row->total_pen),
            'last_trip_from' => $row->last_trip_from,
            'on_trip' => (bool) $row->on_trip,
            'created_at' => Carbon::parse($row->created_at)->toDateString(),
        ];
    }

    private function trips(string $clientId): Collection
    {
        $reservations = DB::table('booking_reservations')->where('client_id', $clientId)->whereNull('deleted_at')->where('status', '<>', 'borrador')
            ->orderByDesc('travel_from')->get(['id', 'code', 'title', 'status', 'travel_from', 'travel_to', 'total_amount', 'fx_rate']);
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $reservations->pluck('id'))->orderBy('seq')->get(['reservation_id', 'full_name'])->groupBy('reservation_id');

        return $reservations->map(fn (object $reservation) => [
            'id' => $reservation->id,
            'code' => $reservation->code,
            'title' => $reservation->title,
            'status' => $reservation->status,
            'from' => $reservation->travel_from,
            'to' => $reservation->travel_to,
            'total_pen' => (int) round((float) $reservation->total_amount * (float) $reservation->fx_rate),
            'passengers' => ($passengers[$reservation->id] ?? collect())->pluck('full_name')->values(),
        ]);
    }

    private function companions(string $clientId, string $clientName): Collection
    {
        return DB::table('booking_passengers as p')
            ->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->where('r.client_id', $clientId)->whereNull('r.deleted_at')->where('r.status', '<>', 'borrador')
            ->where('p.full_name', '<>', $clientName)
            ->orderBy('p.full_name')
            ->get(['p.full_name', 'p.doc_type', 'p.doc_number', 'p.diet_notes'])
            ->unique('full_name')
            ->map(fn (object $passenger) => [
                'name' => $passenger->full_name,
                'document' => trim(($passenger->doc_type ?? '').' '.($passenger->doc_number ?? '')),
                'diet' => $passenger->diet_notes ?? '',
            ])
            ->values();
    }

    private function currentTrip(array $trip, string $today): array
    {
        $incident = DB::table('ops_incidents')->where('reservation_id', $trip['id'])->where('severity', 'critica')->whereNotIn('status', ['resuelta', 'cerrada'])
            ->orderByDesc('created_at')->first(['code', 'title', 'created_at']);
        $riskDay = $incident ? Carbon::parse($incident->created_at)->setTimezone($this->context->tenant()->timezone ?: 'America/Lima')->toDateString() : null;

        $days = [];
        for ($date = Carbon::parse($trip['from']); $date->lte(Carbon::parse($trip['to'])); $date->addDay()) {
            $iso = $date->toDateString();
            $days[] = ['date' => $iso, 'state' => $iso === $today ? 'today' : ($iso === $riskDay ? 'risk' : ($iso < $today ? 'done' : 'upcoming'))];
        }

        return [
            'trip' => $trip,
            'days' => $days,
            'day_number' => (int) Carbon::parse($trip['from'])->diffInDays(Carbon::parse($today)) + 1,
            'incident' => $incident ? ['code' => $incident->code, 'title' => $incident->title] : null,
        ];
    }

    private function tags(?string $raw): array
    {
        if ($raw === null || $raw === '{}') {
            return [];
        }

        return array_map(fn (string $tag) => trim($tag, '"'), str_getcsv(trim($raw, '{}')));
    }
}
