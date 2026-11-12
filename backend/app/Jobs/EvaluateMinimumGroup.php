<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Crm\Support\Advisors;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class EvaluateMinimumGroup extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'default';

    public const DEFAULT_DECISION_DAYS = 3;

    protected function run(): string
    {
        $rules = app(RuleResolver::class)->forTenant();

        if (! $rules->on('R-MIN-GROUP')) {
            return 'Regla de grupo mínimo apagada';
        }

        $days = (int) ($rules->param('R-MIN-GROUP', 'decisionDays') ?? self::DEFAULT_DECISION_DAYS);
        $today = $this->today()->toDateString();
        $limit = $this->today()->addDays(max(0, $days))->toDateString();
        $short = DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
            ->where('d.status', 'abierta')->whereBetween('d.departure_date', [$today, $limit])
            ->whereNotNull('p.minimum_passengers')->whereColumn('d.sold', '<', 'p.minimum_passengers')
            ->get(['d.id', 'd.ref', 'd.departure_date', 'd.sold', 'p.name', 'p.minimum_passengers']);

        if ($short->isEmpty()) {
            return 'Todas las salidas próximas alcanzan el grupo mínimo';
        }

        $users = app(Advisors::class)->all(['operations', 'manager'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $sent = 0;

        foreach ($short as $departure) {
            $subject = "Salida {$departure->ref} sin grupo mínimo";
            $body = "{$departure->name} del ".Carbon::parse($departure->departure_date)->format('d/m/Y').": {$departure->sold} de {$departure->minimum_passengers} pasajeros. Propón reprogramar o confirma la salida (R-MIN-GROUP).";

            foreach ($users as $userId) {
                $sent += $this->notifyOnce('salida.grupo_minimo', $userId, 'catalog_departure', (string) $departure->id, $subject, $body, false) ? 1 : 0;
            }
        }

        return $this->warn(self::plural($short->count(), 'salida sin grupo mínimo', 'salidas sin grupo mínimo').' · '.self::plural($sent, 'aviso', 'avisos'));
    }
}
