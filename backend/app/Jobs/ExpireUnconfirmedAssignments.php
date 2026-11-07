<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Support\Facades\DB;

final class ExpireUnconfirmedAssignments extends TenantJob
{
    protected function run(): string
    {
        $minutes = $this->setting('operations', 'assign_expiry_min', 120);
        $today = $this->today();
        $count = DB::table('ops_assignments')
            ->where('status', 'asignada')
            ->where('updated_at', '<', now()->subMinutes($minutes))
            ->whereBetween('service_date', [$today->toDateString(), $today->addDays(2)->toDateString()])
            ->count();

        if ($count === 0) {
            return 'Sin asignaciones por confirmar';
        }

        return $this->warn(self::plural($count, 'asignación', 'asignaciones')." sin confirmar después de {$minutes} min para servicios de las próximas 48 h");
    }
}
