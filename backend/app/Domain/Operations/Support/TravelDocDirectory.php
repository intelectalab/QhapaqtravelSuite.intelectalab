<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Jobs\RemindTravelDocuments;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TravelDocDirectory
{
    public const LOG_ACTIONS = [
        'cargar' => 'Cargó el archivo',
        'reemplazar_archivo' => 'Reemplazó el archivo',
        'validar' => 'Validó',
        'observar' => 'Observó',
        'registrar_contacto' => 'Registró el contacto de emergencia',
        'declarar_atencion' => 'Declaró la atención especial',
        'solicitar_documentos' => 'Solicitó documentos al cliente',
    ];

    public const LABELS = [
        'id_doc' => 'Documento de identidad',
        'visa' => 'Visa',
        'insurance' => 'Seguro de viaje',
        'yellow_fever' => 'Fiebre amarilla',
        'minor_auth' => 'Permiso de menor',
        'migration' => 'Tarjeta migratoria',
        'emergency' => 'Contacto de emergencia',
        'special' => 'Atención especial',
    ];

    public const FILE_TYPES = ['id_doc', 'visa', 'insurance', 'yellow_fever', 'minor_auth', 'migration'];

    public const SECTION = TravelDocRules::SECTION;

    public const NOMINATIVE = '(machu|huayna)\s*picchu';

    public function __construct(private readonly OpsCommon $common, private readonly TravelDocRules $rules) {}

    public function list(User $viewer): array
    {
        $reservations = $this->reservations($viewer)->orderBy('r.travel_from')->get(['r.id', 'r.code', 'r.title', 'r.status', 'r.travel_from', 'r.travel_to', 'c.name as client_name', 'u.name as owner_name']);
        $ids = $reservations->pluck('id');
        $effective = $this->effective($reservations);
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $ids)->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
        $attention = DB::table('ops_travel_doc_special as s')->join('booking_passengers as p', 'p.id', '=', 's.passenger_id')->whereIn('p.reservation_id', $ids)->where('s.requires_attention', true)
            ->selectRaw('p.reservation_id, count(*) as total')->groupBy('p.reservation_id')->pluck('total', 'reservation_id');
        $reminders = DB::table('ops_travel_doc_reminders')->whereIn('reservation_id', $ids)->selectRaw('reservation_id, max(sent_at) as last')->groupBy('reservation_id')->pluck('last', 'reservation_id');
        $today = $this->common->today();

        $people = $this->passengers($reservations, $effective);
        $entries = DB::table('booking_reservation_services')->whereIn('reservation_id', $ids)->where('status', '<>', 'cancelado')->where('name', '~*', self::NOMINATIVE)
            ->orderBy('service_date')->get(['reservation_id', 'code', 'name', 'service_date', 'pax'])->groupBy('reservation_id');

        $rows = $reservations->map(function (object $row) use ($effective, $passengers, $attention, $reminders, $today, $people, $entries): array {
            $own = $effective->where('reservation_id', $row->id)->where('state', '<>', 'no_aplica');
            $total = $own->count();
            $complete = $own->where('state', 'completo')->count();

            return [
                'code' => $row->code,
                'title' => $row->title,
                'status' => $row->status,
                'travel_from' => $row->travel_from,
                'travel_to' => $row->travel_to,
                'client' => $row->client_name,
                'owner' => $row->owner_name,
                'passengers' => (int) ($passengers[$row->id] ?? 0),
                'documents' => ['total' => $total, 'complete' => $complete, 'received' => $own->where('state', 'recibido')->count(), 'observed' => $own->where('state', 'observado')->count(), 'pending' => $own->where('state', 'pendiente')->count()],
                'progress' => $total > 0 ? (int) round($complete / $total * 100) : 0,
                'expired' => $own->where('state', 'vencido')->count(),
                'attention' => (int) ($attention[$row->id] ?? 0),
                'last_reminder' => $reminders[$row->id] ?? null,
                'days_to_travel' => (int) round((strtotime($row->travel_from) - strtotime($today)) / 86400),
                'mapi' => $this->mapi(collect($entries[$row->id] ?? []), $people->where('reservation', $row->code), $today),
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
            'passengers' => $people->map(fn (array $person): array => array_diff_key($person, ['blocking' => true]))->values(),
        ];
    }

    public function gate(string $code): array
    {
        $reservation = DB::table('booking_reservations')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'status'])
            ?? throw ApiException::notFound('La reserva no existe.');
        $mapi = $this->mapiFor($reservation);
        $missing = $mapi === null ? [] : $this->blocking((string) $reservation->id);

        return [
            'code' => $reservation->code,
            'status' => $reservation->status,
            'applies' => $mapi !== null,
            'blocked' => $missing !== [],
            'missing' => $missing,
            'services' => $mapi['services'] ?? [],
            'rule' => 'DOC-BR-010: no se emite el voucher de una entrada nominativa sin documentos validados.',
        ];
    }

    public function blocking(string $reservationId): array
    {
        $reservation = DB::table('booking_reservations')->where('id', $reservationId)->first(['id', 'code', 'title', 'travel_from', 'travel_to']);

        if ($reservation === null) {
            return [];
        }

        $reservations = collect([$reservation]);

        return $this->passengers($reservations, $this->effective($reservations))
            ->map(fn (array $person): array => ['name' => $person['name'], 'documents' => $person['blocking'] !== [] ? $person['blocking'] : ($person['identity'] === null ? [self::LABELS['id_doc']] : [])])
            ->filter(fn (array $person): bool => $person['documents'] !== [])->values()->all();
    }

    public function rules(): array
    {
        return [...$this->settings(), 'job' => $this->job(), 'rules' => $this->ruleTexts($this->settings())];
    }

    public function settings(): array
    {
        return $this->rules->settings();
    }

    private function ruleTexts(array $settings): array
    {
        $visa = $settings['visa_nationalities'] === [] ? 'ninguna nacionalidad configurada' : implode(', ', $settings['visa_nationalities']);

        return [
            ['code' => 'DOC-BR-001', 'text' => "Extranjero: el pasaporte debe vencer al menos {$settings['passport_months']} meses después del fin del viaje; si no, queda vencido."],
            ['code' => 'DOC-BR-002', 'text' => 'Peruano: el DNI o pasaporte debe estar vigente al terminar el viaje.'],
            ['code' => 'DOC-BR-003', 'text' => "La visa solo se pide a las nacionalidades configuradas ({$visa})."],
            ['code' => 'DOC-BR-004', 'text' => 'El seguro de viaje es obligatorio para extranjeros'.($settings['insurance_trekking'] ? ' y para todo pasajero en programas de trekking o altura (categoría Aventura).' : '.')],
            ['code' => 'DOC-BR-005', 'text' => 'La vacuna contra la fiebre amarilla es obligatoria si la reserva incluye un programa en la Amazonía (Loreto o Madre de Dios) o si el producto la pide como requisito.'],
            ['code' => 'DOC-BR-006', 'text' => 'Los menores necesitan autorización de viaje; validarla exige el archivo.'],
            ['code' => 'DOC-BR-008', 'text' => 'Cada pasajero tiene un contacto de emergencia con nombre y teléfono.'],
            ['code' => 'DOC-BR-009', 'text' => 'La atención especial registra solo la indicación operativa, sin diagnósticos ni términos clínicos.'],
            ['code' => 'DOC-BR-010', 'text' => 'Las entradas nominativas a Machu Picchu esperan la identidad validada de cada pasajero y, en menores, su permiso de viaje.'],
            ['code' => 'DOC-BR-012', 'text' => 'Ventas consulta y solicita documentos solo de sus reservas; Operaciones carga, valida y observa.'],
        ];
    }

    private function job(): ?array
    {
        $job = DB::table('sys_scheduled_jobs')->where('code', RemindTravelDocuments::CODE)->first(['id', 'name', 'cron_label', 'paused', 'last_run_at', 'next_run_at', 'last_status', 'last_result']);

        return $job ? ['id' => $job->id, 'name' => $job->name, 'schedule' => $job->cron_label, 'paused' => (bool) $job->paused, 'last_run_at' => $job->last_run_at, 'next_run_at' => $job->next_run_at, 'last_status' => $job->last_status, 'last_result' => $job->last_result] : null;
    }

    private function effective(Collection $reservations): Collection
    {
        $byId = $reservations->keyBy('id');
        $settings = $this->settings();
        $items = DB::table('ops_travel_doc_items')->whereIn('reservation_id', $byId->keys())->get();
        $people = DB::table('booking_passengers')->whereIn('id', $items->pluck('passenger_id')->unique())->get(['id', 'nationality', 'pax_type', 'birth_date'])->keyBy('id');
        $contacts = DB::table('ops_travel_doc_contacts')->whereIn('passenger_id', $people->keys())->pluck('passenger_id')->flip();
        $special = DB::table('ops_travel_doc_special')->whereIn('passenger_id', $people->keys())->pluck('passenger_id')->flip();
        $trekking = $this->rules->trekking($byId->keys());
        $amazon = $this->rules->amazon($byId->keys());

        return $items->map(function (object $item) use ($byId, $people, $contacts, $special, $trekking, $amazon, $settings): object {
            $reservation = $byId[$item->reservation_id];
            $person = $people[$item->passenger_id] ?? (object) [];
            $item->state = $this->state($item, $person, $reservation, $trekking->has($item->reservation_id), $settings, $contacts->has($item->passenger_id), $special->has($item->passenger_id), $amazon->has($item->reservation_id));
            $item->min_expiry = $item->doc_type === 'id_doc' ? $this->rules->minExpiry($person, (string) $reservation->travel_to, $settings) : null;

            return $item;
        });
    }

    private function state(object $item, object $person, object $reservation, bool $trekking, array $settings, bool $contact, bool $special, bool $amazon = false): string
    {
        if (! $this->rules->applies((string) $item->doc_type, $person, $reservation->travel_from, $trekking, $settings, $amazon)) {
            return 'no_aplica';
        }

        return match (true) {
            $item->doc_type === 'emergency' => $contact ? 'completo' : 'pendiente',
            $item->doc_type === 'special' => $special ? 'completo' : 'pendiente',
            $item->doc_type === 'id_doc' && $item->expiry_date !== null && $item->status !== 'observado' && $item->expiry_date < $this->rules->minExpiry($person, (string) $reservation->travel_to, $settings) => 'vencido',
            $item->expiry_date !== null && $item->status !== 'observado' && $item->expiry_date < $reservation->travel_to => 'vencido',
            default => (string) $item->status,
        };
    }

    private function passengers(Collection $reservations, Collection $effective): Collection
    {
        $byId = $reservations->keyBy('id');
        $people = DB::table('booking_passengers')->whereIn('reservation_id', $byId->keys())->orderBy('seq')->get(['id', 'reservation_id', 'full_name', 'pax_type', 'nationality', 'doc_type', 'doc_number', 'is_lead']);
        $items = $effective->where('state', '<>', 'no_aplica')->groupBy('passenger_id');
        $special = DB::table('ops_travel_doc_special')->whereIn('passenger_id', $people->pluck('id'))->where('requires_attention', true)->pluck('passenger_id')->flip();

        return $people->map(function ($person) use ($byId, $items, $special) {
            $reservation = $byId[$person->reservation_id];
            $docs = collect($items[$person->id] ?? []);
            $identity = $docs->firstWhere('doc_type', 'id_doc');
            $missing = $docs->filter(fn (object $item): bool => $item->state !== 'completo')->map(fn ($item) => ['label' => self::LABELS[$item->doc_type] ?? $item->doc_type, 'status' => $item->state])->values();
            $blocking = $docs->filter(fn (object $item): bool => in_array($item->doc_type, ['id_doc', 'minor_auth'], true) && $item->state !== 'completo')
                ->map(fn (object $item): string => self::LABELS[$item->doc_type])->values()->all();

            return [
                'id' => $person->id,
                'name' => $person->full_name,
                'pax_type' => $person->pax_type,
                'minor' => in_array($person->pax_type, ['CHD', 'INF'], true),
                'nationality' => $person->nationality,
                'is_lead' => (bool) $person->is_lead,
                'doc' => $person->doc_number ? trim("{$person->doc_type} {$person->doc_number}") : null,
                'identity' => $identity ? ['status' => $identity->state, 'expiry' => $identity->expiry_date] : null,
                'missing' => $missing,
                'attention' => isset($special[$person->id]),
                'status' => match (true) {
                    $docs->isEmpty() => 'pendiente',
                    $docs->contains('state', 'vencido') => 'vencido',
                    $docs->contains('state', 'observado') => 'observado',
                    $docs->every(fn (object $item): bool => $item->state === 'completo') => 'completo',
                    default => 'pendiente',
                },
                'reservation' => $reservation->code,
                'reservation_title' => $reservation->title,
                'travel_from' => $reservation->travel_from,
                'blocking' => $blocking,
            ];
        });
    }

    private function mapiFor(object $reservation): ?array
    {
        $entries = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->where('status', '<>', 'cancelado')->where('name', '~*', self::NOMINATIVE)
            ->orderBy('service_date')->get(['reservation_id', 'code', 'name', 'service_date', 'pax']);

        if ($entries->isEmpty()) {
            return null;
        }

        $reservations = DB::table('booking_reservations')->where('id', $reservation->id)->get(['id', 'code', 'title', 'travel_from', 'travel_to']);

        return $this->mapi($entries, $this->passengers($reservations, $this->effective($reservations)), $this->common->today());
    }

    private function mapi(Collection $entries, Collection $people, string $today): ?array
    {
        if ($entries->isEmpty()) {
            return null;
        }

        $missing = $people->filter(fn (array $person): bool => $person['blocking'] !== [])->map(fn (array $person): array => ['name' => $person['name'], 'documents' => $person['blocking']])->values();

        return [
            'services' => $entries->map(fn ($entry) => ['code' => $entry->code, 'name' => $entry->name, 'date' => $entry->service_date, 'pax' => $entry->pax !== null ? (int) $entry->pax : null])->values(),
            'used' => $entries->every(fn (object $entry): bool => $entry->service_date < $today),
            'blocked' => $missing->isNotEmpty(),
            'missing' => $missing,
        ];
    }

    public function find(User $viewer, string $code): ?array
    {
        $reservation = $this->reservations($viewer)->where('r.code', $code)->first(['r.id', 'r.code', 'r.title', 'r.status', 'r.travel_from', 'r.travel_to', 'r.owner_id', 'c.name as client_name', 'c.email as client_email', 'c.phone as client_phone', 'u.name as owner_name']);

        if ($reservation === null) {
            return null;
        }

        $names = $this->common->userNames();
        $settings = $this->settings();
        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')->get(['id', 'full_name', 'pax_type', 'nationality', 'doc_type', 'doc_number', 'birth_date', 'is_lead']);
        $items = $this->effective(collect([$reservation]))->groupBy('passenger_id');
        $contacts = DB::table('ops_travel_doc_contacts')->whereIn('passenger_id', $passengers->pluck('id'))->get()->keyBy('passenger_id');
        $special = DB::table('ops_travel_doc_special')->whereIn('passenger_id', $passengers->pluck('id'))->get()->keyBy('passenger_id');
        $pending = $items->flatten(1)->whereIn('state', ['pendiente', 'observado', 'vencido'])->count();

        return [
            'code' => $reservation->code,
            'title' => $reservation->title,
            'status' => $reservation->status,
            'travel_from' => $reservation->travel_from,
            'travel_to' => $reservation->travel_to,
            'client' => $reservation->client_name,
            'owner' => $reservation->owner_name,
            'today' => $this->common->today(),
            'can' => ['manage' => $viewer->can('operations.travel_docs'), 'request' => $viewer->can('operations.travel_docs') || (string) $reservation->owner_id === (string) $viewer->getKey()],
            'labels' => self::LABELS,
            'settings' => $settings,
            'relations' => TravelDocRules::RELATIONS,
            'request' => ['email' => $reservation->client_email, 'phone' => $reservation->client_phone, 'channels' => $settings['channels'], 'pending' => $pending],
            'mapi' => $this->mapiFor($reservation),
            'passengers' => $passengers->map(fn (object $passenger): array => [
                'id' => $passenger->id,
                'name' => $passenger->full_name,
                'pax_type' => $passenger->pax_type,
                'nationality' => $passenger->nationality,
                'foreign' => TravelDocRules::foreign($passenger->nationality),
                'minor' => TravelDocRules::minor($passenger, $reservation->travel_from),
                'is_lead' => (bool) $passenger->is_lead,
                'documents' => collect($items[$passenger->id] ?? [])->where('state', '<>', 'no_aplica')->sortBy(fn ($item) => array_search($item->doc_type, array_keys(self::LABELS), true))->map(fn ($item) => [
                    'id' => $item->id,
                    'type' => $item->doc_type,
                    'kind' => match ($item->doc_type) {
                        'emergency' => 'contact',
                        'special' => 'attention',
                        default => 'file',
                    },
                    'label' => self::LABELS[$item->doc_type] ?? $item->doc_type,
                    'status' => $item->state,
                    'lock_version' => (int) $item->lock_version,
                    'number' => $item->doc_number,
                    'expiry' => $item->expiry_date,
                    'min_expiry' => $item->min_expiry,
                    'expires_before_return' => $item->state === 'vencido',
                    'file' => $item->file_name,
                    'has_file' => $item->file_id !== null,
                    'observation' => $item->observation,
                    'note' => $item->note,
                    'validated_by' => $item->validated_by ? ($names[$item->validated_by] ?? null) : null,
                    'validated_at' => $item->validated_at,
                ])->values(),
                'not_applicable' => collect($items[$passenger->id] ?? [])->where('state', 'no_aplica')->map(fn ($item) => self::LABELS[$item->doc_type] ?? $item->doc_type)->values(),
                'contact' => isset($contacts[$passenger->id]) ? ['name' => $contacts[$passenger->id]->name, 'phone' => $contacts[$passenger->id]->phone, 'relation' => $contacts[$passenger->id]->relation] : null,
                'attention' => isset($special[$passenger->id]) ? ['flag' => (bool) $special[$passenger->id]->requires_attention, 'note' => $special[$passenger->id]->operational_note] : null,
            ])->values(),
            'log' => DB::table('audit_events')->where('entity', 'Documento de viaje')->where(fn (Builder $query) => $query->where('entity_id', $reservation->code)->orWhere('entity_id', 'like', "{$reservation->code} · %"))
                ->orderByDesc('occurred_at')->limit(30)->get(['code', 'entity_id', 'action', 'before_value', 'after_value', 'actor_id', 'occurred_at'])
                ->map(fn (object $event): array => [
                    'code' => $event->code,
                    'passenger' => str_contains((string) $event->entity_id, ' · ') ? explode(' · ', (string) $event->entity_id, 2)[1] : null,
                    'action' => self::LOG_ACTIONS[$event->action] ?? str_replace('_', ' ', (string) $event->action),
                    'before' => $event->before_value,
                    'after' => $event->after_value,
                    'by' => $event->actor_id ? ($names[$event->actor_id] ?? null) : 'Sistema',
                    'at' => $event->occurred_at,
                ])->values(),
            'reminders' => DB::table('ops_travel_doc_reminders')->where('reservation_id', $reservation->id)->orderByDesc('sent_at')->get(['sent_at', 'channels', 'recipient', 'trigger', 'days_before', 'sent_by', 'items_count'])
                ->map(fn (object $reminder): array => ['at' => $reminder->sent_at, 'channel' => $reminder->channels, 'to' => $reminder->recipient, 'trigger' => $reminder->trigger, 'days_before' => $reminder->days_before, 'items' => (int) $reminder->items_count, 'by' => $reminder->sent_by ? ($names[$reminder->sent_by] ?? null) : 'Sistema'])->values(),
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
