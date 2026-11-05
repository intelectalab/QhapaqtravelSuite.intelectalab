<?php

declare(strict_types=1);

namespace App\Domain\Shared\Concurrency;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\Request;

/**
 * Lectura del header `If-Match` (contrato: `components.parameters.IfMatch`).
 * Formatos aceptados: entero (`3`) o ETag débil (`W/"3"`), valor = `lock_version` vigente del recurso.
 *
 * Código de error: `STALE_VERSION` (spec 00 SEC-BR-17, contrato y plantilla Pest QuoteLifecycleGuardsTest).
 */
final class IfMatch
{
    public const STALE = 'STALE_VERSION';

    public static function from(Request $request, bool $required = true): ?int
    {
        $raw = trim((string) $request->header('If-Match', ''));

        if ($raw === '') {
            if ($required) {
                throw ApiException::unprocessable('IF_MATCH_REQUIRED', 'Esta operación requiere el header If-Match con la versión del registro.');
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

    /** ETag para respuestas GET de recursos con lock_version (el frontend lo reenvía como If-Match). */
    public static function etag(int $lockVersion): string
    {
        return 'W/"'.$lockVersion.'"';
    }
}
