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

final class PassengerPortalPreview
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function start(string $reservationCode, User $actor): array
    {
        $reservation = DB::table('booking_reservations')->where('code', $reservationCode)->whereNull('deleted_at')->first(['id', 'code', 'title'])
            ?? throw ApiException::notFound('La reserva no existe.');
        $passenger = User::query()->where('reservation_id', $reservation->id)->where('status', 'activo')->whereNull('deleted_at')->orderBy('code')->first();

        if ($passenger === null) {
            throw ApiException::unprocessable('PPX-BR-11', 'Esta reserva aún no tiene un acceso al portal del pasajero. Se crea cuando el pasajero entra con su enlace seguro.');
        }

        $plain = Str::random(48);
        $expires = AccessToken::expiresAfter(B2bPortalPreview::MINUTES);
        $token = $passenger->tokens()->create([
            'tenant_id' => $passenger->tenant_id,
            'name' => 'previsualizacion',
            'token' => hash('sha256', $plain),
            'abilities' => [B2bPortalPreview::ABILITY],
            'experience' => 'portal',
            'expires_at' => $expires,
            'device_name' => 'Previsualización de '.$actor->code,
            'ip' => Request::ip(),
        ]);
        $this->audit->log('Reserva', (string) $reservation->code, 'previsualizar_portal_pasajero', after: "como {$passenger->code} · solo lectura · {$actor->code}");

        return [
            'token' => $token->getKey().'|'.$plain,
            'expires_at' => $expires->toIso8601String(),
            'reservation' => ['code' => $reservation->code, 'title' => $reservation->title],
            'user' => ['code' => $passenger->code, 'name' => $passenger->name],
            'home' => '/portal',
            'read_only' => true,
        ];
    }
}
