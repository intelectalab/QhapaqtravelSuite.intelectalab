<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SignupState
{
    public const LABELS = ['prueba' => 'Prueba de 14 días', 'pago_pendiente' => 'Pago pendiente', 'pagada' => 'Pagada', 'fallida' => 'Pago rechazado', 'abandonada' => 'Abandonada'];

    public const ABANDON_HOURS = 24;

    public function put(string $tenantId, array $signup): void
    {
        $this->db()->statement("update tenants set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{signup}', ?::jsonb, true), updated_at = now() where id = ?", [json_encode($signup, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $tenantId]);
    }

    public function find(string $token, bool $lock = false): array
    {
        $code = strstr($token, '.', true);
        $query = $this->db()->table('tenants')->where('code', $code === false ? '' : $code)->whereRaw("settings->'signup' is not null");
        $tenant = ($lock ? $query->lock('for no key update') : $query)->first();
        $signup = $tenant ? (array) (json_decode((string) $tenant->settings, true)['signup'] ?? []) : [];

        if ($tenant === null || ! hash_equals((string) ($signup['token_hash'] ?? ''), hash('sha256', $token))) {
            throw ApiException::notFound('El enlace del alta no es válido o ya venció.');
        }

        return [$tenant, $signup];
    }

    public static function effective(array $signup): string
    {
        $state = (string) ($signup['state'] ?? 'pago_pendiente');
        $created = isset($signup['created_at']) ? Carbon::parse($signup['created_at']) : now();

        return in_array($state, ['pago_pendiente', 'fallida'], true) && $created->lt(now()->subHours(self::ABANDON_HOURS)) ? 'abandonada' : $state;
    }

    public static function transition(array $signup, string $state, array $extra = []): array
    {
        return [...$signup, ...$extra, 'state' => $state, 'history' => [...(array) ($signup['history'] ?? []), ['state' => $state, 'at' => now()->toIso8601String()]]];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
