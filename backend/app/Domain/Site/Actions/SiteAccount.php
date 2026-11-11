<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\PortalAccessDirectory;
use App\Domain\Iam\Actions\IssueAccessToken;
use App\Domain\Iam\Actions\RecordLogin;
use App\Domain\Iam\Actions\ResetPassword;
use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\LoginLockout;
use App\Domain\Iam\Support\UserCodes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\WebClients;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;
use stdClass;

final class SiteAccount
{
    private const PORTAL_ROLES = ['customer', 'passenger'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly WebClients $clients,
        private readonly UserCodes $codes,
        private readonly IssueAccessToken $tokens,
        private readonly RecordLogin $logins,
        private readonly LoginLockout $lockout,
        private readonly ResetPassword $passwords,
        private readonly AuditLogger $audit,
    ) {}

    public function register(array $data, array $wishlist, ?string $cartToken): array
    {
        $email = Str::lower(trim((string) $data['email']));
        $this->assertEmailFree($email);
        app(PermissionRegistrar::class)->setPermissionsTeamId($this->context->idOrFail());
        $role = Role::query()->where('name', PortalAccessDirectory::ROLE)->first()
            ?? throw ApiException::conflict('PORTAL_ROLE_MISSING', 'La agencia no tiene configurado el rol de cliente.');
        $owner = $this->clients->owner();
        $clientId = $this->clients->resolve([...$data, 'email' => $email], $owner, (bool) ($data['newsletter'] ?? false));

        if (DB::table('iam_users')->where('client_id', $clientId)->whereNull('deleted_at')->where('status', '<>', 'inactivo')->exists()) {
            throw ValidationException::withMessages(['email' => 'Ya tienes una cuenta con nosotros. Ingresa o recupera tu contraseña.']);
        }

        $user = User::query()->create([
            'code' => $this->codes->next(),
            'name' => trim((string) $data['name']),
            'email' => $email,
            'phone' => $data['phone'] ?? null,
            'password' => (string) $data['password'],
            'client_id' => $clientId,
            'sede_id' => $this->sede($owner),
            'status' => 'activo',
            'mfa_required' => false,
            'mfa_enabled' => false,
            'locale' => 'es',
        ]);
        $user->syncRoles([$role]);
        $client = DB::table('crm_clients')->where('id', $clientId)->first(['code']);
        $this->audit->log('Cuenta web', (string) $user->code, 'registrar', after: "{$email} · cliente {$client?->code}");
        $this->attach($user, $wishlist, $cartToken);
        $this->sendVerification($user);

        return $this->session($user);
    }

    public function login(string $email, string $password, array $wishlist, ?string $cartToken): array
    {
        $email = Str::lower(trim($email));
        $key = LoginLockout::agencyKey($this->context->idOrFail(), $email);
        $this->lockout->ensureOpen($key);
        app(PermissionRegistrar::class)->setPermissionsTeamId($this->context->idOrFail());
        $user = User::query()->with('roles')->whereRaw('lower(email) = ?', [$email])->first();
        $allowed = $user !== null && $user->client_id !== null && in_array($user->primaryRole()?->name, self::PORTAL_ROLES, true);

        if (! $allowed || ! Hash::check($password, (string) $user->password) || ! $user->isActive()) {
            $this->audit->logOutsideTransaction('Cuenta web', $email, 'login_fallido');
            $this->lockout->fail($key, fn () => $this->audit->logOutsideTransaction('Cuenta web', $email, 'cuenta_bloqueada', after: $this->lockout->minutes().' min'));

            throw new ApiException(401, 'UNAUTHENTICATED', null, 'El correo o la contraseña no son correctos.');
        }

        $this->lockout->clear($key);
        ($this->logins)($user, 'OK');
        $this->attach($user, $wishlist, $cartToken);

        return $this->session($user);
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();
        $this->audit->log('Cuenta web', (string) $user->code, 'logout');
    }

    public function forgot(string $email): void
    {
        $email = Str::lower(trim($email));
        $user = User::query()->whereRaw('lower(email) = ?', [$email])->whereNotNull('client_id')->first(['id']);

        if ($user !== null) {
            $this->passwords->forgot($email);
        }
    }

