<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Platform\Support\TenantResolver;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

final class ResetPassword
{
    public const MINUTES = 60;

    private const CONNECTION = 'pgsql_platform';

    public function __construct(
        private readonly TenantResolver $tenants,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function forgot(string $email): void
    {
        $email = Str::lower(trim($email));
        $user = $this->user($email);

        if ($user === null) {
            return;
        }

        $token = Str::random(64);
        $this->db()->transaction(function () use ($email, $token, $user): void {
            $this->db()->table('password_reset_tokens')->updateOrInsert(['email' => $email], ['token' => hash('sha256', $token), 'created_at' => now()]);
            $this->log($user, 'solicitar_restablecimiento', null, 'Enlace enviado');
        });
        $this->send($user, $token);
    }

    public function reset(string $email, string $token, string $password): string
    {
        $email = Str::lower(trim($email));
        $row = $this->db()->table('password_reset_tokens')->where('email', $email)->first();

        if ($row === null || ! hash_equals((string) $row->token, hash('sha256', $token))) {
            throw ApiException::unprocessable('RESET_TOKEN_INVALID', 'El enlace para restablecer la contraseña no es válido o ya se usó. Pide uno nuevo.');
        }

        if ($row->created_at === null || Carbon::parse($row->created_at)->addMinutes(self::MINUTES)->isPast()) {
            $this->db()->table('password_reset_tokens')->where('email', $email)->delete();
            throw ApiException::unprocessable('RESET_TOKEN_EXPIRED', 'El enlace venció. Pide uno nuevo para restablecer tu contraseña.');
        }

        $user = $this->user($email) ?? throw ApiException::unprocessable('RESET_TOKEN_INVALID', 'El enlace para restablecer la contraseña no es válido o ya se usó. Pide uno nuevo.');

        $this->db()->transaction(function () use ($email, $password, $user): void {
            $this->db()->table('iam_users')->where('id', $user->id)->update(['password' => Hash::make($password), 'updated_at' => now()]);
            $this->db()->table('personal_access_tokens')->where('tokenable_type', (new User)->getMorphClass())->where('tokenable_id', $user->id)->delete();
            $this->db()->table('password_reset_tokens')->where('email', $email)->delete();
            $this->log($user, 'restablecer_contrasena', null, 'Contraseña nueva');
        });

        return $email;
    }

    private function user(string $email): ?object
    {
        $tenant = $this->tenants->byEmail($email);

        if ($tenant === null || $tenant->status === 'suspendido') {
            return null;
        }

        return $this->db()->table('iam_users as u')
            ->join('tenants as t', 't.id', '=', 'u.tenant_id')
            ->where('u.tenant_id', $tenant->tenant_id)
            ->whereRaw('lower(u.email) = ?', [$email])
            ->whereNull('u.deleted_at')
            ->where('u.status', 'activo')
            ->first(['u.id', 'u.tenant_id', 'u.code', 'u.name', 'u.email', 't.commercial_name as agency']);
    }

    private function send(object $user, string $token): void
    {
        $link = rtrim((string) config('app.frontend_url'), '/').'/restablecer/'.$token.'?email='.rawurlencode((string) $user->email);
        $body = "Hola {$user->name}:\n\nRecibimos un pedido para restablecer tu contraseña de {$user->agency} en Qhapaq Travel Suite.\n\nDefine una nueva aquí (el enlace vence en ".self::MINUTES." minutos y solo sirve una vez):\n{$link}\n\nSi no lo pediste, ignora este correo: tu contraseña actual sigue vigente.";

        try {
            Mail::raw($body, fn ($message) => $message->to((string) $user->email, (string) $user->name)->subject("Restablece tu contraseña · {$user->agency}"));
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function log(object $user, string $action, ?string $before, ?string $after): void
    {
        $previous = $this->context->id();
        $this->context->set((string) $user->tenant_id);
        $this->audit->log('Sesión', (string) ($user->code ?? $user->email), $action, $before, $after, connection: self::CONNECTION);
        $previous === null ? $this->context->clear() : $this->context->set($previous);
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
