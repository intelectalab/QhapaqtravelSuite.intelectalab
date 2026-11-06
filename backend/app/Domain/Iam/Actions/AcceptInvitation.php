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

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function show(string $token): array
    {
        $invitation = $this->invitation($token);

        return [
            'name' => $invitation->name,
            'email' => $invitation->email,
            'agency' => $invitation->agency,
            'expires_at' => $invitation->expires_at,
        ];
    }

    public function accept(string $token, string $password): string
    {
        $invitation = $this->invitation($token);

        DB::connection(self::CONNECTION)->transaction(function () use ($invitation, $password): void {
            $db = DB::connection(self::CONNECTION);
            $db->table('iam_users')->where('id', $invitation->user_id)->update([
                'password' => Hash::make($password),
                'status' => 'activo',
                'updated_at' => now(),
            ]);
            $db->table('iam_user_invitations')->where('id', $invitation->id)->update(['accepted_at' => now()]);
            $this->context->set($invitation->tenant_id);
            $this->audit->log('Usuario', $invitation->email, 'aceptar_invitacion', 'pendiente', 'activo', connection: self::CONNECTION);
            $this->context->clear();
        });

        return $invitation->email;
    }

    private function invitation(string $token): object
    {
        $invitation = DB::connection(self::CONNECTION)->table('iam_user_invitations as i')
            ->join('iam_users as u', 'u.id', '=', 'i.user_id')
            ->join('tenants as t', 't.id', '=', 'i.tenant_id')
            ->where('i.token_hash', hash('sha256', $token))
            ->first(['i.id', 'i.tenant_id', 'i.user_id', 'i.expires_at', 'i.accepted_at', 'u.name', 'u.email', 't.commercial_name as agency', 't.status as tenant_status']);

        if ($invitation === null) {
            throw ApiException::notFound('Este enlace de invitación no existe.');
        }

        if ($invitation->accepted_at !== null) {
            throw ApiException::conflict('INVITATION_USED', 'Esta invitación ya se usó. Inicia sesión con tu correo y contraseña.');
        }

        if (now()->greaterThan($invitation->expires_at)) {
            throw ApiException::conflict('INVITATION_EXPIRED', 'Esta invitación venció. Pide a la plataforma que te envíe una nueva.');
        }

        if ($invitation->tenant_status === 'suspendido') {
            throw ApiException::conflict('TENANT_SUSPENDED', 'La agencia está suspendida.');
        }

        return $invitation;
    }
}
