<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\Invitations;
use App\Domain\Iam\Support\UserCodes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class InviteExternalUser
{
    public function __construct(
        private readonly Invitations $invitations,
        private readonly UserCodes $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function __invoke(string $role, array $link, array $data, User $actor, array $audit, string $roleMissing): User
    {
        $email = Str::lower(trim((string) $data['email']));
        $this->assertEmailFree($email);
        $model = Role::query()->where('name', $role)->first() ?? throw ApiException::conflict(Str::upper($role).'_ROLE_MISSING', $roleMissing);
        $sede = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('created_at')->value('id')
            ?? throw ApiException::conflict('SEDE_REQUIRED', 'Registra una sede antes de invitar usuarios externos.');

        [$user, $token] = DB::transaction(function () use ($link, $data, $email, $model, $sede, $actor, $audit): array {
            $user = User::query()->create([
                ...$link,
                'code' => $this->codes->next(),
                'name' => trim((string) $data['name']),
                'email' => $email,
                'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
                'sede_id' => $sede,
                'status' => 'pendiente',
                'mfa_enabled' => false,
                'mfa_required' => false,
                'invited_at' => now(),
                'invited_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $user->syncRoles([$model]);
            $token = $this->invitations->create($user, $this->context->idOrFail(), (string) $actor->getKey(), false);
            $this->audit->log($audit[0], $audit[1], 'invitar_usuario', null, "{$email} · {$user->code}", actor: $actor);

            return [$user, $token];
        });

        $this->invitations->sendPortal($user->email, $user->name, $this->context->tenant()->commercial_name, $token);

        return $user;
    }

    public static function users(string $column, string $id): array
    {
        return DB::table('iam_users')->where($column, $id)->whereNull('deleted_at')->orderBy('name')->get(['code', 'name', 'email', 'status', 'last_login_at'])
            ->map(fn (object $row): array => (array) $row)->values()->all();
    }

    private function assertEmailFree(string $email): void
    {
        if (DB::table('iam_users')->whereRaw('lower(email) = ?', [$email])->exists()) {
            throw ApiException::unprocessable('USR-BR-01', 'Ya existe un usuario con ese correo.');
        }

        if (DB::connection('pgsql_platform')->table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->where('tenant_id', '<>', $this->context->idOrFail())->exists()) {
            throw ApiException::unprocessable('USR-BR-01', 'Ese correo ya pertenece a un usuario de otra agencia.');
        }
    }
}
