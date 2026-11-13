<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Corporate\Support\CorporateDirectory;
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

final class CorporatePortalUsers
{
    public function __construct(
        private readonly CorporateDirectory $directory,
        private readonly Invitations $invitations,
        private readonly UserCodes $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly StaffNotices $notices,
    ) {}

    public function invite(object $account, array $data, User $actor): string
    {
        $email = Str::lower(trim((string) $data['email']));
        $role = (string) $data['portal_role'];
        [$center, $traveler] = $this->links($account, $role, $data);

        if (DB::table('crm_corporate_portal_users')->where('account_id', $account->id)->whereRaw('lower(email) = ?', [$email])->exists()) {
            throw ApiException::unprocessable('CP-06', 'Ese correo ya tiene acceso al panel corporativo de la empresa.');
        }

        $existing = $this->loginFor($email, (string) $account->client_id);

        [$id, $token, $user] = DB::transaction(function () use ($account, $data, $email, $role, $center, $traveler, $existing, $actor): array {
            $user = $existing ?? $this->createLogin($account, trim((string) $data['full_name']), $email, $actor);
            $active = $user->status === 'activo';
            $id = (string) Str::uuid7();
            DB::table('crm_corporate_portal_users')->insert([
                'id' => $id,
                'account_id' => $account->id,
                'user_id' => $user->getKey(),
                'email' => $email,
                'full_name' => trim((string) $data['full_name']),
                'portal_role' => $role,
                'cost_center_id' => $center,
                'traveler_id' => $traveler,
                'status' => $active ? 'activo' : 'invitado',
                'invited_at' => now(),
                'accepted_at' => $active ? now() : null,
            ]);
            $token = $active ? null : $this->invitations->create($user, $this->context->idOrFail(), (string) $actor->getKey(), false);
            $this->audit->log('Usuario corporativo', "{$account->client_code}/{$email}", 'invitar', null, CorporateDirectory::ROLES[$role].($center ? ' · '.DB::table('crm_corporate_cost_centers')->where('id', $center)->value('code') : ''));

            return [$id, $token, $user];
        });

        $this->notify($account, $email, trim((string) $data['full_name']), $token);

        return $id;
    }

    public function update(object $account, object $member, array $data): void
    {
        $role = (string) ($data['portal_role'] ?? $member->portal_role);
        $merged = [
            'cost_center_id' => array_key_exists('cost_center_id', $data) ? $data['cost_center_id'] : $member->cost_center_id,
            'traveler_id' => array_key_exists('traveler_id', $data) ? $data['traveler_id'] : $member->traveler_id,
        ];
        [$center, $traveler] = $this->links($account, $role, $merged);
        $status = $this->nextStatus($member, $data['status'] ?? null);

        $wasAdmin = $member->portal_role === 'administrador' && $member->status === 'activo';
        $staysAdmin = $role === 'administrador' && $status === 'activo';
        if ($wasAdmin && ! $staysAdmin && ! DB::table('crm_corporate_portal_users')->where('account_id', $account->id)->where('id', '<>', $member->id)->where('portal_role', 'administrador')->where('status', 'activo')->exists()) {
            throw ApiException::unprocessable('CP-06', 'La empresa debe conservar al menos un administrador activo. Nombra a otro administrador antes de cambiar este usuario.');
        }

        $values = [
            'portal_role' => $role,
            'cost_center_id' => $center,
            'traveler_id' => $traveler,
            'status' => $status,
            ...(array_key_exists('full_name', $data) && trim((string) $data['full_name']) !== '' ? ['full_name' => trim((string) $data['full_name'])] : []),
        ];

        DB::transaction(function () use ($account, $member, $values): void {
            DB::table('crm_corporate_portal_users')->where('id', $member->id)->update($values);
            $before = CorporateDirectory::ROLES[$member->portal_role]." · {$member->status}";
            $after = CorporateDirectory::ROLES[$values['portal_role']]." · {$values['status']}";
            $action = match (true) {
                $values['status'] === 'inactivo' && $member->status !== 'inactivo' => 'desactivar',
                $values['portal_role'] !== $member->portal_role => 'cambio_rol',
                default => 'actualizar',
            };
            $this->audit->log('Usuario corporativo', "{$account->client_code}/{$member->email}", $action, $before, $after);
        });
    }

