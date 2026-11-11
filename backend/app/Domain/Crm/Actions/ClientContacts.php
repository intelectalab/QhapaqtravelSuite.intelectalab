<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendNotificationEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ClientContacts
{
    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context, private readonly NotificationLog $log) {}

    public function add(object $client, array $data, User $actor): string
    {
        return DB::transaction(function () use ($client, $data, $actor): string {
            $first = DB::table('crm_client_contacts')->where('client_id', $client->id)->doesntExist();
            $primary = $first || (bool) ($data['is_primary'] ?? false);

            if ($primary) {
                DB::table('crm_client_contacts')->where('client_id', $client->id)->update(['is_primary' => false, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $id = (string) Str::uuid7();
            DB::table('crm_client_contacts')->insert([
                'id' => $id,
                'tenant_id' => $this->context->idOrFail(),
                'client_id' => $client->id,
                'name' => $data['name'],
                'role' => $data['role'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'is_primary' => $primary,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Cliente', (string) $client->code, 'agregar_contacto', after: $data['name'].($primary ? ' · principal' : ''));

            return $id;
        });
    }

    public function update(object $client, string $contactId, array $data, User $actor): void
    {
        DB::transaction(function () use ($client, $contactId, $data, $actor): void {
            $contact = $this->contact($client, $contactId);
            DB::table('crm_client_contacts')->where('id', $contact->id)->update([
                'name' => $data['name'],
                'role' => $data['role'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Cliente', (string) $client->code, 'editar_contacto', $contact->name, $data['name']);
        });
    }

    public function makePrimary(object $client, string $contactId, User $actor): void
    {
        DB::transaction(function () use ($client, $contactId, $actor): void {
            $contact = $this->contact($client, $contactId);
            DB::table('crm_client_contacts')->where('client_id', $client->id)->where('id', '<>', $contact->id)->update(['is_primary' => false, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            DB::table('crm_client_contacts')->where('id', $contact->id)->update(['is_primary' => true, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cliente', (string) $client->code, 'contacto_principal', after: $contact->name);
        });
    }

    public function remove(object $client, string $contactId, User $actor): void
    {
        DB::transaction(function () use ($client, $contactId): void {
            $contact = $this->contact($client, $contactId);
            DB::table('crm_client_contacts')->where('id', $contact->id)->delete();

            if ($contact->is_primary) {
                $next = DB::table('crm_client_contacts')->where('client_id', $client->id)->orderBy('created_at')->value('id');
                if ($next) {
                    DB::table('crm_client_contacts')->where('id', $next)->update(['is_primary' => true]);
                }
            }

            $this->audit->log('Cliente', (string) $client->code, 'quitar_contacto', $contact->name);
        });
    }

    public function communicate(object $client, array $data, User $actor): string
    {
        $recipient = $data['recipient'] ?? $client->email;

        if (! is_string($recipient) || ! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages(['recipient' => 'El cliente no tiene un correo válido. Escribe a quién se envía.']);
        }

        $message = DB::transaction(function () use ($client, $data, $actor, $recipient): object {
            $message = $this->log->record([
                'event_code' => 'crm.client.communication',
                'channel' => 'email',
                'recipient_address' => $recipient,
                'subject' => $data['subject'],
                'body_rendered' => $data['body'],
                'source_type' => 'client',
                'source_id' => $client->id,
                'client_id' => $client->id,
                'audience' => 'client',
                'status' => 'pendiente',
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Cliente', (string) $client->code, 'enviar_comunicacion', after: "Email · {$recipient} · {$data['subject']}");

            return $message;
        });

        dispatch(new SendNotificationEmail((string) $message->id))->afterCommit();

        return (string) $message->code;
    }

    private function contact(object $client, string $contactId): object
    {
        return DB::table('crm_client_contacts')->where('client_id', $client->id)->where('id', $contactId)->first(['id', 'name', 'is_primary'])
            ?? throw ApiException::notFound('El contacto no existe.');
    }
}
