<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\PaxTemplateDirectory;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PaxMessageScheduler
{
    public const LIVE = ['pendiente_disponibilidad', 'confirmada', 'pendiente_pago', 'pendiente_proveedor', 'reprogramada', 'parcial', 'incidencia', 'en_operacion', 'completada'];

    private const SCHEDULED_EVENTS = ['reserva_confirmada', 'saldo_vence', 'viaje', 'fin_viaje', 'cumpleanos'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly RuleResolver $rules,
        private readonly CodeSequence $codes,
        private readonly PaxTemplateDirectory $directory,
    ) {}

    public function run(?string $reservationId = null): array
    {
        $now = CarbonImmutable::now();

        if (! $this->ruleOn('R-PAX-MESSAGES')) {
            return ['scheduled' => 0, 'updated' => 0, 'cancelled' => $this->cancelWhere(fn ($query) => $query, 'Mensajes automáticos apagados (R-PAX-MESSAGES)'), 'disabled' => true];
        }

        $templates = DB::table('notif_pax_message_templates')->where('active', true)->whereIn('event', self::SCHEDULED_EVENTS)->orderBy('code')->get();
        $reservations = $this->reservations($now, $reservationId);
        $wanted = [];
        $scheduled = 0;
        $updated = 0;

        foreach ($reservations as $reservation) {
            foreach ($this->templatesFor($templates, $reservation->lang) as $template) {
                if (! $this->matches($template, $reservation)) {
                    continue;
                }

                $at = $this->moment($template, $reservation);

                if ($at === null || $at->lessThan($now)) {
                    continue;
                }

                $values = $this->directory->values($reservation->id);

                foreach (PgArray::parse($template->channels) as $channel) {
                    $recipient = $this->recipient($channel, $reservation);

                    if ($recipient === null) {
                        continue;
                    }

                    $wanted["{$reservation->id}|{$template->id}|{$channel}"] = true;
                    $result = $this->upsert($reservation, $template, $channel, $recipient, $at, $values);
                    $scheduled += $result === 'created' ? 1 : 0;
                    $updated += $result === 'updated' ? 1 : 0;
                }
            }
        }

        $stale = DB::table('notif_pax_messages')->where('origin', 'auto')->where('status', 'programado')
            ->when($reservationId, fn ($query) => $query->where('reservation_id', $reservationId))
            ->get(['id', 'reservation_id', 'template_id', 'channel'])
            ->reject(fn (object $message): bool => isset($wanted["{$message->reservation_id}|{$message->template_id}|{$message->channel}"]))
            ->pluck('id');
        $cancelled = $stale->isEmpty() ? 0 : $this->cancelWhere(fn ($query) => $query->whereIn('id', $stale), 'La reserva o la plantilla ya no cumple las condiciones');

        return ['scheduled' => $scheduled, 'updated' => $updated, 'cancelled' => $cancelled, 'disabled' => false];
    }

    private function ruleOn(string $code): bool
    {
        $enabled = DB::table('sys_booking_rules')->where('code', $code)->value('enabled');

        return $enabled === null || ((bool) $enabled && $this->rules->forTenant()->planAllows($code));
    }

    public static function render(string $text, array $values): string
    {
        return (string) preg_replace_callback('/\{\{\s*([a-z_]+)\s*\}\}/', fn (array $match): string => (string) ($values[$match[1]] ?? ''), $text);
    }

    public function recipient(string $channel, object $reservation): ?string
    {
        return match ($channel) {
            'email' => $reservation->email ? Str::lower((string) $reservation->email) : null,
            'whatsapp' => $reservation->phone ?: null,
            'portal' => "Portal · {$reservation->code}",
            default => null,
        };
    }

    public function reservation(string $code): ?object
    {
        return $this->baseQuery()->where('r.code', $code)->first();
    }

    private function reservations(CarbonImmutable $now, ?string $reservationId): Collection
    {
        return $this->baseQuery()
            ->whereIn('r.status', self::LIVE)
            ->when($reservationId, fn ($query) => $query->where('r.id', $reservationId), fn ($query) => $query->where('r.travel_to', '>=', $now->subDays(30)->toDateString()))
            ->orderBy('r.travel_from')
            ->get();
    }

    private function baseQuery(): Builder
    {
        return DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->whereNull('r.deleted_at')
            ->select(['r.id', 'r.code', 'r.status', 'r.channel', 'r.travel_from', 'r.travel_to', 'r.created_at', 'c.email', 'c.phone', 'c.country', 'c.birth_date'])
            ->selectRaw("case when coalesce(upper(c.country), 'PE') in ('PE', 'PERU', 'PERÚ') then 'ES' else 'EN' end as lang");
    }

    private function templatesFor(Collection $templates, string $lang): Collection
    {
        return $templates->groupBy(fn (object $template): string => (string) ($template->group_code ?: $template->code))
            ->map(fn (Collection $group): ?object => $group->firstWhere('lang', $lang) ?? $group->firstWhere('lang', 'ES'))
            ->filter()
            ->values();
    }

    public function explain(object $template, object $reservation): array
    {
        $blocked = ! in_array($reservation->status, self::LIVE, true) ? 'la reserva no está vigente' : $this->blockReason($template, $reservation);
        $at = $this->moment($template, $reservation);

        return ['blocked' => $blocked ?? ($at === null ? 'no hay fecha para el momento del viaje elegido' : null), 'at' => $at?->toIso8601String(), 'lang' => $reservation->lang];
    }

    public function firstEligible(object $template): ?object
    {
        return $this->reservations(CarbonImmutable::now(), null)
            ->filter(fn (object $reservation): bool => $reservation->travel_from >= CarbonImmutable::now($this->context->timezone())->toDateString())
            ->first(fn (object $reservation): bool => $this->blockReason($template, $reservation) === null && $this->moment($template, $reservation) !== null);
    }

    private function matches(object $template, object $reservation): bool
    {
        return $this->blockReason($template, $reservation) === null;
    }

    private function blockReason(object $template, object $reservation): ?string
    {
        $conditions = (array) json_decode((string) $template->conditions, true);
        $products = array_values(array_filter((array) ($conditions['products'] ?? [])));
        $channels = array_values(array_filter((array) ($conditions['channels'] ?? [])));

        if ($channels !== [] && ! in_array($reservation->channel, $channels, true)) {
            return 'la reserva es de otro canal de venta';
        }

        if ($products !== [] && DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereIn('product_id', $products)->doesntExist()) {
            return 'la reserva no incluye los productos elegidos';
        }

        if (($conditions['requiresRule'] ?? null) && ! $this->ruleOn((string) $conditions['requiresRule'])) {
            return "la regla {$conditions['requiresRule']} está apagada";
        }

        if (($conditions['onlyIfBalance'] ?? false) && $this->balance($reservation->id) <= 0) {
            return 'la reserva no tiene saldo pendiente';
        }

        if (($conditions['onlyIfMissingDocs'] ?? false) && DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where(fn ($query) => $query->whereNull('doc_number')->orWhere('doc_number', '')->orWhere('pending', true))->doesntExist()) {
            return 'a la reserva no le faltan datos de acompañantes';
        }

        return null;
    }

    private function moment(object $template, object $reservation): ?CarbonImmutable
    {
        $zone = $this->context->timezone();
        $offset = (int) $template->offset_hours;

        if ($template->offset_from_rule) {
            $offset = (int) round((float) (((array) json_decode((string) DB::table('sys_booking_rules')->where('code', 'R-REVIEW-INVITE')->value('params'), true))['daysAfter'] ?? 0) * 24);
        }

        $base = match ($template->event) {
            'reserva_confirmada' => CarbonImmutable::parse((string) $reservation->created_at),
            'saldo_vence' => ($due = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'anulada'])->min('due_date')) ? CarbonImmutable::parse((string) $due, $zone) : null,
            'viaje' => CarbonImmutable::parse($reservation->travel_from.' '.($this->firstServiceTime($reservation->id) ?? '00:00'), $zone),
            'fin_viaje' => CarbonImmutable::parse((string) $reservation->travel_to, $zone),
            'cumpleanos' => $this->birthday($reservation, $zone),
            default => null,
        };

        return $base?->addHours($offset)->utc();
    }

    private function birthday(object $reservation, string $zone): ?CarbonImmutable
    {
        $birth = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderByDesc('is_lead')->orderBy('seq')->value('birth_date') ?? $reservation->birth_date;

        if ($birth === null) {
            return null;
        }

        $date = CarbonImmutable::parse((string) $birth, $zone);
        $today = CarbonImmutable::now($zone)->startOfDay();
        $next = $date->setYear($today->year);

        return $next->lessThan($today) ? $next->addYear() : $next;
    }

    private function firstServiceTime(string $reservationId): ?string
    {
        $time = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->whereNotNull('service_time')->orderBy('service_date')->orderBy('service_time')->value('service_time');

        return $time ? substr((string) $time, 0, 5) : null;
    }

    private function balance(string $reservationId): float
    {
        return (float) DB::table('fin_receivables')->where('reservation_id', $reservationId)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'anulada'])->selectRaw('coalesce(sum(amount - paid_amount), 0) as balance')->value('balance');
    }

    private function upsert(object $reservation, object $template, string $channel, string $recipient, CarbonImmutable $at, array $values): string
    {
        $existing = DB::table('notif_pax_messages')->where('reservation_id', $reservation->id)->where('template_id', $template->id)->where('channel', $channel)->where('origin', 'auto')->where('status', '<>', 'cancelado')->first(['id', 'status', 'scheduled_at', 'recipient']);
        $content = ['recipient' => $recipient, 'subject' => $template->subject ? self::render((string) $template->subject, $values) : null, 'body' => self::render((string) $template->body, $values), 'lang' => $template->lang];

        if ($existing !== null) {
            if ($existing->status !== 'programado') {
                return 'kept';
            }

            $same = CarbonImmutable::parse((string) $existing->scheduled_at)->equalTo($at) && $existing->recipient === $recipient;
            DB::table('notif_pax_messages')->where('id', $existing->id)->update([...$content, 'scheduled_at' => $at, 'updated_at' => now()]);

            return $same ? 'kept' : 'updated';
        }

        DB::table('notif_pax_messages')->insert([
            ...$content,
            'id' => (string) Str::uuid7(),
            'code' => $this->codes->next('notif_pax_messages', 'MSG-', 6),
            'reservation_id' => $reservation->id,
            'template_id' => $template->id,
            'channel' => $channel,
            'status' => 'programado',
            'direction' => 'saliente',
            'origin' => 'auto',
            'scheduled_at' => $at,
            'attempts' => 0,
        ]);

        return 'created';
    }

    private function cancelWhere(callable $scope, string $reason): int
    {
        return $scope(DB::table('notif_pax_messages')->where('origin', 'auto')->where('status', 'programado'))
            ->update(['status' => 'cancelado', 'error' => $reason, 'updated_at' => now()]);
    }
}
