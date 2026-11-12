<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\ActivityDirectory;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\CrmNotices;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ActivityWorkflow
{
    public function __construct(
        private readonly ActivityDirectory $directory,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly Advisors $advisors,
    ) {}

    public function create(array $data, User $actor, ?string $previousId = null): string
    {
        $relatedId = $this->relatedId($data, $actor);
        $owner = $this->owner($data['owner_id'] ?? null, $actor) ?? $actor->getKey();
        $due = $this->dueAt($data['due_at']);
        $code = $this->nextCode();
        DB::table('crm_activities')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'type' => $data['type'],
            'subject' => trim($data['subject']),
            'description' => $data['description'] ?? null,
            'related_type' => $relatedId ? $data['related_type'] : null,
            'related_id' => $relatedId,
            'owner_id' => $owner,
            'due_at' => $due->copy()->utc(),
            'status' => 'pendiente',
            'previous_activity_id' => $previousId,
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Actividad', $code, 'crear', after: $data['subject']);
        app(CrmNotices::class)->activityAssigned($code, (string) $owner, (string) $actor->getKey());

        return $code;
    }

    public function scheduleFirstContact(object $lead, User $actor): string
    {
        $due = Carbon::now($this->timezone())->addHours(2);
        if ($due->hour >= 20) {
            $due = $due->setTime(20, 0);
        }

        return $this->create([
            'type' => 'llamada',
            'subject' => "Primer contacto — {$lead->full_name}",
            'related_type' => 'lead',
            'related_code' => $lead->code,
            'due_at' => $due->toIso8601String(),
        ], $actor);
    }

    public function complete(string $code, array $data, User $actor): ?string
    {
        $activity = $this->activity($code, $actor);

        if ($activity->status === 'completada') {
            throw ApiException::conflict('ACTIVITY_DONE', 'Esta actividad ya está completada.');
        }

        return DB::transaction(function () use ($activity, $data, $actor): ?string {
            DB::table('crm_activities')->where('id', $activity->id)->update([
                'status' => 'completada',
                'result' => trim($data['result']),
                'completed_at' => now(),
                'completed_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Actividad', $activity->code, 'completar', $activity->status, 'completada');

            if ($activity->related_type === 'lead' && in_array($activity->type, ['llamada', 'email', 'whatsapp', 'reunion'], true)) {
                $lead = DB::table('crm_leads')->where('id', $activity->related_id)->first();
                if ($lead && $lead->status === 'nuevo' && $lead->owner_id) {
                    DB::table('crm_leads')->where('id', $lead->id)->update(['status' => 'contactado', 'first_contact_at' => $lead->first_contact_at ?? now(), 'lock_version' => $lead->lock_version + 1, 'updated_at' => now()]);
                    $this->audit->log('Lead', $lead->code, 'primer_contacto', 'nuevo', 'contactado');
                }
            }

            if (empty($data['next'])) {
                return null;
            }

            $relatedCode = $activity->related_type
                ? DB::table(ActivityDirectory::RELATIONS[$activity->related_type]['table'])->where('id', $activity->related_id)->value('code')
                : null;

            return $this->create([
                'type' => $data['next']['type'],
                'subject' => $data['next']['subject'],
                'due_at' => $data['next']['due_at'],
                'related_type' => $activity->related_type,
                'related_code' => $relatedCode,
            ], $actor, $activity->id);
        });
    }

    public function reschedule(string $code, string $dueAt, ?string $reason, ?int $version, User $actor): void
    {
        $activity = $this->activity($code, $actor);

        if ($activity->status === 'completada') {
            throw ApiException::conflict('ACTIVITY_DONE', 'Esta actividad ya está completada.');
        }

        $due = $this->dueAt($dueAt);
        $this->write($activity, $version, ['due_at' => $due->copy()->utc(), 'status' => 'pendiente'], $actor);
        $this->audit->log('Actividad', $activity->code, 'reprogramar', Carbon::parse($activity->due_at)->toIso8601String(), trim($due->toIso8601String().($reason ? " · {$reason}" : '')));
    }

    public function update(string $code, array $data, User $actor): void
    {
        $activity = $this->activity($code, $actor);

        if ($activity->status === 'completada') {
            throw ApiException::conflict('ACTIVITY_DONE', 'Una actividad completada ya no se edita.');
        }

        $values = [
            'type' => $data['type'],
            'subject' => trim($data['subject']),
            'description' => trim((string) ($data['description'] ?? '')) ?: null,
        ];

        if (array_key_exists('related_type', $data)) {
            $values['related_id'] = $this->relatedId($data, $actor);
            $values['related_type'] = $values['related_id'] ? $data['related_type'] : null;
        }

        if (! empty($data['due_at']) && ! Carbon::parse($data['due_at'], $this->timezone())->startOfMinute()->equalTo(Carbon::parse($activity->due_at)->startOfMinute())) {
            $values['due_at'] = $this->dueAt($data['due_at'])->utc();
            $values['status'] = 'pendiente';
        }

        if (! empty($data['owner_id']) && $data['owner_id'] !== $activity->owner_id) {
            $values['owner_id'] = $this->owner($data['owner_id'], $actor);
        }

        $labels = ['type' => 'Tipo', 'subject' => 'Asunto', 'description' => 'Detalle', 'related_id' => 'Relación', 'due_at' => 'Fecha', 'owner_id' => 'Responsable'];
        $changed = array_filter($labels, fn (string $label, string $field) => array_key_exists($field, $values) && $this->differs($values[$field], $activity->{$field}), ARRAY_FILTER_USE_BOTH);

        if ($changed === []) {
            return;
        }

        $this->write($activity, isset($data['lock_version']) ? (int) $data['lock_version'] : null, $values, $actor);
        $this->audit->log('Actividad', $activity->code, 'editar', after: implode(', ', $changed));

        if (isset($changed['owner_id'])) {
            $this->audit->log('Actividad', $activity->code, 'reasignar', DB::table('iam_users')->where('id', $activity->owner_id)->value('name'), DB::table('iam_users')->where('id', $values['owner_id'])->value('name'));
            app(CrmNotices::class)->activityAssigned((string) $activity->code, (string) $values['owner_id'], (string) $actor->getKey());
        }
    }

    public function reassign(string $code, string $ownerId, ?string $note, ?int $version, User $actor): void
    {
        $activity = $this->activity($code, $actor);

        if ($activity->status === 'completada') {
            throw ApiException::conflict('ACTIVITY_DONE', 'Una actividad completada ya no se reasigna.');
        }

        if ($activity->owner_id === $ownerId) {
            throw ApiException::unprocessable('CRM-BR-31', 'Elige un responsable distinto del actual.');
        }

        if (! $this->advisors->has($ownerId, [...Advisors::ROLES, 'operations'])) {
            throw ApiException::unprocessable('CRM-BR-31', 'Elige un responsable activo de ventas u operaciones.');
        }

        $this->write($activity, $version, ['owner_id' => $ownerId], $actor);
        $before = DB::table('iam_users')->where('id', $activity->owner_id)->value('name');
        $after = DB::table('iam_users')->where('id', $ownerId)->value('name');
        $this->audit->log('Actividad', $activity->code, 'reasignar', $before, trim($after.($note ? " · {$note}" : '')));
        app(CrmNotices::class)->activityAssigned((string) $activity->code, $ownerId, (string) $actor->getKey());
    }

    public function delete(string $code, ?string $reason, User $actor): void
    {
        $activity = $this->activity($code, $actor);

        if ($activity->status === 'completada') {
            throw ApiException::conflict('ACTIVITY_DONE', 'Una actividad completada es parte del historial y no se elimina.');
        }

        if (DB::table('crm_activities')->where('previous_activity_id', $activity->id)->exists()) {
            throw ApiException::conflict('ACTIVITY_LINKED', 'Otra actividad viene de esta. Reprográmala en lugar de eliminarla.');
        }

        DB::table('crm_activities')->where('id', $activity->id)->delete();
        $this->audit->log('Actividad', $activity->code, 'eliminar', $activity->subject, $reason);
    }

    private function differs(mixed $next, mixed $previous): bool
    {
        if ($next instanceof Carbon) {
            return $previous === null || ! $next->equalTo(Carbon::parse($previous));
        }

        return (string) $next !== (string) $previous;
    }

    private function relatedId(array $data, User $actor): ?string
    {
        if (empty($data['related_type'])) {
            return null;
        }

        $config = ActivityDirectory::RELATIONS[$data['related_type']] ?? throw ApiException::unprocessable('CRM-BR-28', 'Ese tipo de relación no existe.');
        $query = DB::table($config['table'])->where('code', $data['related_code'] ?? '');
        $owned = in_array($data['related_type'], ActivityDirectory::OWNED, true) ? Portfolio::scope($query, $actor, 'owner_id') : $query;

        return $owned->value('id') ?? throw ApiException::unprocessable('CRM-BR-28', 'Elige el registro relacionado.');
    }

    private function owner(?string $requested, User $actor): ?string
    {
        if (! $requested || $requested === $actor->getKey()) {
            return $requested ?: null;
        }

        if (Portfolio::ownOnly($actor)) {
            throw ApiException::forbidden('CRM-BR-31', 'Solo un supervisor puede asignar la actividad a otra persona.');
        }

        if (! $this->advisors->has($requested, [...Advisors::ROLES, 'operations'])) {
            throw ApiException::unprocessable('CRM-BR-31', 'Elige un responsable activo de ventas u operaciones.');
        }

        return $requested;
    }

    private function write(object $activity, ?int $version, array $values, User $actor): void
    {
        $updated = DB::table('crm_activities')->where('id', $activity->id)->when($version !== null, fn ($query) => $query->where('lock_version', $version))
            ->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::conflict('STALE_VERSION', 'Alguien cambió esta actividad mientras la veías. Recarga la página e inténtalo de nuevo.');
        }
    }

    private function activity(string $code, User $actor): object
    {
        return $this->directory->scoped($actor)->where('a.code', $code)->first(['a.*']) ?? throw Portfolio::missing($actor, 'crm_activities', $code, 'La actividad no existe.', 'Esta actividad');
    }

    private function dueAt(string $value): Carbon
    {
        $due = Carbon::parse($value, $this->timezone());

        if ($due->lt(now()->subMinute())) {
            throw ApiException::unprocessable('DUE_IN_PAST', 'La fecha y hora no pueden ser anteriores a ahora.');
        }

        return $due;
    }

    private function nextCode(): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:crm_activities"]);
        $last = DB::table('crm_activities')->where('code', 'like', 'ACT-%')->orderByDesc('code')->value('code');

        return 'ACT-'.str_pad((string) ($last ? (int) Str::after($last, 'ACT-') + 1 : 1), 4, '0', STR_PAD_LEFT);
    }

    private function timezone(): string
    {
        return $this->context->tenant()->timezone ?: 'America/Lima';
    }
}
