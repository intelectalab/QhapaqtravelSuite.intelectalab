<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\IncidentWorkflow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class NoShowEffects
{
    public const EVENT = 'pasajero.no_show';

    public function __construct(
        private readonly OperationsSettings $settings,
        private readonly StaffNotices $notices,
        private readonly IncidentWorkflow $incidents,
        private readonly OpsCommon $common,
    ) {}

    public function apply(object $service, Collection $rows, User $actor): array
    {
        if ($rows->isEmpty()) {
            return ['notified' => false, 'incident' => null];
        }

        $rules = $this->settings->noShowRules();
        $reservation = DB::table('booking_reservations')->where('id', $service->reservation_id)->first(['id', 'code', 'owner_id', 'client_id', 'title']);
        $names = $rows->pluck('passenger')->implode(', ');
        $ids = $rows->pluck('id')->all();
        $result = ['notified' => false, 'incident' => null];

        if ($rules['notify_advisor'] && $reservation?->owner_id) {
            $sent = $this->notices->toUser((string) $reservation->owner_id, self::EVENT, "No se presentó: {$names}", "{$service->name} del ".CarbonImmutable::parse($service->service_date)->format('d/m/Y')." en la reserva {$reservation->code}.", 'ops_no_show', (string) $ids[0], (string) $reservation->id);

            if ($sent > 0) {
                DB::table('ops_no_shows')->whereIn('id', $ids)->update(['advisor_notified_at' => now()]);
                $result['notified'] = true;
            }
        }

        if ($rules['incident']) {
            $result['incident'] = $this->incident($service, $reservation, $names, $ids, $actor);
        }

        return $result;
    }

    private function incident(object $service, ?object $reservation, string $names, array $ids, User $actor): ?string
    {
        $order = DB::table('ops_orders')->whereNull('deleted_at')->where('reservation_id', $service->reservation_id)->where('status', '<>', 'cancelada')->first(['code', 'coordinator_id']);
        $assignee = $order?->coordinator_id ? (string) $order->coordinator_id : ($this->common->coordinators()->first()['id'] ?? null);

        if ($order === null || $assignee === null) {
            return null;
        }

        $code = $this->incidents->create([
            'order_code' => $order->code,
            'type' => 'Pasajero',
            'severity' => 'baja',
            'title' => mb_substr("No-show: {$names}", 0, 150),
            'description' => "No se presentaron a {$service->name} del ".CarbonImmutable::parse($service->service_date)->format('d/m/Y').' (reserva '.($reservation->code ?? '—').'). Incidencia abierta automáticamente según Configuración › Operaciones.',
            'assignee_id' => $assignee,
        ], $actor);
        DB::table('ops_no_shows')->whereIn('id', $ids)->update(['incident_id' => DB::table('ops_incidents')->where('code', $code)->value('id')]);

        return $code;
    }
}
