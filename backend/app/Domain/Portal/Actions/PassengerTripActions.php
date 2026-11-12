<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Portal\Support\PassengerTrip;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use stdClass;

final class PassengerTripActions
{
    public const TOPICS = ['general' => 'Consulta general', 'horario' => 'Horarios y recojo', 'documentos' => 'Documentos', 'cambios' => 'Cambios', 'salud' => 'Salud'];

    public function __construct(
        private readonly PassengerTrip $trips,
        private readonly PortalMessages $tickets,
        private readonly RuleResolver $rules,
        private readonly ChannelKit $kit,
        private readonly AuditLogger $audit,
    ) {}

    public function ack(PortalAccount $account, string $incident): array
    {
        $ids = $account->reservations()->pluck('id')->all();
        $row = DB::table('ops_incidents')->where(Str::isUuid($incident) ? 'id' : 'code', $incident)
            ->whereIn('reservation_id', $ids)->whereIn('type', PassengerTrip::ALERT_TYPES)
            ->first(['id', 'code', 'assignee_id', 'reported_by', 'title'])
            ?? throw ApiException::notFound('No encontramos ese aviso en tu viaje.');
        $user = $account->user;

        return DB::transaction(function () use ($row, $user): array {
            $existing = DB::table('ops_incident_pax_acks')->where('incident_id', $row->id)->where('user_id', $user->getKey())->value('acknowledged_at');

            if ($existing !== null) {
                return ['code' => $row->code, 'acknowledged_at' => Carbon::parse($existing)->toIso8601String()];
            }

            $now = now();
            DB::table('ops_incident_pax_acks')->insert(['incident_id' => $row->id, 'user_id' => $user->getKey(), 'acknowledged_at' => $now]);
            DB::table('ops_incident_logs')->insert(['incident_id' => $row->id, 'user_id' => $user->getKey(), 'kind' => 'alerta', 'message' => "El pasajero {$user->name} confirmó la lectura del aviso.", 'visibility' => 'interna', 'created_by' => $user->getKey()]);
            $owner = $row->assignee_id ?? $row->reported_by;

            if ($owner) {
                app(NotificationLog::class)->record([
                    'event_code' => 'incidencia_acuse_pasajero',
                    'channel' => 'portal',
                    'recipient_user_id' => $owner,
                    'subject' => mb_substr("Lectura confirmada: {$row->title}", 0, 200),
                    'body_rendered' => "{$user->name} confirmó que leyó el aviso de la incidencia {$row->code}.",
                    'source_type' => 'ops_incident',
                    'source_id' => $row->id,
                ]);
            }

            $this->audit->log('Incidencia', (string) $row->code, 'acuse_pasajero', after: (string) $user->code);

            return ['code' => $row->code, 'acknowledged_at' => $now->toIso8601String()];
        });
    }

    public function send(PortalAccount $account, array $data): array
    {
        $reservation = $this->trips->reservation($account, $data['trip'] ?? null);
        $user = $account->user;
        $topic = $data['topic'] ?? 'general';

        return DB::transaction(function () use ($account, $reservation, $user, $data, $topic): array {
            $id = (string) Str::uuid7();
            DB::table('channel_trip_messages')->insert(['id' => $id, 'reservation_id' => $reservation->id, 'sender_type' => 'passenger', 'sender_user_id' => $user->getKey(), 'body' => $data['body'], 'created_by' => $user->getKey()]);
            $coordinator = DB::table('ops_orders')->where('reservation_id', $reservation->id)->where('status', '<>', 'cancelada')->value('coordinator_id');
            $ticket = $this->tickets->send($account, [
                'trip' => $reservation->code,
                'topic' => $topic === 'salud' ? 'salud' : 'general',
                'subject' => self::TOPICS[$topic].' · '.$reservation->title,
                'body' => $data['body'],
            ]);

            if ($coordinator) {
                DB::table('collab_conversations')->where('code', $ticket)->update(['assignee_id' => $coordinator, 'updated_at' => now()]);
            }

            return ['id' => $id, 'ticket' => $ticket, 'priority' => $topic === 'salud' ? 'alta' : 'media'];
        });
    }

