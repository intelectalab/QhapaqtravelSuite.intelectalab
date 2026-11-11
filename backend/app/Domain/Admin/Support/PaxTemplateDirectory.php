<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Admin\Actions\PaxMessageScheduler;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PaxTemplateDirectory
{
    public const EVENTS = [
        'reserva_confirmada' => 'Reserva confirmada',
        'saldo_vence' => 'Vencimiento del saldo',
        'viaje' => 'Inicio del viaje',
        'fin_viaje' => 'Fin del viaje',
        'cambio_horario' => 'Cambio de horario o incidencia',
        'cumpleanos' => 'Cumpleaños del pasajero',
    ];

    public const CHANNELS = ['email' => 'Correo', 'whatsapp' => 'WhatsApp', 'portal' => 'Portal', 'push' => 'Push'];

    public const SALES_CHANNELS = ['Directo' => 'Directo', 'Corporativo' => 'Corporativo', 'B2B' => 'B2B', 'E-commerce' => 'E-commerce'];

    public const VARIABLES = [
        'pasajero' => 'Nombre del pasajero principal',
        'reserva' => 'Código de la reserva',
        'producto' => 'Programa o servicio reservado',
        'fecha' => 'Fecha de inicio del viaje',
        'saldo' => 'Saldo pendiente',
        'fecha_saldo' => 'Fecha de vencimiento del saldo',
        'hora_recojo' => 'Hora de recojo',
        'punto_recojo' => 'Punto de recojo',
        'enlace_portal' => 'Enlace al portal del pasajero',
        'agencia' => 'Nombre comercial de la agencia',
    ];

    public function __construct(private readonly TenantContext $context, private readonly AuditDirectory $audit) {}

    public function list(User $viewer): array
    {
        $sent = DB::table('notif_pax_messages')->whereNotNull('template_id')->selectRaw("template_id, count(*) as total, sum(case when status = 'fallido' then 1 else 0 end) as failed")->groupBy('template_id')->get()->keyBy('template_id');
        $rules = DB::table('sys_booking_rules')->get(['code', 'name', 'enabled', 'params'])->keyBy('code');
        $templates = DB::table('notif_pax_message_templates as t')
            ->leftJoin('iam_users as u', 'u.id', '=', 't.updated_by')
            ->orderBy('t.code')
            ->get(['t.id', 't.code', 't.name', 't.event', 't.offset_hours', 't.offset_from_rule', 't.channels', 't.subject', 't.body', 't.lang', 't.conditions', 't.active', 't.updated_at', 'u.name as user_name'])
            ->map(function (object $row) use ($sent, $rules): array {
                $conditions = (array) json_decode((string) $row->conditions, true);
                $rule = isset($conditions['requiresRule']) ? ($rules[$conditions['requiresRule']] ?? null) : null;
                $offset = (int) $row->offset_hours;

                if ($row->offset_from_rule && $rule) {
                    $offset = (int) ((json_decode((string) $rule->params, true)['daysAfter'] ?? 0) * 24);
                }

                return [
                    'code' => $row->code,
                    'name' => $row->name,
                    'event' => $row->event,
                    'event_label' => self::EVENTS[$row->event] ?? $row->event,
                    'offset_hours' => $offset,
                    'offset_from_rule' => (bool) $row->offset_from_rule,
                    'channels' => PgArray::parse($row->channels),
                    'subject' => $row->subject,
                    'body' => $row->body,
                    'lang' => $row->lang,
                    'only_if_balance' => (bool) ($conditions['onlyIfBalance'] ?? false),
                    'products' => array_values((array) ($conditions['products'] ?? [])),
                    'sales_channels' => array_values((array) ($conditions['channels'] ?? [])),
                    'only_if_missing_docs' => (bool) ($conditions['onlyIfMissingDocs'] ?? false),
                    'rule' => $rule ? ['code' => $rule->code, 'name' => $rule->name, 'enabled' => (bool) $rule->enabled] : null,
                    'active' => (bool) $row->active,
                    'sent' => (int) ($sent[$row->id]->total ?? 0),
                    'failed' => (int) ($sent[$row->id]->failed ?? 0),
                    'updated_at' => $row->updated_at,
                    'updated_by' => $row->user_name,
                ];
            });

        return [
            'templates' => $templates->values(),
            'events' => $this->options(self::EVENTS),
            'channels' => $this->options(self::CHANNELS),
            'variables' => collect(self::VARIABLES)->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])->values(),
            'rules' => $rules->filter(fn (object $rule): bool => in_array($rule->code, ['R-DEPOSIT', 'R-COMPANIONS', 'R-REVIEW-INVITE', 'R-PAX-MESSAGES'], true))->map(fn (object $rule): array => ['value' => $rule->code, 'label' => $rule->name, 'enabled' => (bool) $rule->enabled])->values(),
            'messages_enabled' => (bool) ($rules['R-PAX-MESSAGES']->enabled ?? true),
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->orderBy('name')->get(['id', 'code', 'name'])->map(fn (object $product): array => ['value' => (string) $product->id, 'label' => $product->name, 'hint' => $product->code])->values(),
            'sales_channels' => $this->options(self::SALES_CHANNELS),
            'reservations' => DB::table('booking_reservations')->whereNull('deleted_at')->whereIn('status', PaxMessageScheduler::LIVE)->orderByDesc('travel_from')->limit(120)->get(['code', 'title'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->code, 'hint' => $row->title])->values(),
            'can_send' => $viewer->can('admin.settings.manage') || $viewer->can('operations.assign'),
            'sample' => $this->sample(),
            'history' => $this->audit->recent(['Plantilla de mensaje'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }

    public function messagesPage(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $list = fn (string $key): array => array_values(array_filter(explode(',', (string) ($filters[$key] ?? ''))));
        $query = DB::table('notif_pax_messages as m')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'm.reservation_id')
            ->leftJoin('notif_pax_message_templates as t', 't.id', '=', 'm.template_id')
            ->when($list('status') !== [], fn (Builder $q) => $q->whereIn('m.status', $list('status')))
            ->when($list('channel') !== [], fn (Builder $q) => $q->whereIn('m.channel', $list('channel')))
            ->select(['m.code', 'm.channel', 'm.recipient', 'm.subject', 'm.status', 'm.direction', 'm.origin', 'm.scheduled_at', 'm.sent_at', 'm.delivered_at', 'm.read_at', 'm.attempts', 'm.error', 'm.lang', 'r.code as reservation', 'r.title as reservation_title', 't.code as template', 't.name as template_name'])
            ->selectRaw('coalesce(m.sent_at, m.scheduled_at, m.created_at) as at');

        return CursorPage::respond($request, $query, ['at' => 'at', 'scheduled_at' => 'm.scheduled_at', 'code' => 'm.code'], '-at,-code', fn (object $row): array => [
            'code' => $row->code,
            'reservation' => $row->reservation,
            'reservation_title' => $row->reservation_title,
            'template' => $row->template,
            'template_name' => $row->template_name,
            'channel' => $row->channel,
            'recipient' => $row->recipient,
            'subject' => $row->subject,
            'status' => $row->status,
            'direction' => $row->direction,
            'origin' => $row->origin,
            'scheduled_at' => $row->scheduled_at,
            'sent_at' => $row->sent_at,
            'delivered_at' => $row->delivered_at,
            'read_at' => $row->read_at,
            'attempts' => (int) $row->attempts,
            'error' => $row->error,
            'lang' => $row->lang,
            'at' => $row->at,
        ]);
    }

    private function sample(): array
    {
        $reservation = DB::table('booking_reservations as r')
            ->whereIn('r.status', ['confirmada', 'pendiente_pago', 'pendiente_proveedor', 'en_operacion'])
            ->whereNull('r.deleted_at')
            ->orderByRaw('abs(r.travel_from - current_date)')
            ->first(['r.id', 'r.code']);

        return $reservation === null
            ? ['reservation' => null, 'values' => ['agencia' => $this->context->tenant()->commercial_name]]
            : ['reservation' => $reservation->code, 'values' => $this->values($reservation->id)];
    }

    public function values(string $reservationId): array
    {
        $reservation = DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->where('r.id', $reservationId)
            ->first(['r.id', 'r.code', 'r.title', 'r.travel_from', 'r.currency', 'c.name as client_name']);

        $values = ['agencia' => $this->context->tenant()->commercial_name];

        if ($reservation === null) {
            return $values;
        }

        $lead = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderByDesc('is_lead')->orderBy('seq')->value('full_name');
        $service = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotNull('service_time')->orderBy('service_date')->orderBy('service_time')->first(['service_time']);
        $balance = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'anulada'])->selectRaw('sum(amount - paid_amount) as balance, min(due_date) as due, max(currency) as currency')->first();
        $values = [
            ...$values,
            'pasajero' => $lead ?? $reservation->client_name,
            'reserva' => $reservation->code,
            'producto' => $reservation->title,
            'fecha' => Carbon::parse($reservation->travel_from)->locale('es')->translatedFormat('j \\d\\e F'),
        ];

        if ($balance && (float) $balance->balance > 0) {
            $values['saldo'] = ($balance->currency === 'USD' ? 'US$ ' : 'S/ ').number_format((float) $balance->balance, 2, '.', ',');
            $values['fecha_saldo'] = Carbon::parse($balance->due)->locale('es')->translatedFormat('j \\d\\e F');
        }

        if ($service) {
            $values['hora_recojo'] = substr((string) $service->service_time, 0, 5);
        }

        return $values;
    }

    private function options(array $map): array
    {
        return collect($map)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all();
    }
}
