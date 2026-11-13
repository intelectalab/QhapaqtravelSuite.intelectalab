<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\Invitations;
use App\Domain\Iam\Support\UserCodes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProviderUserInvitation
{
    public const ROLE = 'provider';

    public function __construct(
        private readonly Invitations $invitations,
        private readonly UserCodes $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function invite(string $reference, array $data, User $actor): array
    {
        $provider = DB::table('catalog_providers')->whereNull('deleted_at')->where(Str::isUuid($reference) ? 'id' : 'ref', $reference)->first(['id', 'ref', 'name', 'status'])
            ?? throw ApiException::notFound('El proveedor no existe.');

        if ($provider->status !== 'activo') {
            throw ApiException::conflict('SUP-BR-01', "{$provider->name} está inactivo: actívalo antes de darle acceso a la extranet.");
        }

        $email = Str::lower(trim((string) $data['email']));
        $this->assertEmailFree($email);
        $role = Role::query()->where('name', self::ROLE)->first() ?? throw ApiException::conflict('SUP_ROLE_MISSING', 'La agencia no tiene configurado el rol de proveedor.');
        $sede = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('created_at')->value('id')
            ?? throw ApiException::conflict('SEDE_REQUIRED', 'Registra una sede antes de invitar usuarios de proveedores.');

        [$user, $token] = DB::transaction(function () use ($provider, $data, $email, $role, $sede, $actor): array {
            $user = User::query()->create([
                'code' => $this->codes->next(),
                'name' => trim((string) $data['name']),
                'email' => $email,
                'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
                'sede_id' => $sede,
                'provider_id' => $provider->id,
                'status' => 'pendiente',
                'mfa_enabled' => false,
                'mfa_required' => false,
                'invited_at' => now(),
                'invited_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $user->syncRoles([$role]);
            $token = $this->invitations->create($user, $this->context->idOrFail(), (string) $actor->getKey(), false);
            $this->audit->log('Proveedor', $provider->ref, 'invitar_usuario', null, "{$email} · {$user->code}", actor: $actor);

            return [$user, $token];
        });

        $this->invitations->sendPortal($user->email, $user->name, $this->context->tenant()->commercial_name, $token);

        return [
            'id' => $provider->id,
            'ref' => $provider->ref,
            'name' => $provider->name,
            'invited' => ['code' => $user->code, 'name' => $user->name, 'email' => $user->email, 'status' => 'pendiente'],
            'users' => DB::table('iam_users')->where('provider_id', $provider->id)->whereNull('deleted_at')->orderBy('name')->get(['code', 'name', 'email', 'status', 'last_login_at'])
                ->map(fn (object $row): array => (array) $row)->values(),
        ];
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
