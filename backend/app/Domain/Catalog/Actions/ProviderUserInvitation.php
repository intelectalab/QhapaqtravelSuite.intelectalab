<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Iam\Actions\InviteExternalUser;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProviderUserInvitation
{
    public const ROLE = 'provider';

    public function __construct(private readonly InviteExternalUser $invite) {}

    public function invite(string $reference, array $data, User $actor): array
    {
        $provider = DB::table('catalog_providers')->whereNull('deleted_at')->where(Str::isUuid($reference) ? 'id' : 'ref', $reference)->first(['id', 'ref', 'name', 'status'])
            ?? throw ApiException::notFound('El proveedor no existe.');

        if ($provider->status !== 'activo') {
            throw ApiException::conflict('SUP-BR-01', "{$provider->name} está inactivo: actívalo antes de darle acceso a la extranet.");
        }

        $user = ($this->invite)(self::ROLE, ['provider_id' => $provider->id], $data, $actor, ['Proveedor', $provider->ref], 'La agencia no tiene configurado el rol de proveedor.');

        return [
            'id' => $provider->id,
            'ref' => $provider->ref,
            'name' => $provider->name,
            'invited' => ['code' => $user->code, 'name' => $user->name, 'email' => $user->email, 'status' => 'pendiente'],
            'users' => InviteExternalUser::users('provider_id', $provider->id),
        ];
    }
}
