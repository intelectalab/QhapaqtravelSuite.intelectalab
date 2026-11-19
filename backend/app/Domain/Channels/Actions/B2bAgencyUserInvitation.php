<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Iam\Actions\InviteExternalUser;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class B2bAgencyUserInvitation
{
    public const ROLE = 'b2b';

    public function __construct(private readonly InviteExternalUser $invite) {}

    public function invite(string $reference, array $data, User $actor): array
    {
        $agency = DB::table('channel_b2b_agencies')->whereNull('deleted_at')->where(Str::isUuid($reference) ? 'id' : 'code', $reference)->first(['id', 'code', 'legal_name', 'status', 'valid_to'])
            ?? throw ApiException::notFound('La agencia aliada no existe.');

        if ($agency->status !== 'activa' || $agency->valid_to < now()->toDateString()) {
            throw ApiException::conflict('B2B-BR-18', "{$agency->legal_name} está ".($agency->status !== 'activa' ? $agency->status : 'vencida').': reactiva o renueva el convenio antes de darle acceso al portal.');
        }

        $user = ($this->invite)(self::ROLE, ['agency_id' => $agency->id], $data, $actor, ['Agencia B2B', $agency->code], 'La agencia no tiene configurado el rol de agencia aliada.');

        return [
            'code' => $agency->code,
            'invited' => ['code' => $user->code, 'name' => $user->name, 'email' => $user->email, 'status' => 'pendiente'],
            'users' => InviteExternalUser::users('agency_id', $agency->id),
        ];
    }
}
