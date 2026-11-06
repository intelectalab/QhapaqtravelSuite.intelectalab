<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class TravelDocDirectory
{
    public const LABELS = [
        'id_doc' => 'Documento de identidad',
        'visa' => 'Visa',
        'insurance' => 'Seguro de viaje',
        'yellow_fever' => 'Fiebre amarilla',
        'minor_auth' => 'Permiso de menor',
        'migration' => 'Tarjeta migratoria',
    ];

    public function __construct(private readonly OpsCommon $common) {}

    public function list(User $viewer): array
    {
        $reservations = $this->reservations($viewer)->orderBy('r.travel_from')->get(['r.id', 'r.code', 'r.title', 'r.status', 'r.travel_from', 'r.travel_to', 'c.name as client_name', 'u.name as owner_name']);
        $ids = $reservations->pluck('id');
        $items = DB::table('ops_travel_doc_items')->whereIn('reservation_id', $ids)->get(['reservation_id', 'status', 'expiry_date'])->groupBy('reservation_id');
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $ids)->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
        $attention = DB::table('ops_travel_doc_special as s')->join('booking_passengers as p', 'p.id', '=', 's.passenger_id')->whereIn('p.reservation_id', $ids)->where('s.requires_attention', true)
            ->selectRaw('p.reservation_id, count(*) as total')->groupBy('p.reservation_id')->pluck('total', 'reservation_id');
        $reminders = DB::table('ops_travel_doc_reminders')->whereIn('reservation_id', $ids)->selectRaw('reservation_id, max(sent_at) as last')->groupBy('reservation_id')->pluck('last', 'reservation_id');
        $today = $this->common->today();

        $rows = $reservations->map(function (object $row) use ($items, $passengers, $attention, $reminders, $today): array {
            $own = collect($items[$row->id] ?? []);
            $total = $own->count();
            $complete = $own->where('status', 'completo')->count();

            return [
                'code' => $row->code,
                'title' => $row->title,
                'status' => $row->status,
                'travel_from' => $row->travel_from,
                'travel_to' => $row->travel_to,
                'client' => $row->client_name,
                'owner' => $row->owner_name,
                'passengers' => (int) ($passengers[$row->id] ?? 0),
                'documents' => ['total' => $total, 'complete' => $complete, 'received' => $own->where('status', 'recibido')->count(), 'observed' => $own->where('status', 'observado')->count(), 'pending' => $own->where('status', 'pendiente')->count()],
                'progress' => $total > 0 ? (int) round($complete / $total * 100) : 0,
                'expired' => $own->filter(fn (object $item) => $item->expiry_date !== null && $item->expiry_date < $row->travel_to)->count(),
                'attention' => (int) ($attention[$row->id] ?? 0),
                'last_reminder' => $reminders[$row->id] ?? null,
                'days_to_travel' => (int) round((strtotime($row->travel_from) - strtotime($today)) / 86400),
            ];
        })->values();

        return [
            'today' => $today,
            'can' => ['manage' => $viewer->can('operations.travel_docs')],
            'kpis' => [
                'ready' => $rows->filter(fn (array $row) => $row['documents']['total'] > 0 && $row['progress'] === 100)->count(),
                'to_review' => $rows->sum(fn (array $row) => $row['documents']['received']),
                'observed' => $rows->sum(fn (array $row) => $row['documents']['observed'] + $row['expired']),
                'soon' => $rows->filter(fn (array $row) => $row['days_to_travel'] >= 0 && $row['days_to_travel'] <= 15 && $row['progress'] < 100)->count(),
            ],
            'items' => $rows,
        ];
    }

    public function find(User $viewer, string $code): ?array
    {
        $reservation = $this->reservations($viewer)->where('r.code', $code)->first(['r.id', 'r.code', 'r.title', 'r.status', 'r.travel_from', 'r.travel_to', 'c.name as client_name', 'u.name as owner_name']);

        if ($reservation === null) {
            return null;
        }

        $names = $this->common->userNames();
        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')->get(['id', 'full_name', 'pax_type', 'nationality', 'doc_type', 'doc_number', 'birth_date', 'is_lead']);
        $items = DB::table('ops_travel_doc_items')->where('reservation_id', $reservation->id)->get()->groupBy('passenger_id');
        $contacts = DB::table('ops_travel_doc_contacts')->whereIn('passenger_id', $passengers->pluck('id'))->get()->keyBy('passenger_id');
        $special = DB::table('ops_travel_doc_special')->whereIn('passenger_id', $passengers->pluck('id'))->get()->keyBy('passenger_id');

        return [
            'code' => $reservation->code,
            'title' => $reservation->title,
            'status' => $reservation->status,
            'travel_from' => $reservation->travel_from,
            'travel_to' => $reservation->travel_to,
            'client' => $reservation->client_name,
            'owner' => $reservation->owner_name,
            'today' => $this->common->today(),
            'can' => ['manage' => $viewer->can('operations.travel_docs')],
            'labels' => self::LABELS,
            'passengers' => $passengers->map(fn (object $passenger): array => [
                'id' => $passenger->id,
                'name' => $passenger->full_name,
                'pax_type' => $passenger->pax_type,
                'nationality' => $passenger->nationality,
                'is_lead' => (bool) $passenger->is_lead,
                'documents' => collect($items[$passenger->id] ?? [])->sortBy(fn ($item) => array_search($item->doc_type, array_keys(self::LABELS), true))->map(fn ($item) => [
                    'id' => $item->id,
                    'type' => $item->doc_type,
                    'label' => self::LABELS[$item->doc_type] ?? $item->doc_type,
                    'status' => $item->status,
                    'number' => $item->doc_number,
                    'expiry' => $item->expiry_date,
                    'expires_before_return' => $item->expiry_date !== null && $item->expiry_date < $reservation->travel_to,
                    'file' => $item->file_name,
                    'observation' => $item->observation,
                    'note' => $item->note,
                    'validated_by' => $item->validated_by ? ($names[$item->validated_by] ?? null) : null,
                    'validated_at' => $item->validated_at,
                ])->values(),
                'contact' => isset($contacts[$passenger->id]) ? ['name' => $contacts[$passenger->id]->name, 'phone' => $contacts[$passenger->id]->phone, 'relation' => $contacts[$passenger->id]->relation] : null,
                'attention' => isset($special[$passenger->id]) ? ['flag' => (bool) $special[$passenger->id]->requires_attention, 'note' => $special[$passenger->id]->operational_note] : null,
            ])->values(),
            'reminders' => DB::table('ops_travel_doc_reminders')->where('reservation_id', $reservation->id)->orderByDesc('sent_at')->get(['sent_at', 'channels', 'recipient', 'trigger', 'days_before', 'sent_by'])
                ->map(fn (object $reminder): array => ['at' => $reminder->sent_at, 'channel' => $reminder->channels, 'to' => $reminder->recipient, 'trigger' => $reminder->trigger, 'days_before' => $reminder->days_before, 'by' => $reminder->sent_by ? ($names[$reminder->sent_by] ?? null) : 'Sistema'])->values(),
        ];
    }

    private function reservations(User $viewer): Builder
    {
        return DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->join('iam_users as u', 'u.id', '=', 'r.owner_id')
            ->whereNull('r.deleted_at')
            ->whereNotIn('r.status', ['cancelada'])
            ->whereExists(fn ($query) => $query->from('ops_travel_doc_items as i')->whereColumn('i.reservation_id', 'r.id'))
            ->when(! $viewer->can('operations.travel_docs'), fn (Builder $query) => $query->where('r.owner_id', $viewer->getKey()));
    }
}
