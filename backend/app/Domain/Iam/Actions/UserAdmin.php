<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\Invitations;
use App\Domain\Iam\Support\StaffSeats;
use App\Domain\Iam\Support\UserCodes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class UserAdmin
{
    private const FIELDS = ['name' => 'Nombre', 'phone' => 'Teléfono', 'sede_id' => 'Sede', 'role' => 'Rol'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly Invitations $invitations,
        private readonly TenantContext $context,
        private readonly UserCodes $codes,
        private readonly QueuedMail $mail,
    ) {}

    public function invite(array $data, User $actor): string
    {
        $email = Str::lower(trim($data['email']));
        $existing = DB::table('iam_users')->whereRaw('lower(email) = ?', [$email])->first(['status', 'deleted_at']);

        if ($existing) {
            throw ApiException::unprocessable('USR-BR-01', $existing->status === 'inactivo' ? 'Ese correo es de un usuario desactivado. Reactívalo en lugar de invitarlo de nuevo.' : 'Ya existe un usuario con ese correo.');
        }

        if (DB::connection('pgsql_platform')->table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->exists()) {
            throw ApiException::unprocessable('USR-BR-01', 'Ese correo ya pertenece a un usuario de otra agencia.');
        }

        $this->assertSeats();
        $role = $this->role($data['role']);

        [$user, $token] = DB::transaction(function () use ($data, $email, $role, $actor): array {
            $user = User::query()->create([
                'code' => $this->codes->next(),
                'name' => trim($data['name']),
                'email' => $email,
                'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
                'sede_id' => $data['sede_id'],
                'status' => 'pendiente',
                'mfa_enabled' => false,
                'mfa_required' => in_array($role->name, config('access.mfa_roles'), true) || (bool) ($data['require_mfa'] ?? false),
                'invited_at' => now(),
                'invited_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $user->syncRoles([$role]);
            $token = $this->invitations->create($user, $this->context->idOrFail(), $actor->getKey(), (bool) $user->mfa_required);
            $this->audit->log('Usuario', $user->code, 'invitar', after: "{$user->email} · {$role->display_name}");

            return [$user, $token];
        });

        $this->invitations->send($user->email, $user->name, $this->context->tenant()->commercial_name, $token);

        return $user->code;
    }

    public function update(string $code, array $data, User $actor): void
    {
        $user = $this->user($code);
        $role = $this->role($data['role']);
        $currentRole = $user->primaryRole();

        if ($currentRole?->name !== $role->name && $user->is($actor)) {
            throw ApiException::forbidden('USR-BR-04', 'No puedes cambiar tu propio rol.');
        }

        if ($currentRole?->name === 'tenant_admin' && $role->name !== 'tenant_admin') {
            $this->assertAnotherAdmin($user);
        }

        $values = ['name' => trim($data['name']), 'phone' => trim((string) ($data['phone'] ?? '')) ?: null, 'sede_id' => $data['sede_id']];
        $before = ['name' => $user->name, 'phone' => $user->phone, 'sede_id' => $user->sede_id, 'role' => $currentRole?->name];
        $changed = array_filter(self::FIELDS, fn (string $label, string $field) => (string) ($field === 'role' ? $role->name : $values[$field]) !== (string) $before[$field], ARRAY_FILTER_USE_BOTH);

        if ($changed === []) {
            return;
        }

        DB::transaction(function () use ($user, $values, $role, $currentRole, $changed, $actor): void {
            $user->forceFill([...$values, 'mfa_required' => $user->mfa_required || in_array($role->name, config('access.mfa_roles'), true), 'updated_by' => $actor->getKey()])->save();
            if (isset($changed['role'])) {
                $user->syncRoles([$role]);
                DB::table('personal_access_tokens')->where('tokenable_id', $user->getKey())->delete();
                $this->audit->log('Usuario', $user->code, 'cambio_rol', $currentRole?->display_name, $role->display_name);
            }
            $this->audit->log('Usuario', $user->code, 'editar', after: implode(', ', $changed));
        });
    }

    public function deactivate(string $code, string $reason, User $actor): array
    {
        $user = $this->user($code);

        if ($user->is($actor)) {
            throw ApiException::forbidden('USR-BR-06', 'No puedes desactivar tu propia cuenta.');
        }

        if ($user->status === 'inactivo') {
            throw ApiException::conflict('USER_INACTIVE', 'Este usuario ya está desactivado.');
        }

        if ($user->primaryRole()?->name === 'tenant_admin') {
            $this->assertAnotherAdmin($user);
        }

        $opportunities = DB::table('crm_opportunities')->where('owner_id', $user->getKey())->whereNull('deleted_at')->whereNotIn('stage', ['ganada', 'perdida'])->count();
        $activities = DB::table('crm_activities')->where('owner_id', $user->getKey())->whereIn('status', ['pendiente', 'vencida'])->count();

        DB::transaction(function () use ($user, $reason, $actor): void {
            $user->forceFill(['status' => 'inactivo', 'deactivated_at' => now(), 'deactivated_reason' => $reason, 'updated_by' => $actor->getKey()])->save();
            DB::table('personal_access_tokens')->where('tokenable_id', $user->getKey())->delete();
            DB::table('iam_user_invitations')->where('user_id', $user->getKey())->whereNull('accepted_at')->update(['expires_at' => now()]);
            $this->audit->log('Usuario', $user->code, 'desactivar', 'activo', "inactivo · {$reason}");
        });

        return array_values(array_filter([
            $opportunities > 0 ? "Tenía {$opportunities} oportunidades abiertas: reasígnalas." : null,
            $activities > 0 ? "Tenía {$activities} actividades pendientes: reasígnalas." : null,
        ]));
    }

    public function activate(string $code, User $actor): void
    {
        $user = $this->user($code);

        if ($user->status !== 'inactivo') {
            throw ApiException::conflict('USER_ACTIVE', 'Este usuario no está desactivado.');
        }

        $this->assertSeats();
        $status = $user->password ? 'activo' : 'pendiente';
        $user->forceFill(['status' => $status, 'deactivated_at' => null, 'deactivated_reason' => null, 'updated_by' => $actor->getKey()])->save();
        $this->audit->log('Usuario', $user->code, 'reactivar', 'inactivo', $status);
    }

    public function resetMfa(string $code, string $reason, User $actor): void
    {
        $user = $this->user($code);

        if ($user->is($actor)) {
            throw ApiException::forbidden('USR-BR-10', 'No puedes reiniciar tu propia verificación desde aquí.');
        }

        DB::transaction(function () use ($user, $reason, $actor): void {
            DB::table('iam_mfa_factors')->where('user_id', $user->getKey())->delete();
            $user->forceFill(['mfa_enabled' => false, 'updated_by' => $actor->getKey()])->save();
            DB::table('personal_access_tokens')->where('tokenable_id', $user->getKey())->delete();
            $this->audit->log('Usuario', $user->code, 'resetear_mfa', after: $reason);
        });

        $this->mail->send($user->email, $user->name, 'Se reinició tu verificación en dos pasos', "Hola {$user->name}:\n\nEl administrador de {$this->context->tenant()->commercial_name} reinició la verificación en dos pasos de tu cuenta. La próxima vez que entres tendrás que configurarla de nuevo con tu aplicación de autenticación.\n\nSi no lo solicitaste, comunícate con el administrador de tu agencia.");
    }

    public function resendInvitation(string $code, User $actor): void
    {
        $user = $this->user($code);

        if ($user->status !== 'pendiente') {
            throw ApiException::conflict('USER_NOT_PENDING', 'Solo se reenvía la invitación a usuarios pendientes.');
        }

        $token = DB::transaction(function () use ($user, $actor): string {
            $token = $this->invitations->create($user, $this->context->idOrFail(), $actor->getKey(), (bool) $user->mfa_required);
            DB::table('iam_user_invitations')->where('user_id', $user->getKey())->whereNull('accepted_at')->where('token_hash', hash('sha256', $token))->increment('resent_count');
            $this->audit->log('Usuario', $user->code, 'reenviar_invitacion', after: $user->email);

            return $token;
        });

        $this->invitations->send($user->email, $user->name, $this->context->tenant()->commercial_name, $token);
    }

    private function assertSeats(): void
    {
        $tenant = $this->context->tenant();
        $limit = DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', $tenant->plan_id)->where('metric', 'users')->value('value');
        $used = StaffSeats::count(DB::table('iam_users'));

        if ($limit !== null && $used >= (int) $limit) {
            throw ApiException::conflict('USR-BR-02', "Tu plan permite {$limit} usuarios y ya tienes {$used}. Desactiva a alguien o mejora el plan.");
        }
    }

    private function assertAnotherAdmin(User $user): void
    {
        $others = DB::table('iam_users as u')->join('model_has_roles as m', 'm.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'm.role_id')
            ->where('r.name', 'tenant_admin')->where('u.status', 'activo')->where('u.id', '<>', $user->getKey())->whereNull('u.deleted_at')->exists();

        if (! $others) {
            throw ApiException::conflict('USR-BR-05', 'La agencia debe conservar al menos un administrador activo.');
        }
    }

    private function role(string $name): Role
    {
        return Role::query()->where('name', $name)->whereIn('scope', ['tenant', 'mobile'])->where('name', '<>', 'super_admin')->first()
            ?? throw ApiException::unprocessable('USR-BR-09', 'Elige un rol de la lista.');
    }

    private function user(string $code): User
    {
        return User::query()->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El usuario no existe.');
    }
}
