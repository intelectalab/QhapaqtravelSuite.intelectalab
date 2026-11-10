<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PortalAccessDirectory
{
    public const ROLE = 'customer';

    private const STATES = ['pendiente' => 'invitado', 'activo' => 'activo', 'inactivo' => 'revocado'];

    public function user(string $clientId): ?object
    {
        return DB::table('iam_users as u')
            ->join('model_has_roles as m', 'm.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'm.role_id')
            ->where('r.name', self::ROLE)
            ->where('u.client_id', $clientId)
            ->whereNull('u.reservation_id')
            ->whereNull('u.deleted_at')
            ->orderByDesc('u.created_at')
            ->first(['u.id', 'u.code', 'u.email', 'u.status', 'u.last_login_at', 'u.invited_at', 'u.deactivated_at']);
    }

    public function forClient(string $clientId): array
    {
        $user = $this->user($clientId);

        if ($user === null) {
            return ['status' => 'sin_acceso', 'email' => null, 'user' => null, 'invited_at' => null, 'invitation_expires_at' => null, 'invitation_expired' => false, 'last_login_at' => null, 'revoked_at' => null];
        }

        $expires = $user->status === 'pendiente'
            ? DB::table('iam_user_invitations')->where('user_id', $user->id)->whereNull('accepted_at')->max('expires_at')
            : null;

        return [
            'status' => self::STATES[$user->status] ?? 'sin_acceso',
            'email' => $user->email,
            'user' => $user->code,
            'invited_at' => $this->iso($user->invited_at),
            'invitation_expires_at' => $this->iso($expires),
            'invitation_expired' => $expires !== null && now()->greaterThan(Carbon::parse($expires)),
            'last_login_at' => $this->iso($user->last_login_at),
            'revoked_at' => $user->status === 'inactivo' ? $this->iso($user->deactivated_at) : null,
        ];
    }

    private function iso(?string $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toIso8601String();
    }
}
