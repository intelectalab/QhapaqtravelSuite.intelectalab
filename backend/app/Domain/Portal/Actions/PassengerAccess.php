<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Iam\Actions\IssueAccessToken;
use App\Domain\Iam\Actions\RecordLogin;
use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\UserCodes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

final class PassengerAccess
{
    public const MINUTES = 30;

    private const PORTAL_ROLES = ['customer', 'passenger'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly UserCodes $codes,
        private readonly IssueAccessToken $tokens,
        private readonly RecordLogin $logins,
        private readonly AuditLogger $audit,
    ) {}

    public function link(string $email, string $code): void
    {
        $email = Str::lower(trim($email));
        $code = Str::upper(trim($code));
        $reservation = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->where('r.code', $code)->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'borrador'])
            ->first(['r.id', 'r.code', 'r.client_id', 'r.owner_id', 'c.email', 'c.name']);
        $passengerEmail = $reservation ? DB::table('booking_passengers')->where('reservation_id', $reservation->id)->whereRaw('lower(email) = ?', [$email])->exists() : false;

        if ($reservation === null || (Str::lower((string) $reservation->email) !== $email && ! $passengerEmail)) {
            $this->audit->logOutsideTransaction('Portal pasajero', $code, 'enlace_rechazado', after: $email);

            throw ApiException::unprocessable('PPX-BR-02', 'El correo o el código de reserva no coinciden.');
        }

        app(PermissionRegistrar::class)->setPermissionsTeamId($this->context->idOrFail());
        $user = $this->user($email, $reservation);
        $token = Str::random(48);
        Cache::put(self::key($token), ['user' => $user->getKey(), 'tenant' => $this->context->idOrFail()], now()->addMinutes(self::MINUTES));
        $this->audit->log('Portal pasajero', (string) $reservation->code, 'enlace_enviado', after: $email);
        $tenant = $this->context->tenant();
        $link = rtrim((string) config('app.frontend_url'), '/').'/sitio/'.$tenant->subdomain.'/mi-viaje/entrar?token='.$token;
        $body = "Hola {$user->name}:\n\nEste es tu enlace para ver el viaje {$reservation->code} con {$tenant->commercial_name}: itinerario, vouchers, avisos y contactos.\n\n{$link}\n\nVence en ".self::MINUTES.' minutos y sirve una sola vez. Si no lo pediste, ignora este correo.';
        app(QueuedMail::class)->send($email, (string) $user->name, "Tu viaje {$reservation->code} · {$tenant->commercial_name}", $body);
    }

    public function verify(string $token): array
    {
        $data = Cache::pull(self::key($token));

        if (! is_array($data) || ($data['tenant'] ?? null) !== $this->context->idOrFail()) {
            throw ApiException::unprocessable('LINK_INVALID', 'El enlace no es válido o ya se usó. Pide uno nuevo con tu correo y código de reserva.');
        }

        app(PermissionRegistrar::class)->setPermissionsTeamId($this->context->idOrFail());
        $user = User::query()->with('roles')->find($data['user']);

        if ($user === null || ! $user->isActive()) {
            throw ApiException::unprocessable('LINK_INVALID', 'El enlace no es válido o ya se usó. Pide uno nuevo con tu correo y código de reserva.');
        }

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        ($this->logins)($user, 'OK');

        return ['token' => ($this->tokens)($user, 'portal-pasajero'), 'name' => $user->name, 'home' => '/portal'];
    }

    public static function key(string $token): string
    {
        return 'pax-link:'.hash('sha256', $token);
    }

    private function user(string $email, object $reservation): User
    {
        $existing = User::query()->with('roles')->whereRaw('lower(email) = ?', [$email])->first();

        if ($existing !== null) {
            $role = $existing->primaryRole()?->name;

            if (! in_array($role, self::PORTAL_ROLES, true) || ! $existing->isActive()) {
                throw ApiException::unprocessable('PPX-BR-02', 'El correo o el código de reserva no coinciden.');
            }

            if ($role === 'customer' && $existing->client_id !== $reservation->client_id) {
                throw ApiException::unprocessable('PPX-BR-02', 'El correo o el código de reserva no coinciden.');
            }

            if ($role === 'passenger' && $existing->reservation_id !== $reservation->id) {
                $existing->forceFill(['reservation_id' => $reservation->id])->save();
            }

            return $existing;
        }

        if (DB::connection('pgsql_platform')->table('iam_users')->whereRaw('lower(email) = ?', [$email])->whereNull('deleted_at')->exists()) {
            throw ApiException::unprocessable('PPX-BR-02', 'El correo o el código de reserva no coinciden.');
        }

        $name = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->whereRaw('lower(email) = ?', [$email])->value('full_name') ?? $reservation->name;
        $sede = DB::table('iam_users')->where('id', $reservation->owner_id)->value('sede_id')
            ?? DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->value('id');
        $user = User::query()->create([
            'code' => $this->codes->next(),
            'name' => (string) $name,
            'email' => $email,
            'password' => Str::random(40),
            'reservation_id' => $reservation->id,
            'sede_id' => $sede,
            'status' => 'activo',
            'mfa_required' => false,
            'mfa_enabled' => false,
            'locale' => 'es',
        ]);
        $user->syncRoles([Role::query()->where('name', 'passenger')->firstOrFail()]);
        $this->audit->log('Portal pasajero', (string) $reservation->code, 'crear_acceso', after: "{$email} · {$user->code}");

        return $user;
    }
}
