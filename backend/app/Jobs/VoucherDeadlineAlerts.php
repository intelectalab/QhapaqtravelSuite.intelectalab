<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class VoucherDeadlineAlerts extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $hours = $this->setting('operations', 'voucher_hours_before', 72);
        $limit = Carbon::now($this->today()->getTimezone())->addHours(max(1, $hours))->toDateString();
        $services = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'borrador'])->where('s.status', 'confirmado')
            ->whereBetween('s.service_date', [$this->today()->toDateString(), $limit])
            ->whereNotExists(fn ($query) => $query->from('ops_vouchers as v')->whereColumn('v.reservation_service_id', 's.id')->whereIn('v.status', ['emitido', 'utilizado']))
            ->get(['s.id', 's.code', 's.name', 's.service_date', 'r.code as reservation']);

        if ($services->isEmpty()) {
            return 'Todos los servicios próximos tienen voucher';
        }

        $users = app(Advisors::class)->all(['operations'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $sent = 0;

        foreach ($services as $service) {
            foreach ($users as $userId) {
                $sent += $this->notifyOnce('voucher.pendiente', $userId, 'booking_reservation_service', (string) $service->id, "Falta el voucher de {$service->code}", "{$service->name} del ".Carbon::parse($service->service_date)->format('d/m/Y')." ({$service->reservation}) debe tener voucher {$hours} h antes.", true) ? 1 : 0;
            }
        }

        return $this->warn(self::plural($services->count(), 'servicio sin voucher', 'servicios sin voucher').' · '.self::plural($sent, 'aviso', 'avisos'));
    }
}
