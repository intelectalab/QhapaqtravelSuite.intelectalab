<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

final class B2bPortalPreview
{
    public const ABILITY = 'preview:read';

    public const MINUTES = 30;

    public function __construct(private readonly AuditLogger $audit) {}

    public function start(string $code, User $actor): array
    {
        $agency = DB::table('channel_b2b_agencies')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'legal_name'])
            ?? throw ApiException::notFound('La agencia no existe.');
        $agent = User::query()->where('agency_id', $agency->id)->where('status', 'activo')->whereNull('deleted_at')->orderBy('code')->first();

        if ($agent === null) {
            throw ApiException::unprocessable('B2B-BR-17', 'La agencia aún no tiene un usuario activo en el portal. Invítalo primero para poder previsualizarlo.');
        }

        $plain = Str::random(48);
        $expires = AccessToken::expiresAfter(self::MINUTES);
        $token = $agent->tokens()->create([
            'tenant_id' => $agent->tenant_id,
            'name' => 'previsualizacion',
            'token' => hash('sha256', $plain),
            'abilities' => [self::ABILITY],
            'experience' => 'portal',
            'expires_at' => $expires,
            'device_name' => 'Previsualización de '.$actor->code,
            'ip' => Request::ip(),
        ]);
        $this->audit->log('Agencia B2B', (string) $agency->code, 'previsualizar_portal', after: "como {$agent->code} · solo lectura · {$actor->code}");

        return [
            'token' => $token->getKey().'|'.$plain,
            'expires_at' => $expires->toIso8601String(),
            'agency' => ['code' => $agency->code, 'name' => $agency->legal_name],
            'user' => ['code' => $agent->code, 'name' => $agent->name],
            'home' => '/agencia',
            'read_only' => true,
        ];
    }
}