    public function read(PortalAccount $account, ?string $id, ?string $code): int
    {
        $reservation = $this->trips->reservation($account, $code);
        $query = DB::table('channel_trip_messages')->where('reservation_id', $reservation->id)->where('sender_type', '<>', 'passenger')->whereNull('read_at');
        $notices = DB::table('notif_pax_messages')->where('reservation_id', $reservation->id)->whereIn('status', ['enviado', 'entregado']);
        $readNotice = ['status' => 'leido', 'read_at' => now(), 'updated_at' => now()];

        if ($id !== null && ! Str::isUuid($id)) {
            if (! DB::table('notif_pax_messages')->where('reservation_id', $reservation->id)->where('code', $id)->exists()) {
                throw ApiException::notFound('No encontramos ese mensaje en tu viaje.');
            }

            return $notices->where('code', $id)->update($readNotice);
        }

        if ($id === null) {
            return $query->update(['read_at' => now()]) + $notices->update($readNotice);
        }

        if (! DB::table('channel_trip_messages')->where('id', $id)->where('reservation_id', $reservation->id)->exists()) {
            throw ApiException::notFound('No encontramos ese mensaje en tu viaje.');
        }

        $query->where('id', $id);

        return $query->update(['read_at' => now()]);
    }

    public function companions(PortalAccount $account, ?string $code): array
    {
        $reservation = $this->trips->reservation($account, $code);
        $row = DB::table('booking_reservations')->where('id', $reservation->id)->first(['lock_version', 'travel_from']);
        $snapshot = DB::table('booking_reservation_web_snapshots')->where('reservation_id', $reservation->id)->orderBy('service_date')->first(['pickup_point', 'pickup_address', 'pickup_flight', 'pickup_arrival']);

        return [
            'code' => $reservation->code,
            'lock_version' => (int) $row->lock_version,
            'editable' => $this->editable($account, (string) $row->travel_from),
            'when' => $this->rules->on('R-COMPANIONS') ? (string) ($this->rules->param('R-COMPANIONS', 'when') ?? 'al_reservar') : 'opcional',
            'passengers' => DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')
                ->get(['seq', 'full_name', 'pax_type', 'doc_type', 'doc_number', 'nationality', 'birth_date', 'diet_notes', 'is_lead', 'pending', 'is_placeholder'])
                ->map(fn (stdClass $p): array => [
                    'seq' => (int) $p->seq,
                    'name' => $p->full_name,
                    'type' => $p->pax_type,
                    'doc_type' => $p->doc_type,
                    'document' => $p->doc_number ? '···'.substr((string) $p->doc_number, -3) : null,
                    'nationality' => $p->nationality,
                    'birth_date' => $p->birth_date,
                    'diet' => $p->diet_notes,
                    'lead' => (bool) $p->is_lead,
                    'pending' => (bool) $p->pending || (bool) $p->is_placeholder,
                ])->values()->all(),
            'pickup' => $snapshot ? ['point' => $snapshot->pickup_point, 'address' => $snapshot->pickup_address, 'flight' => $snapshot->pickup_flight, 'arrival' => $snapshot->pickup_arrival] : null,
        ];
    }

