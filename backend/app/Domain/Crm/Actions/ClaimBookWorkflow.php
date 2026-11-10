<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\BusinessDays;
use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ClaimBookWorkflow
{
    private const SEDE_PREFIX = ['lima' => 'LIM', 'cusco' => 'CUS', 'arequipa' => 'AQP', 'puno' => 'PUN', 'trujillo' => 'TRU'];

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly BusinessDays $days,
        private readonly ClaimBookDirectory $directory,
    ) {}

    public function register(array $data, User $actor): string
    {
        $sede = DB::table('iam_sedes')->where('id', $data['sede_id'])->first(['id', 'name']) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige la sede donde se registra la hoja.');
        [$clientId, $reservationId] = $this->links($data);
        $now = Carbon::now($this->context->timezone());
        $responseDays = (int) $this->directory->settings()->response_days;

        return DB::transaction(function () use ($data, $actor, $sede, $clientId, $reservationId, $now, $responseDays): string {
            $prefix = 'LR-'.$this->prefix($sede->name).'-'.$now->year.'-';
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
                'ack_sent_at' => isset($data['consumer_email']) ? $now : null,
                'submitted_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $this->log($id, 'registro', null, 'abierta', "Hoja registrada en {$sede->name} (presencial)", $actor);
            $this->audit->log('Libro de reclamaciones', $number, 'registrar', null, "{$data['type']} · {$data['consumer_name']}");

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $claim = $this->find($code);

        if (! in_array($claim->book_status, ['received', 'in_review'], true)) {
            throw ApiException::conflict('LR-STATE', 'La hoja ya fue respondida; no se edita.');
        }

        $stored = json_decode((string) $claim->consumer, true) ?: [];
        $consumer = $this->consumer($data);
        $changed = collect(['name', 'docType', 'docNumber', 'address', 'email', 'phone'])->contains(fn (string $key): bool => (string) ($stored[$key] ?? '') !== (string) ($consumer[$key] ?? ''))
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

    public function evaluate(string $code, User $actor): void
    {
        $claim = $this->find($code);

        if ($claim->book_status !== 'received') {
            throw ApiException::conflict('LR-STATE', 'La hoja ya está en evaluación o respondida.');
        }

        DB::transaction(function () use ($claim, $actor): void {
            DB::table('crm_cases')->where('id', $claim->id)->update(['book_status' => 'in_review', 'status' => 'en_proceso', 'owner_id' => $actor->getKey(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->log($claim->id, 'estado', $claim->status, 'en_proceso', 'En evaluación', $actor);
            $this->audit->log('Libro de reclamaciones', $claim->book_number, 'evaluar', 'received', 'in_review');
        });
    }

    public function respond(string $code, array $data, User $actor): void
    {
        $claim = $this->find($code);

        if (! in_array($claim->book_status, ['received', 'in_review'], true)) {
            throw ApiException::conflict('LR-STATE', 'La hoja ya fue respondida.');
        }

        $consumer = json_decode((string) $claim->consumer, true) ?: [];
        $now = Carbon::now($this->context->timezone());
        $late = $claim->due_date && $now->copy()->startOfDay()->gt(Carbon::parse($claim->due_date));

        DB::transaction(function () use ($claim, $data, $actor, $consumer, $now, $late): void {
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
                    'sent_at' => $now->toIso8601String(),
                    'sent_to' => $consumer['email'] ?? null,
                ], JSON_UNESCAPED_UNICODE),
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->log($claim->id, 'estado', $claim->status, 'resuelta', 'Respuesta enviada'.($consumer['email'] ?? null ? " a {$consumer['email']}" : '').($late ? ' · fuera de plazo' : ''), $actor);
            $this->audit->log('Libro de reclamaciones', $claim->book_number, 'responder', $claim->book_status, 'answered'.($late ? ' · FUERA DE PLAZO' : ''));
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
        return [
            'name' => $data['consumer_name'],
            'docType' => $data['consumer_doc_type'],
            'docNumber' => $data['consumer_doc_number'],
            'address' => $data['consumer_address'] ?? null,
            'email' => $data['consumer_email'] ?? null,
            'phone' => $data['consumer_phone'] ?? null,
            'minor' => false,
            'guardian' => null,
        ];
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

    private function prefix(string $sede): string
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
