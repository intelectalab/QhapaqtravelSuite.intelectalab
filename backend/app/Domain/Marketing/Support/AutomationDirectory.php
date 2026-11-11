<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AutomationDirectory
{
    public const DELAY_MINUTES = ['welcome' => 0, 'cart' => 60, 'pretrip' => -4320, 'survey' => 1440];

    public const SCHEDULES = ['birthday' => '0 9 * * *', 'reactivation' => '0 8 * * 1'];

    public const PURPOSES = ['comercial' => 'Comercial', 'servicio' => 'Servicio'];

    private const PRETRIP_STATUSES = ['confirmada', 'pendiente_pago', 'pendiente_proveedor'];

    private const PREVIEW = 4;

    private const HISTORY = ['activar' => 'Activada', 'pausar' => 'Pausada', 'configurar' => 'Configuración', 'ejecutar' => 'Ejecución manual'];

    public function __construct(private readonly ContactBook $contacts) {}

    public function overview(User $viewer): array
    {
        $rows = DB::table('mkt_automations as a')->leftJoin('mkt_templates as t', 't.id', '=', 'a.template_id')
            ->orderBy('a.code')->get(['a.*', 't.code as template_code', 't.name as template_name', 't.channel as template_channel', 't.status as template_status']);
        $runs = DB::table('mkt_automation_runs as r')->leftJoin('iam_users as u', 'u.id', '=', 'r.triggered_by')
            ->whereIn('r.automation_id', $rows->pluck('id'))->orderByDesc('r.started_at')
            ->get(['r.automation_id', 'r.started_at', 'r.queued', 'r.sent', 'r.suppressed', 'u.name as by'])->groupBy('automation_id');
        $history = DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->where('e.entity', 'Automatización')->whereIn('e.entity_id', $rows->pluck('code'))->whereIn('e.action', array_keys(self::HISTORY))
            ->orderByDesc('e.occurred_at')->get(['e.entity_id', 'e.action', 'e.after_value', 'e.occurred_at', 'u.name as by'])->groupBy('entity_id');

        return [
            'automations' => $rows->map(fn (object $row): array => $this->automation($row, $runs->get($row->id, collect()), $history->get($row->code, collect())))->values(),
            'templates' => DB::table('mkt_templates')->orderBy('code')->get(['code', 'name', 'channel', 'status'])->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'channel' => $row->channel,
                'usable' => $row->channel === 'email' ? $row->status === 'activa' : $row->status === 'aprobada',
            ])->values(),
            'can' => ['manage' => $viewer->can('marketing.campaigns.manage')],
        ];
    }

    public function queue(object $automation): Collection
    {
        $book = $this->contacts->all();
        $byKey = $book->keyBy(fn (array $contact): string => "{$contact['type']}:{$contact['id']}");
        $byEmail = $book->filter(fn (array $contact): bool => (bool) $contact['email'])->keyBy(fn (array $contact): string => Str::lower((string) $contact['email']));
        $done = DB::table('mkt_automation_enrollments')->where('automation_id', $automation->id)->get(['subject_type', 'subject_id', 'ref_type', 'ref_id'])
            ->map(fn (object $row): string => "{$row->subject_type}:{$row->subject_id}|{$row->ref_type}:{$row->ref_id}")->flip();

        return $this->candidates($automation->key, $book, $byKey, $byEmail)
            ->reject(fn (array $item): bool => $done->has("{$item['contact']['type']}:{$item['contact']['id']}|{$item['ref_type']}:{$item['ref_id']}"))
            ->unique(fn (array $item): string => "{$item['contact']['type']}:{$item['contact']['id']}|{$item['ref_type']}:{$item['ref_id']}")
            ->map(fn (array $item): array => [...$item, 'block' => $this->block($automation, $item['contact'])])
            ->values();
    }

    private function automation(object $row, Collection $runs, Collection $history): array
    {
        $queue = $this->queue($row);
        $blocked = $queue->whereNotNull('block')->count();
        $last = $runs->first();

        return [
            'code' => $row->code,
            'key' => $row->key,
            'lock_version' => (int) $row->lock_version,
            'name' => $row->name,
            'trigger' => $row->trigger_desc,
            'delay' => $row->delay_desc,
            'channel' => $row->channel,
            'channel_label' => CampaignDirectory::CHANNELS[$row->channel] ?? $row->channel,
            'purpose' => $row->purpose,
            'purpose_label' => self::PURPOSES[$row->purpose] ?? $row->purpose,
            'status' => $row->status,
            'template' => $row->template_code ? [
                'code' => $row->template_code,
                'name' => $row->template_name,
                'status' => $row->template_status,
                'usable' => $row->template_channel === 'email' ? $row->template_status === 'activa' : $row->template_status === 'aprobada',
            ] : null,
            'totals' => ['sent' => (int) $row->sent_total, 'suppressed' => (int) $row->suppressed_total, 'conversions' => (int) $row->conversions_total],
            'queue' => [
                'total' => $queue->count(),
                'sendable' => $queue->count() - $blocked,
                'suppressed' => $blocked,
                'items' => $queue->take(self::PREVIEW)->map(fn (array $item): array => [
                    'name' => $item['contact']['name'],
                    'type_label' => $item['contact']['type_label'],
                    'why' => $item['why'],
                    'block' => $item['block'],
                ])->values(),
            ],
            'last_run' => $last ? ['at' => $last->started_at, 'queued' => (int) $last->queued, 'sent' => (int) $last->sent, 'suppressed' => (int) $last->suppressed, 'by' => $last->by] : null,
            'history' => array_map(fn (object $event): array => [
                'action' => $event->action,
                'label' => self::HISTORY[$event->action] ?? $event->action,
                'detail' => $event->after_value,
                'at' => $event->occurred_at,
                'by' => $event->by,
            ], array_values($history->take(8)->all())),
            'updated_at' => $row->updated_at,
        ];
    }

    private function block(object $automation, array $contact): ?string
    {
        $channel = $automation->channel;

        if ($contact['revoked'][$channel] ?? false) {
            return 'Baja registrada';
        }

        if (empty($contact[$channel === 'email' ? 'email' : 'mobile'])) {
            return 'Sin dato para '.(CampaignDirectory::CHANNELS[$channel] ?? $channel);
        }

        if ($automation->purpose === 'comercial' && ! ($contact['consent'][$channel] ?? false)) {
            return 'Sin consentimiento';
        }

        return null;
    }

    private function candidates(string $key, Collection $book, Collection $byKey, Collection $byEmail): Collection
    {
        $today = Carbon::today();
        $item = fn (?array $contact, string $refType, string $refId, string $why): ?array => $contact ? ['contact' => $contact, 'ref_type' => $refType, 'ref_id' => $refId, 'why' => $why] : null;

        $items = match ($key) {
            'welcome' => DB::table('mkt_contacts_subscribers')->whereNull('deleted_at')->whereNull('client_id')->where('created_at', '>=', $today->copy()->subDays(7))->orderByDesc('created_at')->get(['id', 'created_at'])
                ->map(fn (object $row): ?array => $item($byKey->get("subscriber:{$row->id}"), 'subscriber', $row->id, 'Suscrito el '.Carbon::parse($row->created_at)->format('d/m/Y'))),
            'cart' => DB::table('channel_ecom_orders')->where('status', 'pago_pendiente')->where('ordered_at', '<', Carbon::now()->subHour())->orderByDesc('ordered_at')->get(['id', 'code', 'crm_client_id', 'customer_email', 'total', 'currency'])
                ->map(fn (object $row): ?array => $item(($row->crm_client_id ? $byKey->get("client:{$row->crm_client_id}") : null) ?? $byEmail->get(Str::lower((string) $row->customer_email)), 'ecom_order', $row->id, "Pedido {$row->code} · {$row->currency} ".number_format((float) $row->total, 2))),
            'pretrip' => DB::table('booking_reservations')->whereNull('deleted_at')->whereIn('status', self::PRETRIP_STATUSES)->whereNotNull('client_id')
                ->whereBetween('travel_from', [$today->toDateString(), $today->copy()->addDays(3)->toDateString()])->orderBy('travel_from')->get(['id', 'code', 'client_id', 'travel_from'])
                ->map(fn (object $row): ?array => $item($byKey->get("client:{$row->client_id}"), 'reservation', $row->id, "{$row->code} inicia el ".Carbon::parse($row->travel_from)->format('d/m/Y'))),
            'survey' => DB::table('booking_reservations as r')->whereNull('r.deleted_at')->where('r.status', 'completada')->whereNotNull('r.client_id')
                ->whereBetween('r.travel_to', [$today->copy()->subDays(7)->toDateString(), $today->toDateString()])
                ->whereNotExists(fn ($query) => $query->from('crm_surveys as s')->whereColumn('s.reservation_id', 'r.id'))
                ->orderByDesc('r.travel_to')->get(['r.id', 'r.code', 'r.client_id', 'r.travel_to'])
                ->map(fn (object $row): ?array => $item($byKey->get("client:{$row->client_id}"), 'reservation', $row->id, "{$row->code} terminó el ".Carbon::parse($row->travel_to)->format('d/m/Y'))),
            'birthday' => DB::table('crm_clients')->whereNull('deleted_at')->whereNotNull('birth_date')->get(['id', 'birth_date'])
                ->filter(fn (object $row): bool => $this->birthdaySoon(Carbon::parse($row->birth_date), $today))
                ->map(fn (object $row): ?array => $item($byKey->get("client:{$row->id}"), 'client', $row->id, 'Cumpleaños el '.Carbon::parse($row->birth_date)->format('d/m'))),
            'reactivation' => $this->dormant($book, $today)->map(fn (array $contact): ?array => $item($contact, 'client', $contact['id'], $contact['last_purchase'] ? 'Última compra el '.Carbon::parse($contact['last_purchase'])->format('d/m/Y') : 'Sin compras desde el alta')),
            default => collect(),
        };

        return $items->filter()->values();
    }

    private function birthdaySoon(Carbon $birth, Carbon $today): bool
    {
        foreach (range(0, 7) as $offset) {
            if ($today->copy()->addDays($offset)->format('m-d') === $birth->format('m-d')) {
                return true;
            }
        }

        return false;
    }

    private function dormant(Collection $book, Carbon $today): Collection
    {
        $limit = $today->copy()->subDays(365);
        $created = DB::table('crm_clients')->whereNull('deleted_at')->pluck('created_at', 'id');

        return $book->where('type', 'client')->filter(function (array $contact) use ($limit, $created): bool {
            $since = $contact['last_purchase'] ?? ($created[$contact['id']] ?? null);

            return $since !== null && Carbon::parse($since)->lt($limit);
        })->values();
    }
}
