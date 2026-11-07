<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Support\Facades\DB;

final class DetectPendingSupplierServices extends TenantJob
{
    public const DAYS_AHEAD = 7;

    protected function run(): string
    {
        $today = $this->today();
        $rows = DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->whereIn('s.status', ['pendiente', 'solicitado'])
            ->whereNotIn('r.status', ['borrador', 'cancelada', 'completada'])
            ->whereNull('r.deleted_at')
            ->whereBetween('s.service_date', [$today->toDateString(), $today->addDays(self::DAYS_AHEAD)->toDateString()])
            ->selectRaw('count(*) as services, count(distinct r.id) as reservations')
            ->first();

        if ((int) $rows->services === 0) {
            return 'Todos los servicios de los próximos '.self::DAYS_AHEAD.' días están confirmados';
        }

        return $this->warn(self::plural((int) $rows->services, 'servicio sin confirmar', 'servicios sin confirmar').' del proveedor en '
            .self::plural((int) $rows->reservations, 'reserva', 'reservas').' de los próximos '.self::DAYS_AHEAD.' días');
    }
}
