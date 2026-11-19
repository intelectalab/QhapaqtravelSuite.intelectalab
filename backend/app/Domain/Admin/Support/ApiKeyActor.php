<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Iam\Models\Permission;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class ApiKeyActor
{
    public const MODES = ['fixed' => 'Asesor fijo', 'round_robin' => 'Reparto por turno'];

    private const MARKER = 'api_key_code';

    private const OAUTH_OWNER = 'oauth_owner_id';

    public static function make(array $key): User
    {
        $user = new User;
        $user->forceFill([
            'id' => $key['id'],
            'tenant_id' => $key['tenant_id'],
            'code' => $key['code'],
            'name' => "Llave {$key['name']} ({$key['code']})",
            'status' => 'activo',
            'mfa_required' => false,
            'mfa_enabled' => false,
            self::MARKER => $key['code'],
        ]);

        if (($key['oauth_owner_id'] ?? null) !== null) {
            $user->setAttribute(self::OAUTH_OWNER, (string) $key['oauth_owner_id']);
        }
        $user->setRelation('roles', new Collection);
        $user->setRelation('permissions', Permission::query()->where('guard_name', 'api')->whereIn('name', ApiKeyRoutes::permissions($key['scopes']))->get());

        return $user;
    }

    public static function is(?Authenticatable $actor): bool
    {
        return $actor instanceof User && ! $actor->exists && $actor->getAttribute(self::MARKER) !== null;
    }

    public static function auditLabel(User $actor): string
    {
        $code = (string) $actor->getAttribute(self::MARKER);
        $suffix = " ({$code})";
        $name = preg_replace('/ \('.preg_quote($code, '/').'\)$/', '', (string) $actor->name);

        return mb_substr((string) $name, 0, 60 - mb_strlen($suffix)).$suffix;
    }

    public static function person(User $actor, string $table, string $id): string
    {
        return self::is($actor) ? (string) DB::table($table)->where('id', $id)->value('owner_id') : (string) $actor->getKey();
    }

    public static function owner(User $actor, ?string $requested = null): string
    {
        if (! self::is($actor)) {
            return (string) $actor->getKey();
        }

        $advisors = app(Advisors::class);

        if ($requested !== null && $requested !== '') {
            if (! $advisors->has($requested)) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'El responsable debe ser un asesor activo de la agencia.', ['owner_id' => ['El responsable debe ser un asesor activo de la agencia.']]);
            }

            return $requested;
        }

        $oauthOwner = $actor->getAttribute(self::OAUTH_OWNER);

        if ($oauthOwner !== null) {
            $first = $advisors->has((string) $oauthOwner) ? (string) $oauthOwner : $advisors->all(['sales'])->pluck('id')->first() ?? $advisors->all()->pluck('id')->first();

            return $first !== null ? (string) $first : throw ApiException::unprocessable('API_KEY_OWNER', 'La agencia no tiene asesores activos para hacerse cargo de lo que crea esta aplicación. Envía owner_id o activa un asesor.');
        }

        return self::fallback((string) $actor->getKey(), $advisors);
    }

    private static function fallback(string $keyId, Advisors $advisors): string
    {
        $pool = $advisors->all(['sales'])->pluck('id')->map(fn (mixed $id): string => (string) $id)->values();
        $pool = $pool->isEmpty() ? $advisors->all()->pluck('id')->map(fn (mixed $id): string => (string) $id)->values() : $pool;
        $keys = DB::connection('pgsql_platform');

        return $keys->transaction(function () use ($keys, $keyId, $advisors, $pool): string {
            $key = $keys->table('integration_api_keys')->where('id', $keyId)->lockForUpdate()->first(['owner_mode', 'owner_id', 'owner_cursor'])
                ?? throw ApiException::unauthorized('API_KEY_INVALID', 'La llave de API no es válida.');

            if ($key->owner_mode === 'fixed' && $key->owner_id !== null && $advisors->has((string) $key->owner_id)) {
                return (string) $key->owner_id;
            }

            if ($pool->isEmpty()) {
                throw ApiException::unprocessable('API_KEY_OWNER', 'La agencia no tiene asesores activos para hacerse cargo de lo que crea esta llave. Envía owner_id o activa un asesor.');
            }

            $position = $pool->search((string) $key->owner_cursor);
            $next = (string) $pool->get($position === false ? 0 : ($position + 1) % $pool->count());
            $keys->table('integration_api_keys')->where('id', $keyId)->update(['owner_cursor' => $next]);

            return $next;
        });
    }
}
