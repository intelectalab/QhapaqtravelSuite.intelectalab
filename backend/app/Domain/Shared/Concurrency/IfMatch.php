<?php

declare(strict_types=1);

namespace App\Domain\Shared\Concurrency;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\Request;

final class IfMatch
{
    public const STALE = 'STALE_VERSION';

    public static function from(Request $request, bool $required = true): ?int
    {
        $raw = trim((string) $request->header('If-Match', ''));

        if ($raw === '') {
            if ($required) {
                throw ApiException::preconditionRequired('IF_MATCH_REQUIRED', 'Esta operación requiere la versión del registro (If-Match). Recarga la página e intenta de nuevo.');
            }

            return null;
        }

        if (preg_match('/^(?:W\/)?"?(\d{1,9})"?$/', $raw, $m) !== 1) {
            throw ApiException::unprocessable('IF_MATCH_INVALID', 'If-Match debe ser la versión numérica del registro.');
        }

        return (int) $m[1];
    }

    public static function assertMatches(int $expected, int $current, string $entityLabel = 'El registro'): void
    {
        if ($expected !== $current) {
            throw ApiException::conflict(
                self::STALE,
                $entityLabel.' fue modificado por otro usuario. Recargue para ver los cambios.',
                ['current_lock_version' => $current],
            );
        }
    }

    public static function etag(int $lockVersion): string
    {
        return 'W/"'.$lockVersion.'"';
    }
}