    public function resend(object $account, object $member, User $actor): void
    {
        if ($member->status !== 'invitado') {
            throw ApiException::conflict('CORP_INVITE_NOT_PENDING', $member->status === 'activo' ? 'Este usuario ya entra al panel corporativo.' : 'El usuario está inactivo. Reactívalo antes de reenviar la invitación.');
        }

        $user = $member->user_id ? User::query()->find($member->user_id) : null;
        $user ??= $this->loginFor((string) $member->email, (string) $account->client_id) ?? $this->createLogin($account, (string) $member->full_name, (string) $member->email, $actor);

        if ($user->status === 'activo') {
            DB::table('crm_corporate_portal_users')->where('id', $member->id)->update(['user_id' => $user->getKey(), 'status' => 'activo', 'accepted_at' => now()]);
            $this->audit->log('Usuario corporativo', "{$account->client_code}/{$member->email}", 'activar', 'invitado', 'activo');

            return;
        }

        $token = DB::transaction(function () use ($account, $member, $user, $actor): string {
            DB::table('crm_corporate_portal_users')->where('id', $member->id)->update(['user_id' => $user->getKey(), 'invited_at' => now()]);
            $token = $this->invitations->create($user, $this->context->idOrFail(), (string) $actor->getKey(), false);
            $this->audit->log('Usuario corporativo', "{$account->client_code}/{$member->email}", 'reenviar_invitacion', null, (string) $member->email);

            return $token;
        });

        $this->notify($account, (string) $member->email, (string) $member->full_name, $token);
    }

    private function links(object $account, string $role, array $data): array
    {
        $center = null;
        $traveler = null;

        if (($data['cost_center_id'] ?? null) !== null && $data['cost_center_id'] !== '') {
            $row = $this->directory->costCenter($account, (string) $data['cost_center_id']);
            if (! $row->active) {
                throw ApiException::unprocessable('CORP_COST_CENTER_INACTIVE', "El centro de costo {$row->code} está inactivo.");
            }
            $center = (string) $row->id;
        }

        if ($role === 'aprobador' && $center === null) {
            throw ApiException::unprocessable('CORP_APPROVER_COST_CENTER', 'El aprobador necesita un centro de costo: solo decide las compras de ese centro.');
        }

        if (($data['traveler_id'] ?? null) !== null && $data['traveler_id'] !== '') {
            $traveler = (string) $this->directory->travelerRow($account, (string) $data['traveler_id'])->id;
        }

        return [$center, $traveler];
    }

    private function nextStatus(object $member, ?string $requested): string
    {
        if ($requested === null || $requested === $member->status) {
            return (string) $member->status;
        }

        return match ([$member->status, $requested]) {
            ['activo', 'inactivo'], ['invitado', 'inactivo'] => 'inactivo',
            ['inactivo', 'activo'] => $member->user_id !== null && $member->accepted_at !== null ? 'activo' : 'invitado',
            default => throw ApiException::conflict('CORP_USER_TRANSITION', 'Ese cambio de estado no está permitido. Un usuario invitado pasa a activo cuando acepta la invitación.'),
        };
    }

    private function loginFor(string $email, string $clientId): ?User
    {
        $row = DB::table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->first(['id', 'client_id', 'reservation_id']);

        if ($row === null) {
            if (DB::connection('pgsql_platform')->table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->where('tenant_id', '<>', $this->context->idOrFail())->exists()) {
                throw ApiException::unprocessable('PORTAL_EMAIL_TAKEN', 'Ese correo ya pertenece a un usuario de otra agencia.');
            }

            return null;
        }

        $user = User::query()->findOrFail($row->id);

        if ($row->client_id !== $clientId || $row->reservation_id !== null || $user->primaryRole()?->name !== PortalAccessDirectory::ROLE) {
            throw ApiException::unprocessable('PORTAL_EMAIL_TAKEN', 'Ese correo ya se usa en otra cuenta. Usa el correo corporativo de la persona.');
        }

        return $user;
    }

    private function createLogin(object $account, string $name, string $email, User $actor): User
    {
        $role = Role::query()->where('name', PortalAccessDirectory::ROLE)->first()
            ?? throw ApiException::conflict('PORTAL_ROLE_MISSING', 'La agencia no tiene configurado el rol de cliente del portal.');
        $sede = DB::table('iam_users')->where('id', $account->client_owner_id)->value('sede_id')
            ?? DB::table('iam_sedes')->whereNull('deleted_at')->orderByDesc('is_main')->orderBy('created_at')->value('id');

        $user = User::query()->create([
            'code' => $this->codes->next(),
            'name' => $name,
            'email' => $email,
            'client_id' => $account->client_id,
            'sede_id' => $sede,
            'status' => 'pendiente',
            'mfa_enabled' => false,
            'mfa_required' => false,
            'invited_at' => now(),
            'invited_by' => $actor->getKey(),
            'created_by' => $actor->getKey(),
        ]);
        $user->syncRoles([$role]);

        return $user;
    }

    private function notify(object $account, string $email, string $name, ?string $token): void
    {
        $agency = (string) $this->context->tenant()->commercial_name;

        if ($token !== null) {
            $this->invitations->sendPortal($email, $name, $agency, $token);
        }

        $this->notices->email($email, 'portal.invitacion_corporativa', "Acceso al panel corporativo de {$account->client_name}", "Hola {$name}: {$agency} te dio acceso al panel corporativo de {$account->client_name}. Entra a tu portal de cliente y abre «Panel corporativo».", 'Cuenta corporativa', (string) $account->id, 'client');
    }
}
