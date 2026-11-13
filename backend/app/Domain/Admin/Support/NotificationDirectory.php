<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class NotificationDirectory
{
    public function __construct(private readonly AuditDirectory $audit) {}

    public function rulesPage(Request $request, User $viewer): array
    {
        $filters = CursorPage::filters($request);
        $rules = collect($this->rules())
            ->when($filters['group'] ?? null, fn ($items, string $group) => $items->where('group', $group))
            ->when($filters['channel'] ?? null, fn ($items, string $channel) => $items->filter(fn (array $rule): bool => (bool) ($rule['channels'][$channel] ?? false)))
            ->values()
            ->all();

        return CursorPage::respondItems($request, $rules, [
            'kpis' => $this->kpis(),
            'options' => [
                'channels' => $this->options(NotificationCatalog::CHANNELS),
                'timings' => $this->options(NotificationCatalog::TIMINGS),
                'conditions' => $this->options(NotificationCatalog::CONDITIONS),
                'template_channels' => $this->options(NotificationCatalog::TEMPLATE_CHANNELS),
                'variables' => NotificationCatalog::VARIABLES,
            ],
            'history' => $this->audit->recent(['Notificación'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
            'whatsapp' => $this->whatsapp(),
        ]);
    }

    private function whatsapp(): ?array
    {
        $adapter = DB::table('integration_adapters')->where('kind', SettingsCatalog::CHANNEL_INTEGRATIONS['whatsapp'])->orderBy('code')->first(['code', 'name', 'status', 'environment']);

        return $adapter === null ? null : [
            'code' => $adapter->code,
            'name' => $adapter->name,
            'status' => $adapter->status,
            'status_label' => IntegrationDirectory::STATUSES[$adapter->status] ?? $adapter->status,
            'sandbox' => $adapter->status !== 'activo' || $adapter->environment !== 'production',
        ];
    }

    public function rule(string $event): array
    {
        if (! isset(NotificationCatalog::EVENTS[$event])) {
            throw ApiException::notFound('El evento no existe.');
        }

        return collect($this->rules())->firstWhere('event_code', $event);
    }

    public function messagesPage(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->messages()
            ->when($filters['channel'] ?? null, fn (Builder $q, string $channel) => $q->whereIn('m.channel', explode(',', $channel)))
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->whereIn('m.status', explode(',', $status)))
            ->when($filters['event'] ?? $filters['event_code'] ?? null, fn (Builder $q, string $event) => $q->whereIn('m.event_code', explode(',', $event)))
            ->when(isset($filters['is_fallback']), fn (Builder $q) => $q->where('m.is_fallback', filter_var($filters['is_fallback'], FILTER_VALIDATE_BOOLEAN)));

        return CursorPage::respond($request, $query, ['created_at' => 'm.created_at', 'status' => 'm.status', 'channel' => 'm.channel', 'code' => 'm.code'], '-created_at', fn (object $row): array => self::map($row), CursorPage::isFirst($request) ? ['kpis' => $this->kpis()] : []);
    }

    public function message(string $id): array
    {
        $row = $this->messages()->where(fn (Builder $q) => Str::isUuid($id) ? $q->where('m.id', $id) : $q->where('m.code', $id))->first();

        return $row === null ? throw ApiException::notFound('El envío no existe.') : self::map($row);
    }

    public static function map(object $row): array
    {
        return [
            'id' => $row->id,
            'code' => $row->code,
            'event_code' => $row->event_code,
            'event_label' => NotificationCatalog::label($row->event_code),
            'channel' => $row->channel,
            'recipient_user_id' => $row->recipient_user_id,
            'recipient_address' => $row->recipient_address,
            'subject' => $row->subject,
            'body_rendered' => $row->body_rendered,
            'template_id' => $row->template_id,
            'source_type' => $row->source_type,
            'source_id' => $row->source_id,
            'status' => $row->status,
            'retries' => (int) $row->retries,
            'last_error' => $row->last_error,
            'is_fallback' => (bool) $row->is_fallback,
            'fallback_of_id' => $row->fallback_of_id,
            'read_at' => $row->read_at,
            'provider_message_id' => $row->provider_message_id,
            'created_at' => $row->created_at,
            'sent_at' => $row->sent_at,
            'audience' => $row->audience,
            'to' => $row->user_name ?? $row->recipient_address ?? '—',
            'permanent' => $row->last_error !== null && str_contains((string) $row->last_error, '131026'),
            'can_fallback' => $row->channel !== 'email' && ! $row->is_fallback,
        ];
    }

    private function messages(): Builder
    {
        return DB::table('notif_messages as m')
            ->leftJoin('iam_users as u', 'u.id', '=', 'm.recipient_user_id')
            ->select(['m.id', 'm.code', 'm.event_code', 'm.channel', 'm.recipient_user_id', 'm.recipient_address', 'm.subject', 'm.body_rendered', 'm.template_id', 'm.source_type', 'm.source_id', 'm.status', 'm.retries', 'm.last_error', 'm.is_fallback', 'm.fallback_of_id', 'm.read_at', 'm.provider_message_id', 'm.audience', 'm.created_at', 'm.sent_at', 'u.name as user_name']);
    }

    private function rules(): array
    {
        $rows = DB::table('notif_event_rules as r')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.updated_by')
            ->get(['r.id', 'r.event_code', 'r.label', 'r.ch_email', 'r.ch_whatsapp', 'r.ch_push', 'r.ch_portal', 'r.recipients', 'r.timing', 'r.condition', 'r.updated_by', 'r.updated_at', 'u.name as user_name'])
            ->keyBy('event_code');
        $templates = DB::table('notif_templates')->whereNotNull('tenant_id')->where('is_current', true)->get(['event_code', 'channel', 'version'])->groupBy('event_code');

        return collect(NotificationCatalog::EVENTS)->map(function (array $event, string $code) use ($rows, $templates): array {
            $row = $rows[$code] ?? null;
            $channels = [
                'email' => (bool) ($row->ch_email ?? false),
                'whatsapp' => (bool) ($row->ch_whatsapp ?? false),
                'push' => (bool) ($row->ch_push ?? false),
                'portal' => (bool) ($row->ch_portal ?? false),
            ];

            return [
                'id' => $row->id ?? null,
                'event_code' => $code,
                'label' => $event['label'],
                'ch_email' => $channels['email'],
                'ch_whatsapp' => $channels['whatsapp'],
                'ch_push' => $channels['push'],
                'ch_portal' => $channels['portal'],
                'recipients' => $row->recipients ?? $event['recipients'],
                'timing' => $row->timing ?? 'immediate',
                'condition' => $row->condition ?? 'always',
                'updated_by' => $row->updated_by ?? null,
                'updated_at' => $row->updated_at ?? null,
                'event' => $code,
                'group' => $event['group'],
                'channels' => $channels,
                'critical' => $code === 'incidencia.critica',
                'updated_by_name' => $row->user_name ?? null,
                'custom_templates' => ($templates[$code] ?? collect())->mapWithKeys(fn (object $template): array => [$template->channel => (int) $template->version])->all(),
            ];
        })->values()->all();
    }

    private function kpis(): array
    {
        $week = Carbon::today()->subDays(6);

        return [
            'sent_7d' => DB::table('notif_messages')->where('status', 'enviado')->where('created_at', '>=', $week)->count(),
            'failed' => DB::table('notif_messages')->where('status', 'fallido')->count(),
            'pending' => DB::table('notif_messages')->where('status', 'pendiente')->count(),
            'routes' => (int) DB::table('notif_event_rules')->selectRaw('coalesce(sum(ch_email::int + ch_whatsapp::int + ch_push::int + ch_portal::int), 0) as total')->value('total'),
            'messages' => DB::table('notif_messages')->count(),
        ];
    }

    private function options(array $map): array
    {
        return collect($map)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all();
    }
}
