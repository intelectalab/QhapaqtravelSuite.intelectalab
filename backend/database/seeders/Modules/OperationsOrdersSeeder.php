<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperationsOrdersSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    protected function shift(): int
    {
        return $this->shiftDays ??= OperationsTimeline::shift($this->tenant) ?? (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today(), false);
    }

    public function run(): void
    {
        (new OperationsResourcesSeeder($this->tenant))->run();
        $plates = collect(KitSeeds::read('vehicles'))->pluck('plate', 'id');

        foreach (KitSeeds::read('operations') as $seed) {
            $reservationId = $this->idByCode('booking_reservations', $seed['resId']);

            if ($reservationId === null) {
                continue;
            }

            $coordinator = $this->userId($seed['coordinator']);
            $created = $this->moment($seed['createdAt'].' 09:00');
            $orderId = $this->upsert('ops_orders', ['code' => $seed['id']], [
                'reservation_id' => $reservationId,
                'title' => $seed['title'],
                'status' => $seed['status'],
                'coordinator_id' => $coordinator,
                'date_from' => $this->day($seed['dateFrom']),
                'date_to' => $this->day($seed['dateTo']),
                'closed_at' => $seed['status'] === 'completada' ? $this->moment($seed['dateTo'].' 18:00') : null,
                'closed_by' => $seed['status'] === 'completada' ? $coordinator : null,
                'created_by' => $coordinator,
                'created_at' => $created,
                'deleted_at' => null,
            ]);

            foreach ($seed['tasks'] as $position => $task) {
                $this->upsert('ops_order_tasks', ['order_id' => $orderId, 'position' => $position], [
                    'title' => $task['t'],
                    'done' => $task['done'],
                    'done_by' => $task['done'] ? $coordinator : null,
                    'done_at' => $task['done'] ? $created : null,
                    'created_by' => $coordinator,
                    'deleted_at' => null,
                ]);
            }

            foreach ($seed['assignments'] as $assignment) {
                $serviceId = $this->idByCode('booking_reservation_services', $assignment['serviceId']);

                if ($serviceId === null) {
                    continue;
                }

                $service = DB::table('booking_reservation_services')->where('id', $serviceId)->first(['service_date', 'service_time', 'name']);
                $checkin = $assignment['checkin'] ? $this->moment($assignment['checkin']) : null;
                $vehicle = $assignment['vehicleId'] ? ($plates[$assignment['vehicleId']] ?? null) : null;
                $this->upsert('ops_assignments', ['order_id' => $orderId, 'reservation_service_id' => $serviceId], [
                    'service_date' => $service->service_date,
                    'service_time' => $service->service_time,
                    'service_label' => $assignment['service'],
                    'guide_id' => $this->idByCode('ops_guides', $assignment['guideId']),
                    'driver_id' => $this->idByCode('ops_drivers', $assignment['driverId']),
                    'vehicle_id' => $vehicle ? $this->idByCode('ops_vehicles', $vehicle, 'plate') : null,
                    'status' => $assignment['status'],
                    'confirmed_at' => in_array($assignment['status'], ['confirmada', 'en_curso', 'completada'], true) ? $created : null,
                    'confirmed_via' => in_array($assignment['status'], ['confirmada', 'en_curso', 'completada'], true) ? 'web' : null,
                    'started_at' => $checkin,
                    'first_checkin_at' => $checkin,
                    'finished_at' => $assignment['status'] === 'completada' && $checkin ? $this->moment(substr($assignment['checkin'], 0, 10).' 17:30') : null,
                    'created_by' => $coordinator,
                ]);
            }
        }
    }
}