    public function updateCompanions(PortalAccount $account, ?string $code, array $data, ?int $lockVersion): array
    {
        $reservation = $this->trips->reservation($account, $code);
        $valid = Validator::make($data, [
            'passengers' => ['array', 'max:40'],
            'passengers.*.seq' => ['required', 'integer', 'min:1'],
            'passengers.*.first_name' => ['required', 'string', 'min:2', 'max:80'],
            'passengers.*.last_name' => ['required', 'string', 'min:2', 'max:80'],
            'passengers.*.birth_date' => ['required', 'date', 'before:today'],
            'passengers.*.doc_type' => ['required', 'in:DNI,CE,Pasaporte'],
            'passengers.*.doc_number' => ['required', 'string', 'min:6', 'max:20', 'regex:/^[A-Za-z0-9-]+$/'],
            'passengers.*.nationality' => ['required', 'string', 'max:60'],
            'passengers.*.diet' => ['nullable', 'string', 'max:120'],
            'pickup' => ['nullable', 'array'],
            'pickup.address' => ['nullable', 'string', 'max:200'],
            'pickup.flight' => ['nullable', 'string', 'max:40'],
            'pickup.arrival' => ['nullable', 'date'],
        ], [
            'passengers.*.first_name.*' => 'Escribe los nombres.',
            'passengers.*.last_name.*' => 'Escribe los apellidos.',
            'passengers.*.birth_date.*' => 'Indica la fecha de nacimiento.',
            'passengers.*.doc_type.*' => 'Elige el documento.',
            'passengers.*.doc_number.*' => 'Escribe un número de documento válido.',
            'passengers.*.nationality.*' => 'Indica la nacionalidad.',
        ])->validate();

        return DB::transaction(function () use ($account, $reservation, $valid, $lockVersion): array {
            $row = DB::table('booking_reservations')->where('id', $reservation->id)->lock('for no key update')->first(['id', 'code', 'lock_version', 'travel_from']);

            if ($lockVersion !== null && $lockVersion !== (int) $row->lock_version) {
                throw ApiException::conflict('STALE_VERSION', 'La reserva cambió mientras editabas. Recarga y vuelve a intentarlo.');
            }

            if (! $this->editable($account, (string) $row->travel_from)) {
                throw ApiException::unprocessable('R-COMPANIONS', 'Los datos de los viajeros ya no se pueden cambiar desde el portal. Escríbenos para actualizarlos.');
            }

            $first = Carbon::parse($row->travel_from);
            $errors = [];
            $changed = 0;

            foreach ($valid['passengers'] ?? [] as $index => $passenger) {
                $current = DB::table('booking_passengers')->where('reservation_id', $row->id)->where('seq', $passenger['seq'])->first(['id', 'pax_type']);

                if ($current === null) {
                    $errors["passengers.{$index}.seq"] = 'Ese viajero no es de esta reserva.';

                    continue;
                }

                $age = Carbon::parse($passenger['birth_date'])->diffInYears($first);
                $type = $age >= 12 ? 'ADT' : ($age >= 2 ? 'CHD' : 'INF');

                if ($type !== $current->pax_type) {
                    $errors["passengers.{$index}.birth_date"] = 'La edad no corresponde al tipo de viajero de la reserva ('.['ADT' => 'adulto', 'CHD' => 'niño', 'INF' => 'infante'][$current->pax_type].').';

                    continue;
                }

                DB::table('booking_passengers')->where('id', $current->id)->update([
                    'full_name' => Str::limit(trim($passenger['first_name'].' '.$passenger['last_name']), 145, ''),
                    'birth_date' => $passenger['birth_date'],
                    'doc_type' => $passenger['doc_type'],
                    'doc_number' => Str::upper((string) $passenger['doc_number']),
                    'nationality' => $passenger['nationality'],
                    'diet_notes' => $passenger['diet'] ?? null,
                    'pending' => false,
                    'is_placeholder' => false,
                    'updated_at' => now(),
                ]);
                $changed++;
            }

            if ($errors !== []) {
                throw ValidationException::withMessages($errors);
            }

            if (! empty($valid['pickup'])) {
                DB::table('booking_reservation_web_snapshots')->where('reservation_id', $row->id)->update([
                    'pickup_address' => $valid['pickup']['address'] ?? null,
                    'pickup_flight' => $valid['pickup']['flight'] ?? null,
                    'pickup_arrival' => $valid['pickup']['arrival'] ?? null,
                ]);
            }

            DB::table('booking_reservations')->where('id', $row->id)->update(['updated_at' => now()]);
            $this->audit->log('Reserva', (string) $row->code, 'completar_acompanantes', after: "{$changed} viajeros".(! empty($valid['pickup']) ? ' · recojo' : '').' · '.$account->user->code);

            return $this->companions($account, (string) $row->code);
        });
    }

    private function editable(PortalAccount $account, string $travelFrom): bool
    {
        if ($travelFrom <= $this->kit->today()) {
            return false;
        }

        $when = $this->rules->on('R-COMPANIONS') ? (string) ($this->rules->param('R-COMPANIONS', 'when') ?? 'al_reservar') : 'opcional';

        return ! $account->isPassenger() || in_array($when, ['antes_de_viaje', 'opcional'], true);
    }
}
