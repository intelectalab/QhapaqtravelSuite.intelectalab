<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\ClientDocument;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LeadWorkflow
{
    private const OPEN = ['nuevo', 'contactado', 'calificado'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CrmCatalog $catalog,
        private readonly TenantContext $context,
        private readonly ActivityWorkflow $activities,
        private readonly CodeSequence $codes,
        private readonly Advisors $advisors,
    ) {}

    public function create(array $data, User $actor): array
    {
        $this->assertCatalog($data);
        $matches = $this->duplicates($data['email'] ?? null, $data['phone'] ?? null);
        $resolution = $data['duplicate_resolution'] ?? null;

        if ($matches !== [] && $resolution === null) {
            throw ApiException::conflict('CRM-BR-04', 'Ya existe un lead o cliente con ese correo o teléfono. Elige qué hacer.', ['matches' => $matches]);
        }

        $owner = Portfolio::ownOnly($actor) ? $actor->getKey() : ($data['owner_id'] ?? null);
        $first = $matches[0] ?? null;
        $code = $this->nextCode('crm_leads', 'LEAD-');
        $notes = trim((string) ($data['notes'] ?? ''));

        if ($resolution === 'create_new' && $first) {
            $notes = trim("{$notes}\nRegistrado pese a coincidencia con {$first['code']}.");
        }

        DB::table('crm_leads')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'full_name' => trim($data['name']),
            'company' => $data['company'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'phone_norm' => $this->phoneNorm($data['phone'] ?? null),
            'channel_code' => $data['channel'],
            'source_code' => $data['source'],
            'interest_code' => $data['interest'],
            'destination_label' => $data['destination'] ?? null,
            'travel_date' => $data['travel_date'] ?? null,
            'pax' => (int) ($data['pax'] ?? 0),
            'status' => $resolution === 'mark_duplicate' ? 'duplicado' : 'nuevo',
            'owner_id' => $resolution === 'mark_duplicate' ? null : $owner,
            'score' => $this->initialScore($data),
            'notes' => $notes ?: null,
            'duplicate_of_type' => $resolution === 'mark_duplicate' ? $first['type'] : null,
            'duplicate_of_id' => $resolution === 'mark_duplicate' ? $first['id'] : null,
            'assigned_at' => $owner ? now() : null,
            'created_by' => $actor->getKey(),
        ]);

        $this->audit->log('Lead', $code, 'crear', after: $resolution === 'mark_duplicate' ? 'duplicado' : 'nuevo');

        return ['code' => $code];
    }

    public function update(string $code, array $data, int $version, User $actor): void
    {
        $lead = $this->lead($code, $actor);
        $this->assertOpen($lead);
        $this->assertCatalog($data);

        $values = [
            'full_name' => trim($data['name']),
            'company' => trim((string) ($data['company'] ?? '')) ?: null,
            'email' => trim((string) ($data['email'] ?? '')) ?: null,
            'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
            'phone_norm' => $this->phoneNorm($data['phone'] ?? null),
            'channel_code' => $data['channel'],
            'source_code' => $data['source'],
            'interest_code' => $data['interest'],
            'destination_label' => trim((string) ($data['destination'] ?? '')) ?: null,
            'travel_date' => $data['travel_date'] ?? null,
            'pax' => (int) ($data['pax'] ?? 0),
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
        ];
        if ($values['travel_date'] && $values['travel_date'] !== $lead->travel_date && $values['travel_date'] < now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString()) {
            throw ApiException::unprocessable('CRM-BR-05', 'La fecha de viaje no puede ser anterior a hoy.');
        }

        $labels = ['full_name' => 'Nombre', 'company' => 'Empresa', 'email' => 'Correo', 'phone' => 'Teléfono', 'channel_code' => 'Canal', 'source_code' => 'Fuente', 'interest_code' => 'Interés', 'destination_label' => 'Destino', 'travel_date' => 'Fecha de viaje', 'pax' => 'Pasajeros', 'notes' => 'Notas'];
        $changed = array_filter($labels, fn (string $label, string $field) => (string) $values[$field] !== (string) $lead->{$field}, ARRAY_FILTER_USE_BOTH);

        if ($changed === []) {
            return;
        }

        $this->save($lead, $version, $values, $actor);
        $this->audit->log('Lead', $code, 'editar', after: implode(', ', $changed));
    }

    public function assign(string $code, string $ownerId, bool $firstContact, ?string $reason, User $actor): void
    {
        if (! $actor->can('crm.records.reassign')) {
            throw ApiException::forbidden('CRM-BR-09', 'Solo Gerencia o la Administración pueden asignar o reasignar leads.', ['crm.records.reassign']);
        }

        $lead = $this->lead($code, $actor);
        $this->assertOpen($lead);

        if ($lead->owner_id === $ownerId) {
            throw ApiException::unprocessable('CRM-BR-09', 'Elige un asesor distinto del actual.');
        }

        if (! $this->advisors->has($ownerId)) {
            throw ApiException::unprocessable('CRM-BR-09', 'Elige un asesor activo de la lista.');
        }

        DB::transaction(function () use ($lead, $ownerId, $firstContact, $reason, $actor): void {
            DB::table('crm_leads')->where('id', $lead->id)->update([
                'owner_id' => $ownerId,
                'assigned_at' => now(),
                'lock_version' => $lead->lock_version + 1,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            DB::table('crm_activities')->where('related_type', 'lead')->where('related_id', $lead->id)->whereIn('status', ['pendiente', 'vencida'])
                ->update(['owner_id' => $ownerId, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            $before = $lead->owner_id ? DB::table('iam_users')->where('id', $lead->owner_id)->value('name') : null;
            $after = DB::table('iam_users')->where('id', $ownerId)->value('name');
            $this->audit->log('Lead', $lead->code, $lead->owner_id ? 'reasignar' : 'asignar', $before, trim($after.($reason ? " · {$reason}" : '')));

            if ($firstContact) {
                $activity = $this->activities->scheduleFirstContact(DB::table('crm_leads')->where('id', $lead->id)->first(), $actor);
                DB::table('crm_activities')->where('code', $activity)->update(['owner_id' => $ownerId]);
            }
        });
    }

    public function take(string $code, User $actor): void
    {
        $taken = DB::table('crm_leads')->where('code', $code)->whereNull('owner_id')->whereNull('deleted_at')->whereIn('status', self::OPEN)
            ->update(['owner_id' => $actor->getKey(), 'taken_by' => $actor->getKey(), 'assigned_at' => now(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey()]);

        if ($taken === 0) {
            throw ApiException::conflict('LEAD_TAKEN', 'Otro asesor tomó este lead antes que tú.');
        }

        $this->audit->log('Lead', $code, 'tomar_lead', after: $actor->name);
        $this->activities->scheduleFirstContact(DB::table('crm_leads')->where('code', $code)->first(), $actor);
    }

    public function changeStatus(string $code, string $status, int $version, User $actor): void
    {
        $lead = $this->lead($code, $actor);
        $this->assertOpen($lead);

        if ($status !== 'nuevo' && $lead->owner_id === null) {
            throw ApiException::conflict('CRM-BR-11', 'Asigna un responsable antes de avanzar el lead.');
        }

        if ($status === 'calificado' && $lead->score < 50) {
            throw ApiException::conflict('CRM-BR-10', 'Para marcarlo como calificado el puntaje debe ser 50 o más. Califícalo primero.');
        }

        $this->save($lead, $version, [
            'status' => $status,
            'first_contact_at' => $status !== 'nuevo' ? ($lead->first_contact_at ?? now()) : $lead->first_contact_at,
        ], $actor);
        $this->audit->log('Lead', $code, 'cambio_estado', $lead->status, $status);
    }

    public function qualify(string $code, array $bant, int $version, bool $markQualified, User $actor): array
    {
        $lead = $this->lead($code, $actor);
        $this->assertOpen($lead);
        $score = (int) $bant['budget'] + (int) $bant['authority'] + (int) $bant['need'] + (int) $bant['timeline'];

        if ($markQualified && $score < 50) {
            throw ApiException::conflict('CRM-BR-10', "El puntaje BANT es {$score}; para calificar el lead debe ser 50 o más.");
        }

        DB::transaction(function () use ($lead, $bant, $score, $version, $markQualified, $actor): void {
            DB::table('crm_lead_qualifications')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $lead->tenant_id,
                'lead_id' => $lead->id,
                'budget' => $bant['budget'],
                'authority' => $bant['authority'],
                'need' => $bant['need'],
                'timeline' => $bant['timeline'],
                'declared_amount' => $bant['amount'] ?? null,
                'currency' => isset($bant['amount']) ? ($bant['currency'] ?? 'PEN') : null,
                'notes' => $bant['notes'] ?? null,
                'qualified_by' => $actor->getKey(),
            ]);

            $this->save($lead, $version, [
                'score' => $score,
                'status' => $markQualified ? 'calificado' : $lead->status,
                'owner_id' => $lead->owner_id ?? $actor->getKey(),
                'first_contact_at' => $lead->first_contact_at ?? now(),
            ], $actor);
        });

        $this->audit->log('Lead', $code, 'calificar', (string) $lead->score, "BANT {$score}");

        return ['score' => $score, 'qualified' => $markQualified];
    }

    public function discard(string $code, string $reason, ?string $detail, int $version, User $actor): void
    {
        $lead = $this->lead($code, $actor);
        $this->assertOpen($lead);

        if (! $this->catalog->has('discard_reason', $reason)) {
            throw ApiException::unprocessable('CRM-BR-14', 'Elige un motivo de la lista.');
        }

        $steps = ['nuevo' => 2, 'contactado' => 4, 'calificado' => 6];
        DB::transaction(function () use ($lead, $version, $reason, $detail, $steps, $actor): void {
            $this->save($lead, $version, [
                'status' => 'descartado',
                'discard_reason_code' => $reason,
                'discard_detail' => $detail,
                'discarded_at' => now(),
                'discarded_at_step' => $steps[$lead->status] ?? 0,
            ], $actor);
            DB::table('crm_activities')->where('related_type', 'lead')->where('related_id', $lead->id)->whereIn('status', ['pendiente', 'vencida'])->update([
                'status' => 'completada',
                'result' => 'Cerrada automáticamente: lead descartado',
                'auto_closed' => true,
                'completed_at' => now(),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
        });
        $this->audit->log('Lead', $code, 'descartar', $lead->status, $this->catalog->label('discard_reason', $reason));
    }

    public function convert(string $code, array $data, int $version, User $actor): array
    {
        $lead = $this->lead($code, $actor);

        if ($lead->status !== 'calificado') {
            throw ApiException::conflict('CRM-BR-12', 'Solo se convierten leads calificados.');
        }

        return DB::transaction(function () use ($lead, $data, $version, $actor): array {
            $client = isset($data['client_code'])
                ? DB::table('crm_clients')->where('code', $data['client_code'])->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El cliente no existe.')
                : $this->createClient($lead, $data, $actor);

            $stage = DB::table('crm_pipeline_stages')->where('code', 'calificacion')->first();
            $opportunityCode = $this->nextCode('crm_opportunities', 'OPP-');
            $opportunityId = (string) Str::uuid7();
            DB::table('crm_opportunities')->insert([
                'id' => $opportunityId,
                'tenant_id' => $lead->tenant_id,
                'code' => $opportunityCode,
                'client_id' => $client->id,
                'title' => trim($data['opportunity_title']),
                'stage' => 'calificacion',
                'amount' => $data['amount'],
                'currency' => $data['currency'],
                'probability' => (int) ($stage->default_probability ?? 20),
                'expected_close_date' => $data['expected_close_date'],
                'owner_id' => $lead->owner_id ?? $actor->getKey(),
                'destination_label' => $lead->destination_label,
                'pax' => $lead->pax,
                'lead_id' => $lead->id,
                'origin' => 'lead',
                'created_by' => $actor->getKey(),
            ]);

            $this->save($lead, $version, [
                'status' => 'convertido',
                'converted_client_id' => $client->id,
                'converted_opportunity_id' => $opportunityId,
                'converted_at' => now(),
                'converted_by' => $actor->getKey(),
            ], $actor);

            $this->audit->log('Oportunidad', $opportunityCode, 'crear', after: "desde {$lead->code}");
            $this->audit->log('Lead', $lead->code, 'convertir', 'calificado', "{$client->code} + {$opportunityCode}");

            return ['client' => $client->code, 'opportunity' => $opportunityCode];
        });
    }

    private function createClient(object $lead, array $data, User $actor): object
    {
        $type = $data['doc_type'];
        $kind = $type === 'RUC' ? 'empresa' : 'persona';
        $country = $data['country'] ?? 'Perú';
        $number = ClientDocument::normalize(($data['as_company'] ?? false) ? 'empresa' : $kind, $type, (string) $data['doc_number'], $country);

        $existing = DB::table('crm_clients')->where('doc_type', $type)->where('doc_number', $number)->whereNull('deleted_at')->first(['code', 'name']);

        if ($existing) {
            throw ApiException::conflict('CRM-BR-16', "Ya existe un cliente con ese documento: {$existing->name} ({$existing->code}). Vincúlalo en lugar de crear otro.");
        }

        $code = $this->nextCode('crm_clients', 'CLI-');
        $id = (string) Str::uuid7();
        DB::table('crm_clients')->insert([
            'id' => $id,
            'tenant_id' => $lead->tenant_id,
            'code' => $code,
            'kind' => $kind,
            'name' => $kind === 'empresa' && $lead->company ? $lead->company : $lead->full_name,
            'doc_type' => $type,
            'doc_number' => $number,
            'email' => $lead->email,
            'phone' => $lead->phone,
            'phone_norm' => $lead->phone_norm,
            'country' => $country,
            'city' => $data['city'] ?? null,
            'segment_code' => $kind === 'empresa' ? 'Corporativo' : 'Retail',
            'owner_id' => $lead->owner_id ?? $actor->getKey(),
            'tags' => '{"'.str_replace('"', '', $this->catalog->label('lead_source', $lead->source_code)).'"}',
            'source_lead_id' => $lead->id,
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Cliente', $code, 'crear', after: "desde {$lead->code}");

        return DB::table('crm_clients')->where('id', $id)->first();
    }

    private function lead(string $code, User $actor): object
    {
        $lead = DB::table('crm_leads')->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El lead no existe.');

        if (Portfolio::ownOnly($actor) && $lead->owner_id !== null && $lead->owner_id !== $actor->getKey()) {
            throw ApiException::forbidden('SCOPE_OWNERSHIP', 'Este lead pertenece a otro asesor.');
        }

        return $lead;
    }

    private function assertOpen(object $lead): void
    {
        if (! in_array($lead->status, self::OPEN, true)) {
            throw ApiException::conflict('LEAD_CLOSED', 'Este lead ya está cerrado y no admite cambios.');
        }
    }

    private function save(object $lead, int $version, array $values, User $actor): void
    {
        $updated = DB::table('crm_leads')->where('id', $lead->id)->where('lock_version', $version)
            ->update([...$values, 'lock_version' => $version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::conflict('STALE_VERSION', 'Alguien cambió este lead mientras lo veías. Recarga la página e inténtalo de nuevo.');
        }
    }

    private function assertCatalog(array $data): void
    {
        foreach (['source' => 'lead_source', 'channel' => 'lead_channel', 'interest' => 'lead_interest'] as $field => $kind) {
            if (! $this->catalog->has($kind, (string) ($data[$field] ?? ''))) {
                throw ApiException::unprocessable('CRM-BR-01', 'Elige la fuente, el canal y el interés de la lista.');
            }
        }
    }

    private function duplicates(?string $email, ?string $phone): array
    {
        $email = $email ? mb_strtolower(trim($email)) : null;
        $phone = $this->phoneNorm($phone);

        if ($email === null && $phone === null) {
            return [];
        }

        $match = fn ($query) => $query->where(function ($where) use ($email, $phone): void {
            if ($email) {
                $where->orWhere('email_norm', $email);
            }
            if ($phone) {
                $where->orWhere('phone_norm', $phone);
            }
        });

        $leads = $match(DB::table('crm_leads')->whereNull('deleted_at')->whereNotIn('status', ['duplicado']))->get(['id', 'code', 'full_name as name', 'status'])
            ->map(fn (object $row) => ['type' => 'lead', 'id' => $row->id, 'code' => $row->code, 'name' => $row->name, 'status' => $row->status]);
        $clients = $match(DB::table('crm_clients')->whereNull('deleted_at'))->get(['id', 'code', 'name', 'segment_code'])
            ->map(fn (object $row) => ['type' => 'client', 'id' => $row->id, 'code' => $row->code, 'name' => $row->name, 'status' => $row->segment_code]);

        return $clients->concat($leads)->values()->all();
    }

    private function initialScore(array $data): int
    {
        $score = 25
            + (! empty($data['email']) ? 8 : 0)
            + (! empty($data['phone']) ? 8 : 0)
            + (! empty($data['travel_date']) ? 10 : 0)
            + ((int) ($data['pax'] ?? 0) > 0 ? 5 : 0)
            + (! empty($data['company']) ? 4 : 0)
            + (in_array($data['source'] ?? '', ['referido', 'llamada_entrante'], true) ? 6 : 0);

        return min(70, $score);
    }

    private function phoneNorm(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        return $digits === '' ? null : substr($digits, -9);
    }

    private function nextCode(string $table, string $prefix): string
    {
        return $this->codes->next($table, $prefix);
    }
}
