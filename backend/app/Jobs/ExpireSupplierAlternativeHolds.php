<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class ExpireSupplierAlternativeHolds extends TenantJob
{
    public const CODE = 'JOB-17';

    protected function run(): string
    {
        $today = $this->today()->toDateString();
        $rows = DB::table('supplier_request_responses as x')
            ->join('booking_reservation_services as s', 's.id', '=', 'x.reservation_service_id')
            ->where('x.type', 'alternativa')->where('x.review_status', 'pendiente')
            ->whereNotNull('x.hold_until')->where('x.hold_until', '<', $today)
            ->orderBy('x.id')->lock('for no key update')
            ->get(['x.id', 'x.alt_kind', 'x.hold_until', 's.code', 's.reservation_id']);

        if ($rows->isEmpty()) {
            return 'Sin alternativas de proveedores con bloqueo vencido';
        }

        DB::table('supplier_request_responses')->whereIn('id', $rows->pluck('id'))->update(['review_status' => 'expirada', 'reviewed_at' => now(), 'updated_at' => now()]);
        $audit = app(AuditLogger::class);
        $notices = app(OpsNotices::class);

        foreach ($rows as $row) {
            $audit->log('Servicio reserva', (string) $row->code, 'expirar_alternativa', 'pendiente', "expirada · bloqueo hasta {$row->hold_until}");
            $notices->toOperations('proveedor.alternativa_expirada', "Venció la alternativa del proveedor para {$row->code}", "{$row->alt_kind}: el proveedor mantenía el bloqueo hasta el {$row->hold_until}.", 'supplier_request_response', (string) $row->id, (string) $row->reservation_id);
        }

        return self::plural($rows->count(), 'alternativa vencida', 'alternativas vencidas');
    }
}
