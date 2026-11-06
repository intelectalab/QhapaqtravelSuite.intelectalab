<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
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
            'sample' => $this->sample(),
            'history' => $this->audit->recent(['Plantilla de mensaje'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }

    private function sample(): array
    {
        $reservation = DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->whereIn('r.status', ['confirmada', 'pendiente_pago', 'pendiente_proveedor', 'en_operacion'])
            ->orderByRaw('abs(r.travel_from - current_date)')
            ->first(['r.id', 'r.code', 'r.title', 'r.travel_from', 'r.currency', 'c.name as client_name']);

        $values = ['agencia' => $this->context->tenant()->commercial_name];

        if ($reservation === null) {
            return ['reservation' => null, 'values' => $values];
        }

        $lead = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderByDesc('is_lead')->orderBy('seq')->value('full_name');
        $service = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotNull('service_time')->orderBy('service_date')->orderBy('service_time')->first(['service_time']);
        $balance = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'anulada'])->selectRaw('sum(amount - paid_amount) as balance, min(due_date) as due, max(currency) as currency')->first();
        $values = [
            ...$values,
            'pasajero' => $lead ?? $reservation->client_name,
            'reserva' => $reservation->code,
            'producto' => $reservation->title,
            'fecha' => Carbon::parse($reservation->travel_from)->locale('es')->translatedFormat('j \d\e F'),
        ];

        if ($balance && (float) $balance->balance > 0) {
            $values['saldo'] = ($balance->currency === 'USD' ? 'US$ ' : 'S/ ').number_format((float) $balance->balance, 2, '.', ',');
            $values['fecha_saldo'] = Carbon::parse($balance->due)->locale('es')->translatedFormat('j \d\e F');
        }

        if ($service) {
            $values['hora_recojo'] = substr((string) $service->service_time, 0, 5);
        }

        return ['reservation' => $reservation->code, 'values' => $values];
    }

    private function options(array $map): array
    {
        return collect($map)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all();
    }
}
