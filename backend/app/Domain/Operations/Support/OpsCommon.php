<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class OpsCommon
{
    public const COORDINATOR_ROLES = ['tenant_admin', 'manager', 'operations'];

    public function __construct(private readonly TenantContext $context) {}

    public function now(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->tenant()->timezone ?: 'America/Lima');
    }

    public function today(): string
    {
        return $this->now()->toDateString();
    }

    public function coordinators(): Collection
    {
        return DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->whereIn('r.name', self::COORDINATOR_ROLES)->where('u.status', 'activo')->whereNull('u.deleted_at')
            ->orderBy('u.name')->distinct()
            ->get(['u.id', 'u.name', 'u.avatar_color'])
            ->map(fn (object $user): array => ['id' => $user->id, 'name' => $user->name, 'color' => $user->avatar_color])
            ->values();
    }

    public function ensureCoordinator(string $id): void
    {
        if (! $this->coordinators()->contains('id', $id)) {
            throw ApiException::unprocessable('OPS-BR-04', 'Elige un responsable activo de Operaciones o Gerencia.');
        }
    }

    public function userNames(): Collection
    {
        return DB::table('iam_users')->pluck('name', 'id');
    }

    public static function time(?string $value): ?string
    {
        return $value ? substr($value, 0, 5) : null;
    }
}
