<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Crm\Support\BusinessDays;
use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Domain\Crm\Support\ClaimConsumer;
use App\Domain\Crm\Support\ClaimNotices;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ClaimBookWorkflow
{
    private const SEDE_PREFIX = ['lima' => 'LIM', 'cusco' => 'CUS', 'arequipa' => 'AQP', 'puno' => 'PUN', 'trujillo' => 'TRU'];

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly BusinessDays $days,
        private readonly ClaimBookDirectory $directory,
        private readonly ClaimNotices $notices,
    ) {}

    public function register(array $data, User $actor): string
    {
        $sede = DB::table('iam_sedes')->where('id', $data['sede_id'])->first(['id', 'name']) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige la sede donde se registra la hoja.');
        [$clientId, $reservationId] = $this->links($data);
        $now = Carbon::now($this->context->timezone());
        $responseDays = (int) $this->directory->settings()->response_days;

        return DB::transaction(function () use ($data, $actor, $sede, $clientId, $reservationId, $now, $responseDays): string {
            $prefix = 'LR-'.self::sedePrefix($sede->name).'-'.$now->year.'-';
            $number = $this->codes->next('crm_cases', $prefix, 6, 'book_number');
            $code = $this->codes->next('crm_cases', 'REC-');
            $id = (string) Str::uuid7();

            DB::table('crm_cases')->insert([
                'id' => $id,
                'code' => $code,
                'client_id' => $clientId,
                'reservation_id' => $reservationId,
                'origin' => 'manual',
                'type_code' => $data['type'],
                'priority' => $data['type'] === 'reclamo' ? 'alta' : 'media',
                'subject' => Str::limit($data['detail'], 180),
                'description' => $data['detail'],
                'status' => 'abierta',
                'owner_id' => $actor->getKey(),
                'is_book' => true,
                'book_number' => $number,
                'sede_id' => $sede->id,
                'channel' => 'in_person',
                'book_status' => 'received',
                'consumer' => json_encode($this->consumer($data), JSON_UNESCAPED_UNICODE),
                'good' => json_encode(['kind' => $data['good_kind'], 'description' => $data['good_description'], 'amount' => (float) ($data['good_amount'] ?? 0), 'currency' => $data['good_currency'] ?? 'PEN'], JSON_UNESCAPED_UNICODE),
                'detail' => $data['detail'],
                'request' => $data['request'],
                'received_at' => $now,
                'due_date' => $this->days->add($now, $responseDays)->toDateString(),
                'response_days' => $responseDays,
                'ack_sent_at' => $now,
                'submitted_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $minor = ($data['is_minor'] ?? false) ? " · menor de edad, apoderado {$data['guardian_name']} ({$data['guardian_relation']})" : '';
            $this->log($id, 'registro', null, 'abierta', "Hoja registrada en {$sede->name} (presencial){$minor}. El consumidor aceptó recibir la respuesta en {$data['consumer_email']}", $actor);
            $this->audit->log('Libro de reclamaciones', $number, 'registrar', null, "{$data['type']} · {$data['consumer_name']}");

            if ($this->notices->acknowledge($id, (string) $actor->getKey()) === null) {
                DB::table('crm_cases')->where('id', $id)->update(['ack_sent_at' => null]);
            }

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $claim = $this->find($code);

        if (! in_array($claim->book_status, ['received', 'in_review'], true)) {
            throw ApiException::conflict('LR-STATE', 'La hoja ya fue respondida; no se edita.');
        }

        $stored = ClaimConsumer::read(json_decode((string) $claim->consumer, true) ?: []);
        $consumer = ClaimConsumer::read($this->consumer($data));
        $changed = collect(['name', 'doc_type', 'doc_number', 'address', 'email', 'phone'])->contains(fn (string $key): bool => (string) ($stored[$key] ?? '') !== (string) ($consumer[$key] ?? ''))
            || (string) $claim->detail !== (string) $data['detail']
            || (string) $claim->request !== (string) $data['request'];

        if ($changed) {
            throw ApiException::unprocessable('LR-BR-08', 'Los datos del consumidor, el detalle y el pedido de la hoja no se modifican.');
        }

        [$clientId, $reservationId] = $this->links($data);
        DB::table('crm_cases')->where('id', $claim->id)->update([
            'client_id' => $clientId,
            'reservation_id' => $reservationId,
            'type_code' => $data['type'],
            'good' => json_encode(['kind' => $data['good_kind'], 'description' => $data['good_description'], 'amount' => (float) ($data['good_amount'] ?? 0), 'currency' => $data['good_currency'] ?? 'PEN'], JSON_UNESCAPED_UNICODE),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->log($claim->id, 'seguimiento', $claim->status, $claim->status, 'Datos de la hoja actualizados', $actor);
        $this->audit->log('Libro de reclamaciones', $claim->book_number, 'vincular', null, $data['type']);
    }

    public function evaluate(string $code, User $actor, ?string $ownerId = null, ?string $note = null): void
    {
        $claim = $this->find($code);

        if ($claim->book_status !== 'received') {
            throw ApiException::conflict('LR-STATE', 'La hoja ya está en evaluación o respondida.');
        }

        $owner = $ownerId ?? (string) $actor->getKey();

        if ($ownerId !== null && ! DB::table('iam_users')->where('id', $ownerId)->where('status', 'activo')->whereNull('deleted_at')->exists()) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un responsable activo de la agencia.');
        }

        DB::transaction(function () use ($claim, $actor, $owner, $note): void {
            DB::table('crm_cases')->where('id', $claim->id)->update(['book_status' => 'in_review', 'status' => 'en_proceso', 'owner_id' => $owner, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $name = (string) DB::table('iam_users')->where('id', $owner)->value('name');
            $this->log($claim->id, 'estado', $claim->status, 'en_proceso', "En evaluación · responsable {$name}".($note ? " · {$note}" : ''), $actor);
            $this->audit->log('Libro de reclamaciones', $claim->book_number, 'evaluar', 'received', "in_review · {$name}");
            app(StaffNotices::class)->toUser($owner, 'reclamacion.asignada', "{$claim->book_number} · hoja a tu cargo", trim('Responde dentro del plazo legal.'.($note ? " {$note}" : '')), 'crm_case', (string) $claim->id, null, (string) $actor->getKey());
        });
    }

    public function respond(string $code, array $data, User $actor): void
    {
        $claim = $this->find($code);

        if (! in_array($claim->book_status, ['received', 'in_review'], true)) {
            throw ApiException::conflict('LR-STATE', 'La hoja ya fue respondida.');
        }

        $consumer = ClaimConsumer::read(json_decode((string) $claim->consumer, true) ?: []);
        $now = Carbon::now($this->context->timezone());
        $late = $claim->due_date && $now->copy()->startOfDay()->gt(Carbon::parse($claim->due_date));

        DB::transaction(function () use ($claim, $data, $actor, $consumer, $now, $late): void {
            $notification = $this->notices->respond($claim->id, $data['decision'], $data['text'], $data['actions'] ?? null, (string) $actor->getKey());
            DB::table('crm_cases')->where('id', $claim->id)->update([
                'book_status' => 'answered',
                'status' => 'resuelta',
                'resolution' => $data['text'],
                'resolved_at' => $now,
                'response' => json_encode([
                    'decision' => $data['decision'],
                    'text' => $data['text'],
                    'actions' => $data['actions'] ?? null,
                    'answered_at' => $now->toIso8601String(),
                    'answered_by' => $actor->getKey(),
                    'sent_at' => $notification ? $now->toIso8601String() : null,
                    'sent_to' => $notification ? ($consumer['email'] ?? null) : null,
                    'notification_id' => $notification,
                ], JSON_UNESCAPED_UNICODE),
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->log($claim->id, 'estado', $claim->status, 'resuelta', ($notification ? "Respuesta enviada a {$consumer['email']}" : 'Respuesta registrada; el consumidor no dejó correo').($late ? ' · fuera de plazo' : ''), $actor);
            $this->audit->log('Libro de reclamaciones', $claim->book_number, 'responder', $claim->book_status, 'answered'.($late ? ' · FUERA DE PLAZO' : ''));
        });
    }

    public function resend(string $code, User $actor): string
    {
        $claim = $this->find($code);
        $response = json_decode((string) $claim->response, true) ?: [];

        if ($claim->book_status !== 'answered' || ($response['text'] ?? null) === null) {
            throw ApiException::conflict('LR-STATE', 'La hoja todavía no tiene una respuesta para reenviar.');
        }

        return DB::transaction(function () use ($claim, $response, $actor): string {
            $notification = $this->notices->respond((string) $claim->id, (string) ($response['decision'] ?? ''), (string) $response['text'], $response['actions'] ?? null, (string) $actor->getKey())
                ?? throw ApiException::unprocessable('LR-BR-06', 'El consumidor no dejó un correo válido: entrega la respuesta por otro medio.');
            $consumer = ClaimConsumer::read(json_decode((string) $claim->consumer, true) ?: []);
            DB::table('crm_cases')->where('id', $claim->id)->update(['response' => json_encode([...$response, 'sent_at' => now()->toIso8601String(), 'sent_to' => $consumer['email'] ?? null, 'notification_id' => $notification, 'resent' => (int) ($response['resent'] ?? 0) + 1], JSON_UNESCAPED_UNICODE), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->log($claim->id, 'seguimiento', $claim->status, $claim->status, 'Respuesta reenviada a '.($consumer['email'] ?? ''), $actor);
            $this->audit->log('Libro de reclamaciones', $claim->book_number, 'reenviar_respuesta', null, (string) ($consumer['email'] ?? ''));

            return (string) ($consumer['email'] ?? '');
        });
    }

    public function saveSettings(array $data, User $actor): array
    {
        $current = DB::table('crm_claim_book_settings')->first(['id', 'response_days', 'alert_days', 'retention_years']);

        if (! isset($data['response_days']) && array_key_exists('holidays', $data)) {
            $this->saveHolidays($data['holidays'], $actor);

            return ['response_days' => (int) ($current->response_days ?? 15), 'alert_days' => (int) ($current->alert_days ?? 3), 'retention_years' => (int) ($current->retention_years ?? 2)];
        }

        if ((int) $data['alert_days'] >= (int) $data['response_days']) {
            throw ValidationException::withMessages(['alert_days' => 'La alerta debe llegar antes de que venza el plazo de respuesta.']);
        }

        $values = ['response_days' => (int) $data['response_days'], 'alert_days' => (int) $data['alert_days'], 'retention_years' => (int) $data['retention_years']];

        if (array_key_exists('holidays', $data)) {
            $this->saveHolidays($data['holidays'], $actor);
        }

        DB::transaction(function () use ($current, $values, $actor): void {
            if ($current === null) {
                DB::table('crm_claim_book_settings')->insert([...$values, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            } else {
                DB::table('crm_claim_book_settings')->where('id', $current->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $before = $current ? "{$current->response_days} días · alerta {$current->alert_days} · {$current->retention_years} años" : null;
            $this->audit->log('Libro de reclamaciones', 'configuracion', 'actualizar', $before, "{$values['response_days']} días · alerta {$values['alert_days']} · {$values['retention_years']} años");
        });

        return $values;
    }

    private function saveHolidays(array $holidays, User $actor): void
    {
        $wanted = collect($holidays)->mapWithKeys(fn (array $row): array => [(string) $row['date'] => trim((string) $row['name'])]);

        DB::transaction(function () use ($wanted, $actor): void {
            $existing = DB::table('sys_holidays')->where('date', '>=', now(app(TenantContext::class)->timezone())->startOfYear()->toDateString())->get(['id', 'date', 'name'])->keyBy(fn (object $row): string => substr((string) $row->date, 0, 10));
            $removed = $existing->keys()->diff($wanted->keys());
            $added = $wanted->keys()->diff($existing->keys());

            DB::table('sys_holidays')->whereIn('id', $existing->only($removed->all())->pluck('id')->all())->delete();

            foreach ($wanted as $date => $name) {
                if (isset($existing[$date])) {
                    if ($existing[$date]->name !== $name) {
                        DB::table('sys_holidays')->where('id', $existing[$date]->id)->update(['name' => $name, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                    }

                    continue;
                }

                DB::table('sys_holidays')->insert(['date' => $date, 'name' => $name, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            }

            if ($removed->isNotEmpty() || $added->isNotEmpty()) {
                $this->audit->log('Libro de reclamaciones', 'feriados', 'actualizar_feriados', $existing->count().' feriados', $wanted->count().' feriados'.($added->isNotEmpty() ? ' · agrega '.$added->implode(', ') : '').($removed->isNotEmpty() ? ' · quita '.$removed->implode(', ') : ''));
            }
        });
    }

    public function close(string $code, string $note, User $actor): void
    {
        $claim = $this->find($code);

        if ($claim->book_status !== 'answered') {
            throw ApiException::conflict('LR-STATE', 'Primero responde la hoja; luego se cierra.');
        }

        DB::transaction(function () use ($claim, $note, $actor): void {
            DB::table('crm_cases')->where('id', $claim->id)->update(['book_status' => 'closed', 'status' => 'cerrada', 'close_note' => $note, 'closed_at' => now(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->log($claim->id, 'estado', $claim->status, 'cerrada', "Hoja cerrada · {$note}", $actor);
            $this->audit->log('Libro de reclamaciones', $claim->book_number, 'cerrar', 'answered', 'closed');
        });
    }

    private function consumer(array $data): array
    {
        return ClaimConsumer::build([
            'name' => $data['consumer_name'],
            'doc_type' => $data['consumer_doc_type'],
            'doc_number' => $data['consumer_doc_number'],
            'address' => $data['consumer_address'] ?? null,
            'email' => $data['consumer_email'] ?? null,
            'phone' => $data['consumer_phone'] ?? null,
        ], $data);
    }

    private function links(array $data): array
    {
        $client = isset($data['client']) ? DB::table('crm_clients')->whereNull('deleted_at')->where('code', $data['client'])->value('id') : null;
        $reservation = isset($data['reservation']) ? DB::table('booking_reservations')->whereNull('deleted_at')->where('code', $data['reservation'])->first(['id', 'client_id']) : null;

        if ($reservation && $client && $reservation->client_id !== $client) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La reserva no pertenece a ese cliente.');
        }

        return [$client ?? $reservation?->client_id, $reservation?->id];
    }

    public static function sedePrefix(string $sede): string
    {
        $first = Str::lower(Str::ascii(strtok($sede, ' —') ?: $sede));

        return self::SEDE_PREFIX[$first] ?? Str::upper(Str::substr($first, 0, 3));
    }

    private function find(string $code): object
    {
        return DB::table('crm_cases')->where('is_book', true)->where('code', $code)->first() ?? throw ApiException::notFound('La hoja de reclamación no existe.');
    }

    private function log(string $caseId, string $event, ?string $from, ?string $to, string $message, User $actor): void
    {
        DB::table('crm_case_events')->insert([
            'id' => (string) Str::uuid7(),
            'case_id' => $caseId,
            'event' => $event,
            'from_status' => $from,
            'to_status' => $to,
            'message' => $message,
            'user_id' => $actor->getKey(),
            'created_by' => $actor->getKey(),
        ]);
    }
}
