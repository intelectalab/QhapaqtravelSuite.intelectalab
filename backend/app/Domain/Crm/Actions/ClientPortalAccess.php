<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\PortalAccessDirectory;
use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\Invitations;
use App\Domain\Iam\Support\UserCodes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ClientPortalAccess
{
    private const PORTAL_ROLES = ['customer', 'passenger'];

    public function __construct(
        private readonly ClientWorkflow $clients,
        private readonly PortalAccessDirectory $directory,
        private readonly Invitations $invitations,
        private readonly UserCodes $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function invite(string $code, User $actor): array
    {
        $client = $this->clients->client($code, $actor);
        $email = Str::lower(trim((string) $client->email));

        if ($email === '') {
            throw ApiException::unprocessable('PORTAL_EMAIL_REQUIRED', 'Este cliente no tiene correo. Agrégalo en sus datos para invitarlo al portal.');
        }

        $linked = $this->directory->user($client->id);

        if ($linked?->status === 'activo') {
            throw ApiException::conflict('PORTAL_ACCESS_ACTIVE', 'Este cliente ya entra a su portal.');
        }

        if ($linked?->status === 'pendiente') {
            throw ApiException::conflict('PORTAL_ACCESS_PENDING', 'Este cliente ya tiene una invitación pendiente. Reenvíala si no le llegó.');
        }

        $reused = $this->assertEmailFree($email, $client, $linked?->id);
        $userId = $linked->id ?? $reused;

        [$user, $token] = DB::transaction(function () use ($client, $email, $userId, $actor): array {
            $values = [
                'name' => $client->name,
                'email' => $email,
                'phone' => $client->phone,
                'client_id' => $client->id,
                'status' => 'pendiente',
                'mfa_required' => false,
                'invited_at' => now(),
                'invited_by' => $actor->getKey(),
                'deactivated_at' => null,
                'deactivated_reason' => null,
                'updated_by' => $actor->getKey(),
            ];
            $user = $userId === null
                ? User::query()->create([...$values, 'code' => $this->codes->next(), 'sede_id' => $this->sede($client->owner_id), 'mfa_enabled' => false, 'created_by' => $actor->getKey()])
                : User::query()->findOrFail($userId);
            $user->forceFill($values)->save();
            $user->syncRoles([$this->role()]);
            DB::table('personal_access_tokens')->where('tokenable_id', $user->getKey())->delete();
            $token = $this->invitations->create($user, $this->context->idOrFail(), $actor->getKey(), false);
            $this->audit->log('Cliente', $client->code, 'invitar_portal', after: "{$email} · {$user->code}");

            return [$user, $token];
        });

        $this->invitations->sendPortal($user->email, $user->name, $this->context->tenant()->commercial_name, $token);

        return $this->directory->forClient($client->id);
    }

    public function resend(string $code, User $actor): array
    {
        $client = $this->clients->client($code, $actor);
        $linked = $this->directory->user($client->id);

        if ($linked === null || $linked->status !== 'pendiente') {
            throw ApiException::conflict('PORTAL_NOT_PENDING', 'Solo se reenvía la invitación a un cliente invitado que aún no entra a su portal.');
        }

        $user = User::query()->findOrFail($linked->id);
        $token = DB::transaction(function () use ($user, $client, $actor): string {
            $token = $this->invitations->create($user, $this->context->idOrFail(), $actor->getKey(), false);
            DB::table('iam_user_invitations')->where('user_id', $user->getKey())->whereNull('accepted_at')->where('token_hash', hash('sha256', $token))->increment('resent_count');
            $user->forceFill(['invited_at' => now(), 'updated_by' => $actor->getKey()])->save();
            $this->audit->log('Cliente', $client->code, 'reenviar_invitacion_portal', after: $user->email);

            return $token;
        });

        $this->invitations->sendPortal($user->email, $user->name, $this->context->tenant()->commercial_name, $token);

        return $this->directory->forClient($client->id);
    }

    public function revoke(string $code, ?string $reason, User $actor): array
    {
        $client = $this->clients->client($code, $actor);
        $linked = $this->directory->user($client->id);

        if ($linked === null || $linked->status === 'inactivo') {
            throw ApiException::conflict('PORTAL_NOT_GRANTED', 'Este cliente no tiene acceso al portal.');
        }

        DB::transaction(function () use ($linked, $client, $reason, $actor): void {
            $label = $reason ?: 'Acceso al portal revocado';
            DB::table('iam_users')->where('id', $linked->id)->update(['status' => 'inactivo', 'deactivated_at' => now(), 'deactivated_reason' => $label, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            DB::table('personal_access_tokens')->where('tokenable_id', $linked->id)->delete();
            DB::table('iam_user_invitations')->where('user_id', $linked->id)->whereNull('accepted_at')->update(['expires_at' => now()]);
            $this->audit->log('Cliente', $client->code, 'revocar_portal', $linked->status === 'activo' ? 'activo' : 'invitado', "revocado · {$label}");
        });

        return $this->directory->forClient($client->id);
    }

    private function assertEmailFree(string $email, object $client, ?string $linkedId): ?string
    {
        $owner = DB::table('iam_users as u')
            ->leftJoin('model_has_roles as m', 'm.model_id', '=', 'u.id')
            ->leftJoin('roles as r', 'r.id', '=', 'm.role_id')
            ->whereRaw('lower(u.email) = ?', [$email])
            ->when($linkedId, fn ($query) => $query->where('u.id', '<>', $linkedId))
            ->first(['u.id', 'u.client_id', 'u.reservation_id', 'u.deleted_at', 'r.name as role']);

        if ($owner !== null) {
            if (! in_array($owner->role, self::PORTAL_ROLES, true)) {
                throw ApiException::unprocessable('PORTAL_EMAIL_TAKEN', 'Ese correo es de una persona del equipo de la agencia. Usa otro correo para el cliente.');
            }

            $orphan = $owner->role === PortalAccessDirectory::ROLE && $owner->client_id === null && $owner->reservation_id === null && $owner->deleted_at === null;

            if (! $orphan) {
                $other = $owner->client_id ? DB::table('crm_clients')->where('id', $owner->client_id)->value('name') : null;
                throw ApiException::unprocessable('PORTAL_EMAIL_TAKEN', $owner->client_id === $client->id
                    ? 'Ese correo ya se usa para el acceso de un pasajero de este cliente.'
                    : 'Ese correo ya da acceso al portal a otro cliente'.($other ? " ({$other})" : '').'.');
            }
        }

        $elsewhere = DB::connection('pgsql_platform')->table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')
            ->where('tenant_id', '<>', $this->context->idOrFail())->exists();

        if ($elsewhere) {
            throw ApiException::unprocessable('PORTAL_EMAIL_TAKEN', 'Ese correo ya pertenece a un usuario de otra agencia.');
        }

        return $owner?->id;
    }

    private function role(): Role
    {
        return Role::query()->where('name', PortalAccessDirectory::ROLE)->first()
            ?? throw ApiException::conflict('PORTAL_ROLE_MISSING', 'La agencia no tiene configurado el rol de cliente del portal.');
    }

    private function sede(?string $ownerId): string
    {
        $sede = ($ownerId ? DB::table('iam_users')->where('id', $ownerId)->value('sede_id') : null)
            ?? DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('created_at')->value('id');

        return (string) ($sede ?? throw ApiException::conflict('SEDE_REQUIRED', 'Registra una sede antes de invitar clientes al portal.'));
    }
}