    public function verify(string $email, string $token): array
    {
        $user = User::query()->whereRaw('lower(email) = ?', [Str::lower(trim($email))])->whereNotNull('client_id')->first();

        if ($user === null || ! hash_equals(self::verificationToken($user), $token)) {
            throw ApiException::unprocessable('VERIFY_TOKEN_INVALID', 'El enlace de verificación no es válido. Pide uno nuevo desde tu cuenta.');
        }

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
            $this->audit->log('Cuenta web', (string) $user->code, 'verificar_correo', after: (string) $user->email);
        }

        return ['email' => $user->email, 'verified' => true];
    }

    public function resendVerification(User $user): void
    {
        if (self::verified($user)) {
            throw ApiException::conflict('ALREADY_VERIFIED', 'Tu correo ya está verificado.');
        }

        $this->sendVerification($user);
    }

    public function lookup(string $email, string $code): array
    {
        $email = Str::lower(trim($email));
        $code = Str::upper(trim($code));
        $orderId = str_starts_with($code, 'WEB-')
            ? DB::table('channel_ecom_orders')->where('code', $code)->value('id')
            : DB::table('booking_reservations')->where('code', $code)->whereNull('deleted_at')->value('ecom_order_id');
        $order = $orderId ? DB::table('channel_ecom_orders')->where('id', $orderId)->first() : null;

        if (! $order instanceof stdClass || Str::lower((string) $order->customer_email) !== $email) {
            $this->audit->logOutsideTransaction('Pedido web', $code, 'consulta_fallida', after: $email);

            throw ApiException::notFound('No encontramos una compra con ese correo y ese código. Revisa ambos datos tal como aparecen en tu correo de confirmación.');
        }

        $this->audit->log('Pedido web', (string) $order->code, 'consultar', after: $code);

        return ['code' => $order->code, 'token' => SiteCheckout::grant($order)];
    }

    public static function verified(User $user): bool
    {
        return $user->email_verified_at !== null || $user->invited_at !== null;
    }

    public static function verificationToken(User $user): string
    {
        return hash_hmac('sha256', 'verify|'.$user->getKey().'|'.Str::lower((string) $user->email), (string) config('app.key'));
    }

    public function session(User $user): array
    {
        return [
            'token' => ($this->tokens)($user, 'sitio'),
            'name' => $user->name,
            'email' => $user->email,
            'verified' => self::verified($user),
        ];
    }

    private function attach(User $user, array $wishlist, ?string $cartToken): void
    {
        $slugs = array_slice(array_values(array_filter($wishlist, 'is_string')), 0, 50);

        if ($slugs !== []) {
            foreach (DB::table('catalog_products')->whereIn('slug', $slugs)->whereNull('deleted_at')->pluck('id') as $productId) {
                DB::table('channel_wishlist_items')->insertOrIgnore(['crm_client_id' => $user->client_id, 'product_id' => $productId]);
            }
        }

        if ($cartToken !== null) {
            DB::table('channel_web_carts')->where('token_hash', hash('sha256', $cartToken))->where('status', 'activo')->whereNull('crm_client_id')
                ->update(['crm_client_id' => $user->client_id, 'updated_at' => now()]);
        }
    }

    private function sendVerification(User $user): void
    {
        $tenant = $this->context->tenant();
        $link = rtrim((string) config('app.frontend_url'), '/').'/sitio/'.$tenant->subdomain.'/cuenta/verificar?email='.rawurlencode((string) $user->email).'&token='.self::verificationToken($user);
        $body = "Hola {$user->name}:\n\nGracias por crear tu cuenta en {$tenant->commercial_name}. Confirma tu correo aquí:\n{$link}\n\nCon tu cuenta ves tus reservas, tus vouchers y tus pagos en un solo lugar.";

        app(QueuedMail::class)->send((string) $user->email, (string) $user->name, "Confirma tu correo · {$tenant->commercial_name}", $body);
    }

    private function assertEmailFree(string $email): void
    {
        $taken = DB::table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->exists()
            || DB::connection('pgsql_platform')->table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->exists();

        if ($taken) {
            throw ValidationException::withMessages(['email' => 'Ese correo ya tiene una cuenta. Ingresa o recupera tu contraseña.']);
        }
    }

    private function sede(string $ownerId): string
    {
        $sede = DB::table('iam_users')->where('id', $ownerId)->value('sede_id')
            ?? DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('created_at')->value('id');

        return (string) ($sede ?? throw ApiException::conflict('SEDE_REQUIRED', 'La agencia aún no tiene una sede registrada.'));
    }
}
