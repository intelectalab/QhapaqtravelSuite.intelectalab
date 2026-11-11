<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\LoginLockout;
use App\Domain\Iam\Support\SessionPayload;
use App\Domain\Platform\Support\TenantResolver;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

final class AuthenticateUser
{
    public function __construct(
        private readonly TenantResolver $tenants,
        private readonly TenantDatabase $database,
        private readonly AuditLogger $audit,
        private readonly IssueAccessToken $issueToken,
        private readonly RecordLogin $recordLogin,
        private readonly LoginLockout $lockout,
    ) {}

    public function __invoke(Request $request): array
    {
        $email = Str::lower(trim((string) $request->input('email')));
        $tenant = $this->tenants->forLogin($request);

        if ($tenant === null) {
            $lockKey = LoginLockout::agencyKey('sin-agencia', $email);
            $this->lockout->ensureOpen($lockKey);
            $this->lockout->fail($lockKey);
            throw $this->invalidCredentials();
        }

        if ($tenant->status === 'suspendido') {
            throw ApiException::forbidden('TENANT_SUSPENDED', 'El acceso de tu empresa está suspendido. Comunícate con tu proveedor del sistema.');
        }

        $lockKey = LoginLockout::agencyKey((string) $tenant->tenant_id, $email);

        return $this->database->run($tenant->tenant_id, function () use ($request, $email, $tenant, $lockKey): array {
            $this->lockout->ensureOpen($lockKey);
            app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->tenant_id);
            $user = User::query()->with('roles')->whereRaw('lower(email) = ?', [$email])->first();

            if ($user === null || ! Hash::check((string) $request->input('password'), (string) $user->password) || ! $user->isActive()) {
                $this->audit->logOutsideTransaction('Sesión', $email, 'login_fallido');
                $this->lockout->fail($lockKey, fn () => $this->audit->logOutsideTransaction('Sesión', $email, 'cuenta_bloqueada', after: $this->lockout->minutes().' min'));
                throw $this->invalidCredentials();
            }

            $token = ($this->issueToken)($user, $request->input('device_name'));

            if (! $user->needsMfa()) {
                $this->lockout->clear($lockKey);
                ($this->recordLogin)($user, 'OK');
            }

            return SessionPayload::make($user, $token, mfaPending: $user->needsMfa());
        });
    }

    private function invalidCredentials(): ApiException
    {
        return new ApiException(401, 'UNAUTHENTICATED', null, 'El correo o la contraseña no son correctos.');
    }
}
