<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\CrmNotices;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AfterSalesWorkflow
{
    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly ActivityWorkflow $activities,
        private readonly TenantContext $context,
    ) {}

    public function recordSurvey(array $data, User $actor): string
    {
        $client = $this->client($data['client'], $actor);
        $reservation = $this->reservation($data['reservation'] ?? null, $client->id);

        if ($reservation && DB::table('crm_surveys')->where('reservation_id', $reservation->id)->exists()) {
            throw ApiException::conflict('CRM-BR-41', "La reserva {$reservation->code} ya tiene una encuesta registrada.");
        }

        return DB::transaction(function () use ($data, $actor, $client, $reservation): string {
            $code = $this->codes->next('crm_surveys', 'ENC-');
            $id = (string) Str::uuid7();
            $score = (int) $data['score'];

            DB::table('crm_surveys')->insert([
                'id' => $id,
                'code' => $code,
                'client_id' => $client->id,
                'reservation_id' => $reservation?->id,
                'score' => $score,
                'comment' => $data['comment'] ?? null,
                'channel_code' => $data['channel'],
                'responded_at' => now(),
                'recorded_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            DB::table('crm_clients')->where('id', $client->id)->update(['nps_last' => $score, 'updated_at' => now()]);
            $this->audit->log('Encuesta', $code, 'crear', null, "NPS {$score} · {$client->code}");
            $this->audit->log('Cliente', $client->code, 'actualizar_nps', $client->nps_last === null ? null : (string) $client->nps_last, (string) $score);

            if ($score <= 6) {
                $case = $this->openCase([
                    'client_id' => $client->id,
                    'reservation_id' => $reservation?->id,
                    'survey_id' => $id,
                    'origin' => 'nps_auto',
                    'type_code' => 'reclamo',
                    'priority' => $score <= 3 ? 'alta' : 'media',
                    'subject' => "Detractor NPS {$score} — ".($reservation->code ?? $client->name),
                    'description' => ($data['comment'] ?? null) ?: 'Encuesta con puntaje de detractor. Contactar al cliente para entender qué falló.',
                    'owner_id' => $client->owner_id,
                ], $actor, 'Caso creado automáticamente por NPS de detractor');
                $activity = $this->activities->create([
                    'type' => 'postventa',
                    'subject' => Str::limit("Resolver {$case} — contactar a {$client->name}", 200, ''),
                    'related_type' => 'client',
                    'related_code' => $client->code,
                    'due_at' => Carbon::now($this->context->timezone())->addDay()->setTime(10, 0)->toIso8601String(),
                ], $actor);
                DB::table('crm_activities')->where('code', $activity)->update(['owner_id' => $client->owner_id]);
                app(CrmNotices::class)->detractor($case, $client->owner_id, (string) $client->name, $score, $data['comment'] ?? null);
            }

            return $code;
        });
    }

    public function updateSurvey(string $code, array $data, User $actor): void
    {
        $survey = Portfolio::scope(DB::table('crm_surveys as s')->join('crm_clients as c', 'c.id', '=', 's.client_id'), $actor, 'c.owner_id')->where('s.code', $code)->first(['s.id', 's.score', 's.client_id'])
            ?? throw ApiException::notFound('La encuesta no existe.');

        DB::table('crm_surveys')->where('id', $survey->id)->update(['score' => $data['score'], 'comment' => $data['comment'] ?? null, 'channel_code' => $data['channel'], 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $latest = DB::table('crm_surveys')->where('client_id', $survey->client_id)->orderByDesc('responded_at')->value('code');
        if ($latest === $code) {
            DB::table('crm_clients')->where('id', $survey->client_id)->update(['nps_last' => $data['score'], 'updated_at' => now()]);
        }
        $this->audit->log('Encuesta', $code, 'editar', (string) $survey->score, (string) $data['score']);
    }

    public function createCase(array $data, User $actor): string
    {
        $client = $this->client($data['client'], $actor);
        $reservation = $this->reservation($data['reservation'] ?? null, $client->id);
        $owner = $data['owner_id'] ?? null;

        if (Portfolio::ownOnly($actor) || $owner === null) {
            $owner = $actor->getKey();
        }

        return DB::transaction(fn (): string => $this->openCase([
            'client_id' => $client->id,
            'reservation_id' => $reservation?->id,
            'origin' => 'manual',
            'type_code' => $data['type'],
            'priority' => $data['priority'],
            'subject' => $data['subject'],
            'description' => $data['description'],
            'owner_id' => $owner,
        ], $actor, 'Caso registrado'));
    }

    public function updateCase(string $code, array $data, User $actor): void
    {
        $case = $this->case($code, $actor);

        if ($case->status === 'cerrada') {
            throw ApiException::conflict('CRM-CASE-CLOSED', 'El caso está cerrado; ya no se edita.');
        }

        $values = ['priority' => $data['priority'], 'subject' => $data['subject'], 'description' => $data['description'], 'type_code' => $data['type'], 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()];
        if (! Portfolio::ownOnly($actor) && isset($data['owner_id'])) {
            $values['owner_id'] = $data['owner_id'];
        }

        DB::table('crm_cases')->where('id', $case->id)->update($values);
        $this->audit->log('Reclamo (caso)', $code, 'editar', "{$case->priority} · {$case->subject}", "{$data['priority']} · {$data['subject']}");
    }

    public function transition(string $code, string $step, ?string $note, User $actor): void
    {
        $case = $this->case($code, $actor);
        [$allowed, $target] = match ($step) {
            'start' => [['abierta'], 'en_proceso'],
            'resolve' => [['abierta', 'en_proceso'], 'resuelta'],
            'close' => [['resuelta'], 'cerrada'],
            default => [['abierta', 'en_proceso'], $case->status],
        };

        if (! in_array($case->status, $allowed, true)) {
            throw ApiException::conflict('CRM-CASE-STATE', 'Ese paso no aplica al estado actual del caso.');
        }

        if (in_array($step, ['resolve', 'followup'], true) && trim((string) $note) === '') {
            throw ApiException::unprocessable('CRM-BR-43', $step === 'resolve' ? 'Escribe cómo se resolvió.' : 'Escribe la nota de seguimiento.');
        }

        DB::transaction(function () use ($case, $step, $note, $actor, $target): void {
            $values = ['status' => $target, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()];
            if ($step === 'resolve') {
                $values += ['resolution' => $note, 'resolved_at' => now()];
            }
            if ($step === 'close') {
                $values += ['closed_at' => now()];
            }

            DB::table('crm_cases')->where('id', $case->id)->update($values);
            DB::table('crm_case_events')->insert([
                'id' => (string) Str::uuid7(),
                'case_id' => $case->id,
                'event' => $step === 'followup' ? 'seguimiento' : 'estado',
                'from_status' => $case->status,
                'to_status' => $target,
                'message' => $note ?: match ($step) {
                    'start' => 'Atención iniciada',
                    'close' => 'Caso cerrado',
                    default => 'Caso resuelto',
                },
                'user_id' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Reclamo (caso)', $case->code, $step === 'followup' ? 'seguimiento' : 'cambio_estado', $case->status, $target.($note ? ' · '.mb_substr($note, 0, 60) : ''));

            if ($step === 'close') {
                app(CrmNotices::class)->caseClosed((string) $case->id);
            }
        });
    }

    public function openCase(array $values, User $actor, string $message): string
    {
        $code = $this->codes->next('crm_cases', 'REC-');
        $id = (string) Str::uuid7();
        $praise = $values['type_code'] === 'felicitacion';

        DB::table('crm_cases')->insert([
            ...$values,
            'id' => $id,
            'code' => $code,
            'status' => $praise ? 'cerrada' : 'abierta',
            'resolution' => $praise ? 'Felicitación registrada.' : null,
            'closed_at' => $praise ? now() : null,
            'is_book' => false,
            'created_by' => $actor->getKey(),
        ]);
        DB::table('crm_case_events')->insert([
            'id' => (string) Str::uuid7(),
            'case_id' => $id,
            'event' => 'registro',
            'to_status' => $praise ? 'cerrada' : 'abierta',
            'message' => $message,
            'user_id' => $actor->getKey(),
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Reclamo (caso)', $code, 'crear', null, "{$values['type_code']} · {$values['priority']}");

        if (! $praise) {
            app(CrmNotices::class)->caseAssigned($code, $values['owner_id'] ?? null, (string) $actor->getKey());
        }

        return $code;
    }

    private function case(string $code, User $actor): object
    {
        return Portfolio::scope(DB::table('crm_cases')->where('is_book', false), $actor, 'owner_id')->where('code', $code)->first()
            ?? throw ApiException::notFound('El caso no existe o no está en tu cartera.');
    }

    private function client(string $code, User $actor): object
    {
        return Portfolio::clients(DB::table('crm_clients')->whereNull('deleted_at'), $actor)->where('code', $code)->first(['id', 'code', 'name', 'owner_id', 'nps_last'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un cliente de tu cartera.');
    }

    private function reservation(?string $code, string $clientId): ?object
    {
        if ($code === null || $code === '') {
            return null;
        }

        $reservation = DB::table('booking_reservations')->whereNull('deleted_at')->where('code', $code)->first(['id', 'code', 'client_id', 'status']);

        if ($reservation === null || $reservation->client_id !== $clientId || $reservation->status === 'cancelada') {
            throw ApiException::unprocessable('CRM-BR-38', 'La reserva debe ser del mismo cliente y no estar cancelada.');
        }

        return $reservation;
    }
}
