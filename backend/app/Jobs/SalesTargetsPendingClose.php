<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SalesTargetsPendingClose extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'low';

    protected function run(): string
    {
        $targets = DB::table('crm_sales_targets')->where('status', 'vigente')->where('period_to', '<', $this->today()->toDateString())->orderBy('period_to')->get(['id', 'code', 'period_key', 'period_to']);

        if ($targets->isEmpty()) {
            return 'Sin metas vencidas por cerrar';
        }

        $managers = $this->managers();
        $notified = 0;

        foreach ($targets as $target) {
            foreach ($managers as $userId) {
                $notified += $this->notifyOnce('meta.por_cerrar', $userId, 'crm_sales_target', (string) $target->id, "Meta {$target->code} lista para cerrar", "El periodo {$target->period_key} terminó el ".Carbon::parse($target->period_to)->format('d/m/Y').'. Ciérrala en Metas comerciales para fijar el resultado y el bono.', false) ? 1 : 0;
            }
        }

        return self::plural($targets->count(), 'meta por cerrar', 'metas por cerrar').' · '.self::plural($notified, 'aviso nuevo', 'avisos nuevos');
    }
}
