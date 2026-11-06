<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ConversationDirectory
{
    public const CHANNELS = ['whatsapp' => 'WhatsApp', 'email' => 'Email', 'webchat' => 'Chat web', 'form' => 'Formulario', 'portal' => 'Portal'];

    public const STATUSES = ['abierta' => 'Abierta', 'pendiente' => 'Esperando al cliente', 'resuelta' => 'Resuelta'];

    public const PRIORITIES = ['baja' => 'Baja', 'media' => 'Media', 'alta' => 'Alta', 'critica' => 'Crítica'];

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
        $previews = DB::table('collab_messages')->whereIn('conversation_id', $rows->pluck('id'))->where('direction', '<>', 'internal')
            ->orderByDesc('sent_at')->get(['conversation_id', 'body', 'direction'])->unique('conversation_id')->keyBy('conversation_id');
        $now = Carbon::now();
        $items = $rows->map(fn (object $row): array => $this->summary($row, $previews->get($row->id), $viewer));
        $responded = $rows->filter(fn (object $row): bool => $row->first_response_at !== null);
        $minutes = $responded->map(fn (object $row): float => Carbon::parse($row->created_at)->diffInMinutes(Carbon::parse($row->first_response_at)));

        return [
            'kpis' => [
                'open' => $rows->where('status', 'abierta')->count(),
                'unassigned' => $rows->whereNull('assignee_id')->where('status', '<>', 'resuelta')->count(),
                'sla_breached' => $rows->filter(fn (object $row): bool => $row->status !== 'resuelta' && $row->first_response_at === null && Carbon::parse($row->first_response_due_at)->lt($now))->count(),
                'resolved_week' => $rows->filter(fn (object $row): bool => $row->resolved_at !== null && Carbon::parse($row->resolved_at)->gte($now->copy()->subDays(7)))->count(),
                'first_response_minutes' => $minutes->isEmpty() ? null : (int) round($minutes->avg()),
            ],
            'items' => $items->values(),
            'templates' => DB::table('collab_reply_templates')->whereNull('deleted_at')->where('is_active', true)->orderBy('code')
                ->get(['code', 'name', 'body', 'channels', 'is_whatsapp_approved'])
                ->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->name, 'body' => $row->body, 'channels' => $this->array($row->channels), 'whatsapp_approved' => (bool) $row->is_whatsapp_approved])->values(),
            'agents' => $viewer->can('crm.records.reassign') ? $this->advisors->all(self::AGENT_ROLES)->values() : [],
            'can' => ['manage' => $viewer->can('inbox.manage'), 'reassign' => self::canReassign($viewer)],
            'me' => $viewer->getKey(),
        ];
    }

    public function thread(string $code, User $viewer): array
    {
        $row = $this->scoped($viewer)->leftJoin('iam_users as u', 'u.id', '=', 'c.assignee_id')->where('c.code', $code)->first(['c.*', 'u.name as assignee_name'])
            ?? throw ApiException::notFound('La conversación no existe o está fuera de tu alcance.');
        $messages = DB::table('collab_messages as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.author_user_id')
            ->where('m.conversation_id', $row->id)->orderBy('m.sent_at')
            ->get(['m.id', 'm.direction', 'm.body', 'm.sent_at', 'm.delivery_status', 'u.name as author']);
        $files = DB::table('collab_message_attachments')->whereIn('message_id', $messages->pluck('id'))->get(['message_id', 'file_name', 'size_bytes'])->groupBy('message_id');

        return [
            ...$this->summary($row, null, $viewer),
            'messages' => $messages->map(fn (object $message): array => [
                'id' => $message->id,
                'direction' => $message->direction,
                'body' => $message->body,
                'at' => $message->sent_at,
                'author' => $message->direction === 'in' ? $row->contact_name : ($message->author ?? 'Sistema'),
                'delivery' => $message->delivery_status,
                'files' => $files->get($message->id, collect())->map(fn ($file): array => ['name' => $file->file_name, 'size' => (int) $file->size_bytes])->values(),
            ])->values(),
            'card' => $this->contact($row),
        ];
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
        ];
    }

    private function contact(object $row): array
    {
        $client = $row->client_id ? DB::table('crm_clients as c')->leftJoin('iam_users as u', 'u.id', '=', 'c.owner_id')->where('c.id', $row->client_id)->first(['c.code', 'c.name', 'c.segment_code', 'c.country', 'c.nps_last', 'u.name as owner']) : null;
        $lead = $row->lead_id ? DB::table('crm_leads')->where('id', $row->lead_id)->first(['code', 'full_name', 'status']) : null;
        $reservations = $this->related('booking_reservations', $row->client_id, $row->reservation_id, ['code', 'title', 'status', 'travel_from', 'total_amount', 'currency']);
        $quotes = $this->related('quote_quotes', $row->client_id, $row->quote_id, ['code', 'title', 'status', 'travel_from', 'currency']);

        return [
            'client' => $client ? ['code' => $client->code, 'name' => $client->name, 'segment' => $client->segment_code, 'country' => $client->country, 'nps' => $client->nps_last, 'owner' => $client->owner] : null,
            'lead' => $lead ? ['code' => $lead->code, 'name' => $lead->full_name, 'status' => $lead->status] : null,
            'reservations' => $reservations->map(fn ($item): array => ['code' => $item->code, 'title' => $item->title, 'status' => $item->status, 'date' => $item->travel_from, 'total' => (float) $item->total_amount, 'currency' => $item->currency, 'linked' => $item->id === $row->reservation_id])->values(),
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
