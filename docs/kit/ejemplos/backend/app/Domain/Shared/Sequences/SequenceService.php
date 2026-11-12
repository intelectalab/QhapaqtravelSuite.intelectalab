<?php

declare(strict_types=1);

namespace App\Domain\Shared\Sequences;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Correlativos legibles por tenant (`sys_sequences`, spec 00 §3.7, SEC-BR-20): COT-2026-00192, RES-2026-000351…
 *
 *   $code = $sequences->next('reservation');            // "RES-2026-000351"
 *   $code = $sequences->next('invoice', series: 'F001'); // "F001-00001484"
 *
 * - Asignación atómica: `SELECT … FOR UPDATE` de la fila (tenant_id, doc_type, series) + UPDATE next_number + 1
 *   en la MISMA transacción del documento. Si la transacción hace rollback, el número no se consume (sin huecos).
 * - Para comprobantes fiscales, pedir el número lo más tarde posible (al confirmar la emisión): la fila queda
 *   bloqueada hasta el COMMIT y serializa las emisiones del tenant.
 * - Trigger `app_sequence_no_decrease`: next_number nunca decrece.
 *
 * doc_type: valores de spec 00 §3.7 (`quote`, `reservation`, `ops_order`, `voucher`, `invoice`, `receipt`,
 * `credit_note`…). Los que la spec no lista se marcan como supuesto donde se usan (p. ej. `receivable` → CXC-).
 *
 * Reinicio anual (v2.5, decisión: «serie por año»): si la fila base tiene `year_reset = true`, el número se toma
 * de la serie del año en curso (`series = '2027'`), que se crea al vuelo copiando la base y cambiando el año del
 * prefijo (RES-2026- → RES-2027-) con `next_number = 1`. El trigger «next_number no decrece» y el UNIQUE
 * (tenant_id, doc_type, series) se mantienen: nunca se reinicia una fila, se abre otra. Las series explícitas
 * (p. ej. 'F001' de comprobantes SUNAT) no se reinician. Mientras el prefijo base sea del año en curso se usa la
 * serie base, así no se repiten los números ya emitidos ese año.
 */
final class SequenceService
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    public function next(string $docType, string $series = 'default'): string
    {
        $series = $this->resolveSeries($docType, $series);

        $row = DB::table('sys_sequences')
            ->where('tenant_id', $this->context->idOrFail())
            ->where('doc_type', $docType)
            ->where('series', $series)
            ->lockForUpdate()
            ->first(['id', 'prefix', 'pad_width', 'next_number']);

        if ($row === null) {
            throw new RuntimeException("No existe la serie {$docType}/{$series} en sys_sequences para el tenant (sembrar en el alta del tenant, PROC-001).");
        }

        DB::table('sys_sequences')->where('id', $row->id)->update([
            'next_number' => DB::raw('next_number + 1'),
            'updated_at' => now(),
        ]);

        return $row->prefix.str_pad((string) $row->next_number, (int) $row->pad_width, '0', STR_PAD_LEFT);
    }

    /** Serie 'default' con year_reset → serie del año en curso (la crea si falta; idempotente ante concurrencia). */
    private function resolveSeries(string $docType, string $series): string
    {
        if ($series !== 'default') {
            return $series;
        }

        $tenantId = $this->context->idOrFail();
        $base = DB::table('sys_sequences')
            ->where('tenant_id', $tenantId)->where('doc_type', $docType)->where('series', 'default')
            ->first(['label', 'prefix', 'pad_width', 'year_reset']);

        if ($base === null || ! $base->year_reset) {
            return $series;
        }

        $year = (string) now()->year;
        $prefix = preg_replace('/(?<!\d)20\d{2}(?!\d)/', $year, (string) $base->prefix, 1) ?? (string) $base->prefix;

        if ($prefix === (string) $base->prefix) {
            return $series;   // la serie base ya es del año en curso (o su prefijo no lleva año): sigue numerando
        }

        DB::table('sys_sequences')->insertOrIgnore([
            'tenant_id' => $tenantId,
            'doc_type' => $docType,
            'label' => $base->label,
            'series' => $year,
            'prefix' => $prefix,
            'pad_width' => $base->pad_width,
            'next_number' => 1,
            'year_reset' => false,
            'updated_at' => now(),
        ]);

        return $year;
    }

    /** Número entero del código (RES-2026-000351 → 351), útil para códigos derivados (RS-35101). */
    public static function numberOf(string $code): int
    {
        return preg_match('/(\d+)$/', $code, $m) === 1 ? (int) $m[1] : 0;
    }
}
