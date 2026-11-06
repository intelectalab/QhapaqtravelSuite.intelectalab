<?php

declare(strict_types=1);

namespace App\Domain\Shared\Http;

use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;

final class CursorPage
{
    public const DEFAULT_SIZE = 25;

    public const MAX_SIZE = 100;

    public static function filters(Request $request): array
    {
        $filter = $request->query('filter', []);

        return is_array($filter) ? array_filter(array_map(fn (mixed $value): string => is_scalar($value) ? trim((string) $value) : '', $filter), fn (string $value): bool => $value !== '') : [];
    }

    public static function respond(Request $request, Builder $query, array $sorts, string $default, Closure $map, array $meta = []): array
    {
        $size = self::size($request);
        $offset = self::offset($request);

        foreach (self::sorts($request, $sorts, $default) as [$column, $direction]) {
            $query->orderBy($column, $direction);
        }

        $rows = $query->offset($offset)->limit($size + 1)->get();
        $more = $rows->count() > $size;
        $next = $more ? self::encode($offset + $size) : null;
        $prev = $offset > 0 ? self::encode(max(0, $offset - $size)) : null;

        return [
            'data' => $rows->take($size)->map($map)->values()->all(),
            'meta' => ['per_page' => $size, 'next_cursor' => $next, 'prev_cursor' => $prev, ...$meta],
            'links' => [
                'first' => self::link($request, null),
                'prev' => $prev === null ? null : self::link($request, $prev),
                'next' => $next === null ? null : self::link($request, $next),
            ],
        ];
    }

    public static function respondItems(Request $request, array $items, array $meta = []): array
    {
        $size = self::size($request);
        $offset = self::offset($request);
        $more = count($items) > $offset + $size;
        $next = $more ? self::encode($offset + $size) : null;
        $prev = $offset > 0 ? self::encode(max(0, $offset - $size)) : null;

        return [
            'data' => array_values(array_slice($items, $offset, $size)),
            'meta' => ['per_page' => $size, 'next_cursor' => $next, 'prev_cursor' => $prev, ...$meta],
            'links' => [
                'first' => self::link($request, null),
                'prev' => $prev === null ? null : self::link($request, $prev),
                'next' => $next === null ? null : self::link($request, $next),
            ],
        ];
    }

    public static function isFirst(Request $request): bool
    {
        return self::offset($request) === 0;
    }

    private static function size(Request $request): int
    {
        $page = $request->query('page', []);
        $size = is_array($page) && isset($page['size']) ? $page['size'] : null;

        if ($size === null || $size === '') {
            return self::DEFAULT_SIZE;
        }

        if (! is_numeric($size) || (int) $size < 1 || (int) $size > self::MAX_SIZE) {
            throw ApiException::unprocessable('PAGE_SIZE_INVALID', 'page[size] debe estar entre 1 y '.self::MAX_SIZE.'.');
        }

        return (int) $size;
    }

    private static function offset(Request $request): int
    {
        $page = $request->query('page', []);
        $cursor = is_array($page) ? (string) ($page['cursor'] ?? '') : '';

        if ($cursor === '') {
            return 0;
        }

        $decoded = json_decode((string) base64_decode(strtr($cursor, '-_', '+/'), true), true);

        if (! is_array($decoded) || ! isset($decoded['o']) || ! is_int($decoded['o']) || $decoded['o'] < 0) {
            throw ApiException::unprocessable('PAGE_CURSOR_INVALID', 'El cursor de página no es válido.');
        }

        return $decoded['o'];
    }

    private static function sorts(Request $request, array $sorts, string $default): array
    {
        $raw = trim((string) $request->query('sort', '')) ?: $default;
        $result = [];

        foreach (explode(',', $raw) as $field) {
            $field = trim($field);
            $direction = str_starts_with($field, '-') ? 'desc' : 'asc';
            $name = ltrim($field, '-');

            if (! isset($sorts[$name])) {
                throw ApiException::unprocessable('SORT_INVALID', "No se puede ordenar por «{$name}».");
            }

            $result[] = [$sorts[$name], $direction];
        }

        return $result;
    }

    private static function encode(int $offset): string
    {
        return rtrim(strtr(base64_encode((string) json_encode(['o' => $offset])), '+/', '-_'), '=');
    }

    private static function link(Request $request, ?string $cursor): string
    {
        $query = $request->query();
        $page = is_array($query['page'] ?? null) ? $query['page'] : [];
        unset($page['cursor']);

        if ($cursor !== null) {
            $page['cursor'] = $cursor;
        }

        $query['page'] = $page;

        if ($page === []) {
            unset($query['page']);
        }

        return $request->url().($query === [] ? '' : '?'.http_build_query($query));
    }
}
