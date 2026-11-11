<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class AcceptInvitation
{
    private const CONNECTION = 'pgsql_platform';

    private const PORTAL_HOME = '/portal';

    private const BACKOFFICE_HOME = '/dashboard';

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function show(string $token): array
    {
        $invitation = $this->invitation($token);

        return [
            'name' => $invitation->name,
            'email' => $invitation->email,
            'agency' => $invitation->agency,
            'expires_at' => $invitation->expires_at,
            'portal' => $this->portal($invitation),
            'require_mfa' => (bool) $invitation->require_mfa,
        ];
    }

    public function accept(string $token, string $password): array
    {
        $invitation = $this->invitation($token);

        DB::connection(self::CONNECTION)->transaction(function () use ($invitation, $password): void {
            $db = DB::connection(self::CONNECTION);
            $db->table('iam_users')->where('id', $invitation->user_id)->update([
                'password' => Hash::make($password),
                'status' => 'activo',
                'email_verified_at' => DB::raw('coalesce(email_verified_at, now())'),
                'updated_at' => now(),
            ]);
            $db->table('iam_user_invitations')->where('id', $invitation->id)->update(['accepted_at' => now()]);
            $this->context->set($invitation->tenant_id);
            $this->audit->log('Usuario', $invitation->email, 'aceptar_invitacion', 'pendiente', 'activo', connection: self::CONNECTION);
            $this->context->clear();
        });

        return ['email' => $invitation->email, 'home' => $this->access($invitation)['home']];
    }

    private function portal(object $invitation): bool
    {
        return $this->access($invitation)['experience'] === 'portal';
    }

    private function access(object $invitation): array
    {
        $role = DB::connection(self::CONNECTION)->table('model_has_roles as m')->join('roles as r', 'r.id', '=', 'm.role_id')
            ->where('m.model_id', $invitation->user_id)->where('m.tenant_id', $invitation->tenant_id)->first(['r.name', 'r.experience']);
        $config = config('access.roles.'.($role->name ?? 'sales'), ['experience' => 'backoffice', 'home' => self::BACKOFFICE_HOME]);
        $experience = ($role->experience ?? null) ?: $config['experience'];

        return ['experience' => $experience, 'home' => $experience === 'portal' ? self::PORTAL_HOME : ($config['home'] ?? self::BACKOFFICE_HOME)];
    }

    private function invitation(string $token): object
    {
        $invitation = DB::connection(self::CONNECTION)->table('iam_user_invitations as i')
            ->join('iam_users as u', 'u.id', '=', 'i.user_id')
            ->join('tenants as t', 't.id', '=', 'i.tenant_id')
            ->where('i.token_hash', hash('sha256', $token))
            ->first(['i.id', 'i.tenant_id', 'i.user_id', 'i.expires_at', 'i.accepted_at', 'i.require_mfa', 'u.name', 'u.email', 't.commercial_name as agency', 't.status as tenant_status']);

        if ($invitation === null) {
            throw ApiException::notFound('Este enlace de invitación no existe.');
        }

        if ($invitation->accepted_at !== null) {
            throw ApiException::conflict('INVITATION_USED', 'Esta invitación ya se usó. Inicia sesión con tu correo y contraseña.');
        }

        if (now()->greaterThanOrEqualTo($invitation->expires_at)) {
            throw ApiException::conflict('INVITATION_EXPIRED', 'Esta invitación venció. Pide a la plataforma que te envíe una nueva.');
        }

        if ($invitation->tenant_status === 'suspendido') {
            throw ApiException::conflict('TENANT_SUSPENDED', 'La agencia está suspendida.');
        }

        return $invitation;
    }
}
