<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class EnsureLockVersion
{
    private const PLATFORM_TABLES = ['tenants', 'platform_tracking_tags'];

    public function handle(Request $request, Closure $next, string $table, string $columns = 'code', ?string $parameter = null): Response
    {
        $expected = $this->expected($request);

        if ($expected === null) {
            IfMatch::from($request, required: true);
        }

        $request->merge(['lock_version' => $expected]);
        $bound = $parameter !== null ? $request->route($parameter) : (array_values($request->route()?->parameters() ?? [])[0] ?? '');
        [$value, $lookup] = $bound instanceof Model ? [(string) $bound->getKey(), ['id']] : [(string) $bound, explode('|', $columns)];
        $current = $value === '' ? null : $this->current($table, $lookup, $value);

        if ($current !== null) {
            IfMatch::assertMatches($expected, $current);
        }

        return $next($request);
    }

    private function expected(Request $request): ?int
    {
        $header = IfMatch::from($request, false);
        $body = $request->input('lock_version');

        if ($body !== null && $body !== '' && ! is_numeric($body)) {
            throw ApiException::unprocessable('IF_MATCH_INVALID', 'lock_version debe ser la versión numérica del registro.');
        }

        $body = $body === null || $body === '' ? null : (int) $body;

        if ($header !== null && $body !== null && $header !== $body) {
            throw ApiException::conflict(IfMatch::STALE, 'La versión enviada no coincide. Recargue para ver los cambios.');
        }

        return $header ?? $body;
    }

    private function current(string $table, array $columns, string $value): ?int
    {
        $connection = DB::connection(in_array($table, self::PLATFORM_TABLES, true) ? 'pgsql_platform' : null);

        foreach ($columns as $column) {
            if ($column === 'id' && ! Str::isUuid($value)) {
                continue;
            }

            $query = $connection->table($table)->where($column, $value);
            $version = $connection->transactionLevel() > 0 ? $query->lock('for no key update')->value('lock_version') : $query->value('lock_version');

            if ($version !== null) {
                return (int) $version;
            }
        }

        return null;
    }
}
