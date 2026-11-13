<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\ClientDocument;
use App\Domain\Crm\Support\ClientDuplicates;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\CrmNotices;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ClientWorkflow
{
    private const LIVE_RESERVATIONS = ['borrador', 'cancelada', 'completada'];

    private const CLOSED_OPPORTUNITIES = ['ganada', 'perdida'];

    private const FIELDS = ['kind' => 'Tipo', 'name' => 'Nombre', 'doc_type' => 'Tipo de documento', 'doc_number' => 'Documento', 'email' => 'Correo', 'phone' => 'Teléfono', 'country' => 'País', 'city' => 'Ciudad', 'birth_date' => 'Nacimiento', 'segment_code' => 'Segmento', 'owner_id' => 'Responsable', 'tags' => 'Etiquetas'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CrmCatalog $catalog,
        private readonly CodeSequence $codes,
        private readonly Advisors $advisors,
        private readonly TenantContext $context,
        private readonly ClientContacts $contacts,
        private readonly ClientDuplicates $duplicates,
    ) {}

    public function reassign(string $code, string $ownerId, ?string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $ownerId, $note, $actor): void {
            $client = DB::table('crm_clients')->where('code', $code)->whereNull('deleted_at')->lock('for no key update')->first(['id', 'code', 'owner_id'])
                ?? throw ApiException::notFound('El cliente no existe.');

            if ((string) $client->owner_id === $ownerId) {
                throw ApiException::unprocessable('CRM-BR-31', 'Elige un responsable distinto del actual.');
            }

            if (! $this->advisors->has($ownerId)) {
                throw ApiException::unprocessable('CRM-BR-31', 'Elige un responsable activo de la lista.');
            }

            DB::table('crm_clients')->where('id', $client->id)->update(['owner_id' => $ownerId, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cliente', $code, 'reasignar', $this->ownerName($client->owner_id), trim($this->ownerName($ownerId).($note ? " · {$note}" : '')));
        });

        app(CrmNotices::class)->clientReassigned($code, $ownerId, (string) $actor->getKey());
    }

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $values = $this->values($data, $actor, null);
            $code = $this->codes->next('crm_clients', 'CLI-');
            DB::table('crm_clients')->insert([
                ...$values,
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'owner_id' => $values['owner_id'] ?? $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Cliente', $code, 'crear', after: $values['name']);
            $this->primaryContact(DB::table('crm_clients')->where('code', $code)->first(['id', 'code']), $values['kind'], $data, $actor);

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        DB::transaction(function () use ($code, $data, $actor): void {
            $client = $this->client($code, $actor);
            $values = $this->values($data, $actor, $client);
            $before = [...(array) $client, 'tags' => $this->tags((string) $client->tags)];
            $changed = array_filter(self::FIELDS, fn (string $label, string $field) => array_key_exists($field, $values) && (string) $values[$field] !== (string) ($before[$field] ?? ''), ARRAY_FILTER_USE_BOTH);
            $this->primaryContact($client, $values['kind'], $data, $actor);

            if ($changed === []) {
                return;
            }

            DB::table('crm_clients')->where('id', $client->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cliente', $code, 'editar', after: implode(', ', $changed));

            if (isset($changed['owner_id'])) {
                $this->audit->log('Cliente', $code, 'reasignar', $this->ownerName($client->owner_id), $this->ownerName($values['owner_id']));
                app(CrmNotices::class)->clientReassigned($code, (string) $values['owner_id'], (string) $actor->getKey());
            }
        });
    }

    public function archive(string $code, ?string $reason, User $actor): void
    {
        $client = $this->client($code, $actor);
        $blockers = array_filter([
            DB::table('booking_reservations')->where('client_id', $client->id)->whereNull('deleted_at')->whereNotIn('status', self::LIVE_RESERVATIONS)->exists() ? 'reservas en curso' : null,
            DB::table('crm_opportunities')->where('client_id', $client->id)->whereNull('deleted_at')->whereNotIn('stage', self::CLOSED_OPPORTUNITIES)->exists() ? 'oportunidades abiertas' : null,
            DB::table('fin_receivables')->where('client_id', $client->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])->exists() ? 'cobros pendientes' : null,
        ]);

        if ($blockers !== []) {
            throw ApiException::conflict('CLIENT_IN_USE', 'No se puede archivar: tiene '.implode(', ', $blockers).'. Ciérralos antes de archivarlo.');
        }

        DB::table('crm_clients')->where('id', $client->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Cliente', $code, 'archivar', $client->name, $reason);
    }

    private function primaryContact(?object $client, string $kind, array $data, User $actor): void
    {
        $name = trim((string) ($data['contact_name'] ?? ''));

        if ($client === null || $kind !== 'empresa' || $name === '') {
            return;
        }

        $fields = [
            'name' => $name,
            'role' => trim((string) ($data['contact_role'] ?? '')) ?: null,
            'email' => trim((string) ($data['contact_email'] ?? '')) ?: null,
            'phone' => trim((string) ($data['contact_phone'] ?? '')) ?: null,
        ];
        $primary = DB::table('crm_client_contacts')->where('client_id', $client->id)->where('is_primary', true)->first(['id', 'name', 'role', 'email', 'phone']);

        if ($primary === null) {
            $this->contacts->add($client, [...$fields, 'is_primary' => true], $actor);

            return;
        }

        if (array_filter($fields, fn (?string $value, string $field) => (string) $value !== (string) $primary->{$field}, ARRAY_FILTER_USE_BOTH) !== []) {
            $this->contacts->update($client, (string) $primary->id, $fields, $actor);
        }
    }

    private function values(array $data, User $actor, ?object $current): array
    {
        $kind = $data['kind'];
        $country = trim($data['country'] ?? '') ?: 'Perú';
        $number = ClientDocument::normalize($kind, $data['doc_type'], (string) $data['doc_number'], $country);
        $segment = $this->segment($data['segment'] ?? null);

        $twin = $this->duplicates->hard($data['doc_type'], $number, $current?->id);

        if ($twin) {
            throw ApiException::conflict('CRM-BR-16', "Ya existe un cliente con ese documento: {$twin->name} ({$twin->code}).", ['matches' => [['code' => $twin->code, 'name' => $twin->name]]]);
        }

        $email = trim((string) ($data['email'] ?? '')) ?: null;
        $phone = trim((string) ($data['phone'] ?? '')) ?: null;
        $phoneNorm = ClientDocument::phoneNorm($phone);

        if (! ($data['confirm_duplicate'] ?? false) && ($email || $phoneNorm)) {
            $matches = array_map(fn (array $row): array => ['code' => $row['code'], 'name' => $row['name']], $this->duplicates->soft($email, $phone, $current?->id));

            if ($matches !== []) {
                throw ApiException::conflict('CRM-BR-17', 'Otro cliente tiene el mismo correo o teléfono. Revisa que no sea la misma persona.', ['matches' => $matches]);
            }
        }

        $values = [
            'kind' => $kind,
            'name' => trim($data['name']),
            'doc_type' => $data['doc_type'],
            'doc_number' => $number,
            'email' => $email,
            'phone' => $phone,
            'phone_norm' => $phoneNorm,
            'country' => $country,
            'city' => trim((string) ($data['city'] ?? '')) ?: null,
            'birth_date' => $kind === 'persona' ? ($data['birth_date'] ?? null) : null,
            'segment_code' => $segment,
            'tags' => $this->tags($data['tags'] ?? ''),
        ];

        if (! empty($data['owner_id']) && ! Portfolio::ownOnly($actor)) {
            if (! $this->advisors->has($data['owner_id'])) {
                throw ApiException::unprocessable('CRM-BR-31', 'Elige un responsable activo de la lista.');
            }
            $values['owner_id'] = $data['owner_id'];
        }

        return $values;
    }

    private function segment(?string $value): string
    {
        $labels = $this->catalog->options()->get('client_segment', collect())->pluck('label');

        if ($value === null || $value === '') {
            return $labels->first() ?? 'Retail';
        }

        if (! $labels->contains($value)) {
            throw ApiException::unprocessable('CRM-BR-01', 'Elige el segmento de la lista.');
        }

        return $value;
    }

    private function tags(string $raw): string
    {
        $tags = collect(explode(',', $raw))->map(fn (string $tag) => trim(str_replace(['"', '{', '}'], '', $tag)))->filter()->unique()->take(12);

        return '{'.$tags->map(fn (string $tag) => '"'.$tag.'"')->implode(',').'}';
    }

    public function client(string $code, User $actor): object
    {
        $client = DB::table('crm_clients')->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El cliente no existe.');

        if (Portfolio::ownOnly($actor) && $client->owner_id !== $actor->getKey()) {
            throw ApiException::forbidden('SCOPE_OWNERSHIP', 'Este cliente pertenece a otro asesor.');
        }

        return $client;
    }

    private function ownerName(?string $id): ?string
    {
        return $id ? DB::table('iam_users')->where('id', $id)->value('name') : null;
    }
}
