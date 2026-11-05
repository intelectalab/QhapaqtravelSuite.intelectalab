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
 * POR DEFINIR (conflicto del modelo): `year_reset = true` pide reiniciar la numeración cada año, pero el trigger
 * prohíbe que next_number decrezca y UNIQUE (tenant_id, doc_type, series) impide otra fila con la misma serie.
 * Opciones: (a) usar el año como `series` ('2027') creando la fila nueva en el job de cambio de año, o
 * (b) permitir el reinicio en el trigger cuando cambia el prefijo. Este servicio NO reinicia: usa el prefijo guardado.
 */
final class SequenceService
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    public function next(string $docType, string $series = 'default'): string
    {
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

    /** Número entero del código (RES-2026-000351 → 351), útil para códigos derivados (RS-35101). */
    public static function numberOf(string $code): int
    {
        return preg_match('/(\d+)$/', $code, $m) === 1 ? (int) $m[1] : 0;
    }
}
