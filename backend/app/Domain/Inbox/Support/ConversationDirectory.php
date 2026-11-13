<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditTrail;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ConversationDirectory
{
    public const CHANNELS = ['whatsapp' => 'WhatsApp', 'email' => 'Email', 'webchat' => 'Chat web', 'form' => 'Formulario', 'portal' => 'Portal'];

    public const STATUSES = ['abierta' => 'Abierta', 'pendiente' => 'Esperando al cliente', 'resuelta' => 'Resuelta'];

    public const PRIORITIES = ['baja' => 'Baja', 'media' => 'Media', 'alta' => 'Alta', 'critica' => 'Crítica'];

    public const LINKS = [
        'client' => ['table' => 'crm_clients', 'column' => 'client_id', 'permission' => 'crm.clients.manage', 'name' => 'name', 'label' => 'cliente', 'entity' => 'El cliente'],
        'lead' => ['table' => 'crm_leads', 'column' => 'lead_id', 'permission' => 'crm.leads.manage', 'name' => 'full_name', 'label' => 'lead', 'entity' => 'El lead'],
        'reservation' => ['table' => 'booking_reservations', 'column' => 'reservation_id', 'permission' => 'reservations.view', 'name' => 'title', 'label' => 'reserva', 'entity' => 'La reserva'],
    ];

    private const AGENT_ROLES = ['tenant_admin', 'manager', 'sales', 'operations'];

    public function __construct(private readonly Advisors $advisors) {}

    public function overview(User $viewer): array
    {
        $rows = $this->scoped($viewer)
            ->leftJoin('iam_users as u', 'u.id', '=', 'c.assignee_id')
            ->orderByRaw("case c.status when 'abierta' then 0 when 'pendiente' then 1 else 2 end")
            ->orderByDesc('c.last_message_at')
            ->limit(200)
            ->get(['c.*', 'u.name as assignee_name']);
        $previews = DB::table('collab_messages')->whereIn('conversation_id', $rows->pluck('id'))->where('direction', '<>', 'system')
            ->orderByDesc('sent_at')->get(['conversation_id', 'body', 'direction'])->unique('conversation_id')->keyBy('conversation_id');
        $now = Carbon::now();
        $items = $rows->map(fn (object $row): array => $this->summary($row, $previews->get($row->id), $viewer));
        $responded = $rows->filter(fn (object $row): bool => $row->first_response_at !== null);
        $minutes = $responded->map(fn (object $row): float => Carbon::parse($row->created_at)->diffInMinutes(Carbon::parse($row->first_response_at)));

        return [
            'kpis' => [
                'open' => $rows->where('status', 'abierta')->count(),
                'unassigned' => $rows->whereNull('assignee_id')->where('status', 'abierta')->count(),
                'sla_breached' => $rows->filter(fn (object $row): bool => $row->status !== 'resuelta' && $row->first_response_at === null && Carbon::parse($row->first_response_due_at)->lt($now))->count(),
                'resolved_week' => $rows->filter(fn (object $row): bool => $row->resolved_at !== null && Carbon::parse($row->resolved_at)->gte($now->copy()->subDays(7)))->count(),
                'first_response_minutes' => $minutes->isEmpty() ? null : (int) round($minutes->avg()),
            ],
            'items' => $items->values(),
            'templates' => DB::table('collab_reply_templates')->whereNull('deleted_at')->where('is_active', true)->orderBy('code')
                ->get(['code', 'name', 'body', 'channels', 'is_whatsapp_approved'])
                ->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->name, 'body' => $row->body, 'channels' => $this->array($row->channels), 'whatsapp_approved' => (bool) $row->is_whatsapp_approved])->values(),
            'agents' => $viewer->can('crm.records.reassign') ? $this->advisors->all(self::AGENT_ROLES)->values() : [],
            'can' => [
                'manage' => $viewer->can('inbox.manage'),
                'reassign' => self::canReassign($viewer),
                'quote' => $viewer->can('inbox.manage') && $viewer->can('quotes.create'),
                'link' => $viewer->can('inbox.manage') ? collect(self::LINKS)->filter(fn (array $link): bool => $viewer->can($link['permission']))->keys()->values()->all() : [],
            ],
            'me' => $viewer->getKey(),
            'scope' => $viewer->can('crm.records.reassign') ? 'all' : (Portfolio::ownOnly($viewer) ? 'own' : 'assigned'),
            'agency' => $this->agency(),
        ];
    }

    private function agency(): array
    {
        $general = DB::table('sys_settings')->where('section', 'general')->value('values');
        $general = is_string($general) ? (json_decode($general, true) ?: []) : [];
        $tenant = app(TenantContext::class)->tenant();
        $sedePhone = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->value('phone');

        return [
            'name' => (string) ($tenant->commercial_name ?? $tenant->legal_name ?? ''),
            'emergency_phone' => $general['emergency_phone'] ?? $general['phone'] ?? $sedePhone,
        ];
    }

    public function thread(string $code, User $viewer): array
    {
        $row = $this->scoped($viewer)->leftJoin('iam_users as u', 'u.id', '=', 'c.assignee_id')->where('c.code', $code)->first(['c.*', 'u.name as assignee_name'])
            ?? throw ApiException::notFound('La conversación no existe o está fuera de tu alcance.');
        $messages = DB::table('collab_messages as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.author_user_id')
            ->where('m.conversation_id', $row->id)->orderBy('m.sent_at')
            ->get(['m.id', 'm.direction', 'm.body', 'm.sent_at', 'm.delivery_status', 'u.name as author']);
        $files = DB::table('collab_message_attachments')->whereIn('message_id', $messages->pluck('id'))->get(['id', 'message_id', 'file_name', 'mime', 'size_bytes', 'scan_status'])->groupBy('message_id');

        if ((int) $row->unread_count > 0) {
            DB::table('collab_conversations')->where('id', $row->id)->update(['unread_count' => 0]);
            $row->unread_count = 0;
        }

        return [
            ...$this->summary($row, null, $viewer),
            'messages' => $messages->map(fn (object $message): array => [
                'id' => $message->id,
                'direction' => $message->direction,
                'body' => $message->body,
                'at' => $message->sent_at,
                'author' => $message->direction === 'in' ? $row->contact_name : ($message->author ?? 'Sistema'),
                'delivery' => $message->delivery_status,
                'files' => $files->get($message->id, collect())->map(fn ($file): array => ['id' => $file->id, 'name' => $file->file_name, 'mime' => $file->mime, 'size' => (int) $file->size_bytes, 'available' => $file->scan_status === 'limpio'])->values(),
            ])->values(),
            'card' => $this->contact($row),
        ];
    }

    public function audit(string $code, User $viewer): array
    {
        $conversation = $this->find($code, $viewer);

        return app(AuditTrail::class)->for('Conversación', [(string) $conversation->code]);
    }

    public function download(string $code, string $attachmentId, User $viewer, bool $inline): StreamedResponse
    {
        $conversation = $this->find($code, $viewer);
        $file = DB::table('collab_message_attachments as a')->join('collab_messages as m', 'm.id', '=', 'a.message_id')
            ->where('m.conversation_id', $conversation->id)->where('a.id', $attachmentId)
            ->first(['a.file_name', 'a.mime', 'a.storage_path', 'a.scan_status'])
            ?? throw ApiException::notFound('El adjunto no existe en esta conversación.');

        if ($file->scan_status !== 'limpio') {
            throw ApiException::conflict('INB-BR-11', 'El adjunto no pasó la revisión antivirus: no se puede abrir.');
        }

        $disk = Storage::disk((string) config('filesystems.default'));

        if ($file->storage_path === null || ! $disk->exists((string) $file->storage_path)) {
            throw ApiException::notFound('El archivo ya no está disponible en el almacenamiento.');
        }

        $headers = ['Content-Type' => (string) $file->mime, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff'];

        return $inline
            ? $disk->response((string) $file->storage_path, (string) $file->file_name, $headers)
            : $disk->download((string) $file->storage_path, (string) $file->file_name, $headers);
    }

    public function linkOptions(string $code, string $kind, string $search, User $viewer): array
    {
        $conversation = $this->find($code, $viewer);
        $link = self::LINKS[$kind];
        $search = mb_strtolower(trim($search));
        $term = '%'.addcslashes($search, '%_\\').'%';
        $booking = $kind === 'reservation';
        $query = $this->linkable($kind, $viewer)->when($booking, fn (Builder $inner) => $inner->leftJoin('crm_clients as k', 'k.id', '=', 'x.client_id'));

        if ($search !== '') {
            $query->where(function (Builder $match) use ($term, $link, $booking): void {
                $match->whereRaw('lower(x.code) like ?', [$term])->orWhereRaw("lower(x.{$link['name']}) like ?", [$term]);
                $booking
                    ? $match->orWhereRaw('lower(k.name) like ?', [$term])
                    : $match->orWhereRaw("lower(coalesce(x.email, '')) like ?", [$term])->orWhereRaw("coalesce(x.phone, '') like ?", [$term]);
            });
        } elseif ($booking && $conversation->client_id) {
            $query->orderByRaw('case when x.client_id = ? then 0 else 1 end', [$conversation->client_id]);
        } elseif (! $booking) {
            $query->orderByRaw("case when lower(coalesce(x.email, '')) = ? or coalesce(x.phone, '') = ? then 0 else 1 end", [mb_strtolower((string) $conversation->contact_email), (string) $conversation->contact_phone]);
        }

        $columns = $booking ? ['x.id', 'x.code', 'x.title as name', 'x.travel_from', 'k.name as client'] : ['x.id', 'x.code', "x.{$link['name']} as name", 'x.email', 'x.phone'];

        return $query->orderByDesc('x.created_at')->limit(12)->get($columns)->map(fn (object $row): array => [
            'code' => $row->code,
            'label' => $row->name,
            'hint' => $booking ? implode(' · ', array_filter([$row->client, $row->travel_from])) : ($row->email ?? $row->phone),
            'linked' => $row->id === $conversation->{$link['column']},
        ])->values()->all();
    }

    public function linkable(string $kind, User $viewer): Builder
    {
        return Portfolio::scope(DB::table(self::LINKS[$kind]['table'].' as x')->whereNull('x.deleted_at'), $viewer, 'x.owner_id');
    }

    public static function canReassign(User $viewer): bool
    {
        return $viewer->can('crm.records.reassign') || ($viewer->can('inbox.manage') && ! Portfolio::ownOnly($viewer));
    }

    public function find(string $code, User $viewer): object
    {
        return $this->scoped($viewer)->where('c.code', $code)->first(['c.*']) ?? throw ApiException::notFound('La conversación no existe o está fuera de tu alcance.');
    }

    private function scoped(User $viewer): Builder
    {
        $query = DB::table('collab_conversations as c');

        if ($viewer->can('crm.records.reassign')) {
            return $query;
        }

        if (! Portfolio::ownOnly($viewer)) {
            $today = Carbon::today()->toDateString();

            return $query->where(fn (Builder $scope) => $scope->where('c.assignee_id', $viewer->getKey())->orWhereExists(fn (Builder $trip) => $trip->from('booking_reservations as r')->whereColumn('r.id', 'c.reservation_id')
                ->where(fn (Builder $live) => $live->where('r.status', 'en_operacion')->orWhere(fn (Builder $dates) => $dates->where('r.travel_from', '<=', $today)->where('r.travel_to', '>=', $today)->where('r.status', '<>', 'cancelada')))));
        }

        return $query->where(fn (Builder $scope) => $scope->where('c.assignee_id', $viewer->getKey())->orWhereNull('c.assignee_id'));
    }

    private function summary(object $row, ?object $preview, User $viewer): array
    {
        $now = Carbon::now();
        $due = Carbon::parse($row->first_response_due_at);

        return [
            'code' => $row->code,
            'channel' => $row->channel,
            'channel_label' => self::CHANNELS[$row->channel] ?? $row->channel,
            'contact' => ['name' => $row->contact_name, 'email' => $row->contact_email, 'phone' => $row->contact_phone],
            'subject' => $row->subject,
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'priority' => $row->priority,
            'tags' => $this->array($row->tags),
            'assignee' => $row->assignee_id ? ['id' => $row->assignee_id, 'name' => $row->assignee_name] : null,
            'mine' => $row->assignee_id === $viewer->getKey(),
            'unread' => (int) $row->unread_count,
            'last_message_at' => $row->last_message_at,
            'created_at' => $row->created_at,
            'preview' => $preview ? mb_substr((string) $preview->body, 0, 140) : null,
            'preview_inbound' => $preview ? $preview->direction === 'in' : false,
            'preview_note' => $preview ? $preview->direction === 'internal' : false,
            'sla' => [
                'due_at' => $row->first_response_due_at,
                'responded_at' => $row->first_response_at,
                'state' => match (true) {
                    $row->first_response_at !== null => Carbon::parse($row->first_response_at)->lte($due) ? 'met' : 'late',
                    $row->status === 'resuelta' => 'met',
                    $due->lt($now) => 'breached',
                    $now->diffInMinutes($due) <= 30 => 'warning',
                    default => 'running',
                },
            ],
            'window_open' => $row->channel !== 'whatsapp' || ($row->last_inbound_at !== null && Carbon::parse($row->last_inbound_at)->gt($now->copy()->subDay())),
            'lock_version' => (int) $row->lock_version,
        ];
    }

    private function contact(object $row): array
    {
        $client = $row->client_id ? DB::table('crm_clients as c')->leftJoin('iam_users as u', 'u.id', '=', 'c.owner_id')->where('c.id', $row->client_id)->first(['c.code', 'c.name', 'c.segment_code', 'c.country', 'c.nps_last', 'u.name as owner']) : null;
        $lead = $row->lead_id ? DB::table('crm_leads')->where('id', $row->lead_id)->first(['code', 'full_name', 'status']) : null;
        $reservations = $this->related('booking_reservations', $row->client_id, $row->reservation_id, ['code', 'title', 'status', 'travel_from', 'total_amount', 'currency']);
        $quotes = $this->related('quote_quotes', $row->client_id, $row->quote_id, ['code', 'title', 'status', 'travel_from', 'currency']);

        $opportunity = $row->client_id ? DB::table('crm_opportunities')->where('client_id', $row->client_id)->whereNull('deleted_at')->whereIn('stage', ['calificacion', 'descubrimiento', 'cotizacion', 'negociacion'])->orderByDesc('updated_at')->first(['code', 'title', 'stage']) : null;
        $booking = $row->reservation_id ? DB::table('booking_reservations')->where('id', $row->reservation_id)->first(['code', 'title', 'status']) : null;
        $today = Carbon::today()->toDateString();
        $trip = ($row->client_id || $row->reservation_id) ? DB::table('booking_reservations')->whereNull('deleted_at')
            ->where(fn (Builder $scope) => $scope->when($row->client_id, fn (Builder $inner) => $inner->where('client_id', $row->client_id))->when($row->reservation_id, fn (Builder $inner) => $inner->orWhere('id', $row->reservation_id)))
            ->where(fn (Builder $live) => $live->where('status', 'en_operacion')->orWhere(fn (Builder $dates) => $dates->where('travel_from', '<=', $today)->where('travel_to', '>=', $today)->where('status', '<>', 'cancelada')))
            ->orderBy('travel_from')->first(['code', 'travel_to']) : null;
        $ticket = $row->support_ticket_id ? DB::table('channel_support_tickets')->where('id', $row->support_ticket_id)->first(['code', 'status']) : null;

        return [
            'in_trip' => $trip ? ['code' => $trip->code, 'until' => $trip->travel_to] : null,
            'ticket' => $ticket ? ['code' => $ticket->code, 'status' => $ticket->status] : null,
            'client' => $client ? ['code' => $client->code, 'name' => $client->name, 'segment' => $client->segment_code, 'country' => $client->country, 'nps' => $client->nps_last, 'owner' => $client->owner] : null,
            'lead' => $lead ? ['code' => $lead->code, 'name' => $lead->full_name, 'status' => $lead->status] : null,
            'reservation' => $booking ? ['code' => $booking->code, 'title' => $booking->title, 'status' => $booking->status] : null,
            'reservations' => $reservations->map(fn ($item): array => ['code' => $item->code, 'title' => $item->title, 'status' => $item->status, 'date' => $item->travel_from, 'total' => (float) $item->total_amount, 'currency' => $item->currency, 'linked' => $item->id === $row->reservation_id])->values(),
            'opportunity' => $opportunity ? ['code' => $opportunity->code, 'title' => $opportunity->title, 'stage' => $opportunity->stage] : null,
            'quotes' => $quotes->map(fn ($item): array => ['code' => $item->code, 'title' => $item->title, 'status' => $item->status, 'date' => $item->travel_from, 'linked' => $item->id === $row->quote_id])->values(),
        ];
    }

    private function related(string $table, ?string $clientId, ?string $linkedId, array $columns): Collection
    {
        if ($clientId === null && $linkedId === null) {
            return collect();
        }

        return DB::table($table)->whereNull('deleted_at')
            ->where(fn (Builder $query) => $query->when($clientId, fn (Builder $inner) => $inner->where('client_id', $clientId))->when($linkedId, fn (Builder $inner) => $inner->orWhere('id', $linkedId)))
            ->orderByDesc('travel_from')->limit(5)->get(['id', ...$columns]);
    }

    private function array(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        $trimmed = trim((string) $value, '{}');

        return $trimmed === '' ? [] : array_map(fn (string $item): string => trim($item, '"'), str_getcsv($trimmed));
    }
}
