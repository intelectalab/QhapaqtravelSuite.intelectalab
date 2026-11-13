<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

use App\Domain\Corporate\Actions\CorporateApprovals;
use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class CorporateMember
{
    public const ABILITIES = [
        'manage' => ['administrador'],
        'statements.view' => ['administrador', 'pagador', 'aprobador'],
        'statements.manage' => ['administrador', 'pagador'],
        'approvals' => ['administrador', 'aprobador'],
        'travelers.view' => ['administrador', 'aprobador'],
    ];

    public function __construct(
        public readonly PortalAccount $portal,
        public readonly object $account,
        public readonly object $member,
        public readonly ?string $costCenterCode,
        public readonly ?string $travelerName,
    ) {}

    public static function of(User $user): self
    {
        app(CorporatePortalRule::class)->assert();
        $portal = PortalAccount::of($user);

        if ($portal->isPassenger()) {
            throw ApiException::forbidden('CP-02', 'El panel corporativo es para los usuarios de la empresa cliente.', ['portal_role:administrador', 'portal_role:pagador', 'portal_role:aprobador', 'portal_role:viajero']);
        }

        $account = app(CorporateDirectory::class)->forClient((string) $portal->client->id);

        if ($account === null || $account->status !== 'activa') {
            throw ApiException::forbidden('CP-02', 'Tu empresa no tiene una cuenta corporativa activa con la agencia.', ['portal_role:administrador']);
        }

        $member = DB::table('crm_corporate_portal_users')->where('account_id', $account->id)
            ->where(fn ($query) => $query->where('user_id', $user->getKey())->orWhereRaw('lower(email) = ?', [mb_strtolower((string) $user->email)]))
            ->orderByRaw('user_id is null')
            ->first();

        if ($member === null || $member->status === 'inactivo') {
            throw ApiException::forbidden('CP-02', 'Tu usuario no está habilitado en el panel corporativo. Pide acceso al administrador de tu empresa.', ['portal_role:administrador', 'portal_role:pagador', 'portal_role:aprobador', 'portal_role:viajero']);
        }

        if ($member->status === 'invitado' && in_array($member->user_id, [null, (string) $user->getKey()], true)) {
            $member = self::activate($member, $user);
        }

        $center = $member->cost_center_id ? DB::table('crm_corporate_cost_centers')->where('id', $member->cost_center_id)->value('code') : null;
        $traveler = $member->traveler_id ? DB::table('crm_corporate_travelers')->where('id', $member->traveler_id)->value('full_name') : null;

        return new self($portal, $account, $member, $center ? (string) $center : null, (string) ($traveler ?: $member->full_name));
    }

    public static function badge(User $user): ?array
    {
        try {
            $member = self::of($user);
        } catch (ApiException) {
            return null;
        }

        return [
            'role' => $member->role(),
            'role_label' => CorporateDirectory::ROLES[$member->role()],
            'pending_approvals' => $member->can('approvals') ? app(CorporateApprovals::class)->pendingFor($member) : 0,
        ];
    }

    public function role(): string
    {
        return (string) $this->member->portal_role;
    }

    public function can(string $ability): bool
    {
        return in_array($this->role(), self::ABILITIES[$ability] ?? [], true);
    }

    public function require(string $ability, string $message): void
    {
        if (! $this->can($ability)) {
            throw ApiException::forbidden('CP-02', $message, array_map(fn (string $role): string => "portal_role:{$role}", self::ABILITIES[$ability]));
        }
    }

    public function scope(): CorporateScope
    {
        return match ($this->role()) {
            'aprobador' => new CorporateScope(costCenter: $this->costCenterCode ?? '—'),
            'viajero' => new CorporateScope(traveler: CorporateLedger::normalize((string) $this->travelerName)),
            default => CorporateScope::all(),
        };
    }

    public function id(): string
    {
        return (string) $this->member->id;
    }

    private static function activate(object $member, User $user): object
    {
        if ($user->status !== 'activo') {
            return $member;
        }

        DB::table('crm_corporate_portal_users')->where('id', $member->id)->update([
            'user_id' => $user->getKey(),
            'status' => 'activo',
            'accepted_at' => $member->accepted_at ?? now(),
            'updated_at' => now(),
        ]);
        app(AuditLogger::class)->log('Usuario corporativo', (string) $member->email, 'activar', (string) $member->status, 'activo');

        return DB::table('crm_corporate_portal_users')->where('id', $member->id)->first();
    }
}
