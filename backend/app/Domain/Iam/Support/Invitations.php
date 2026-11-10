<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Mail\QueuedMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class Invitations
{
    public const HOURS = 72;

    public function create(User $user, string $tenantId, string $invitedBy, bool $requireMfa = true): string
    {
        $token = Str::random(48);
        DB::table('iam_user_invitations')->where('user_id', $user->getKey())->whereNull('accepted_at')->update(['expires_at' => now()]);
        DB::table('iam_user_invitations')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $tenantId,
            'user_id' => $user->getKey(),
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHours(self::HOURS),
            'require_mfa' => $requireMfa,
            'invited_by' => $invitedBy,
        ]);

        return $token;
    }

    public function send(string $email, string $name, string $agency, string $token, bool $isAdmin = false): void
    {
        $role = $isAdmin ? 'Se creó la cuenta de '.$agency.' en Qhapaq Travel Suite y eres su administrador.' : $agency.' te invitó a Qhapaq Travel Suite.';
        $body = "Hola {$name}:\n\n{$role}\n\nDefine tu contraseña aquí (el enlace vence en ".self::HOURS." horas):\n{$this->link($token)}\n\nNunca te enviaremos tu contraseña por correo.";

        app(QueuedMail::class)->send($email, $name, "Invitación a Qhapaq Travel Suite · {$agency}", $body);
    }

    public function sendPortal(string $email, string $name, string $agency, string $token): void
    {
        $body = "Hola {$name}:\n\n{$agency} te dio acceso a tu portal de cliente. Ahí verás tus propuestas, tus viajes, tus pagos y tus documentos.\n\nCrea tu contraseña aquí (el enlace vence en ".self::HOURS." horas):\n{$this->link($token)}\n\nNunca te enviaremos tu contraseña por correo.";

        app(QueuedMail::class)->send($email, $name, "Tu portal de cliente · {$agency}", $body);
    }

    private function link(string $token): string
    {
        return rtrim((string) config('app.frontend_url'), '/')."/invitacion/{$token}";
    }
}
