<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Facades\DB;

final class ReleaseDueAlerts extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    public const DAYS = 3;

    protected function run(): string
    {
        $today = $this->today()->toDateString();
        $limit = $this->today()->addDays(self::DAYS)->toDateString();
        $due = DB::table('catalog_allotment_days as d')->join('catalog_allotments as a', 'a.id', '=', 'd.allotment_id')
            ->whereIn('a.status', ['activo', 'en_release'])->whereNull('a.deleted_at')->whereNull('d.closed_at')->whereNull('d.retained_at')
            ->whereBetween('d.release_deadline', [$today, $limit])
            ->whereRaw('d.blocked_qty - d.released_qty - d.used_qty - d.pending_qty > 0')
            ->orderBy('d.release_deadline')
            ->get(['a.id', 'a.code', 'd.service_date', 'd.release_deadline', DB::raw('d.blocked_qty - d.released_qty - d.used_qty - d.pending_qty as free')])
            ->groupBy('id');

        if ($due->isEmpty()) {
            return 'Sin cupos con release en los próximos '.self::DAYS.' días';
        }

        $users = app(Advisors::class)->all(['operations', 'manager'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $sent = 0;

        foreach ($due as $id => $days) {
            $code = (string) $days->first()->code;
            $body = 'Fechas con release cercano: '.$days->map(fn (object $day): string => "{$day->service_date} ({$day->free} libre(s), release {$day->release_deadline})")->implode(', ').'. Retén o libera antes de la fecha límite.';

            foreach ($users as $userId) {
                $sent += $this->notifyOnce('cupo.release_proximo', $userId, 'catalog_allotment', (string) $id, "Cupo {$code} con release próximo", $body, true) ? 1 : 0;
            }
        }

        return self::plural($due->count(), 'contrato con release próximo', 'contratos con release próximo').' · '.self::plural($sent, 'aviso', 'avisos');
    }
}
