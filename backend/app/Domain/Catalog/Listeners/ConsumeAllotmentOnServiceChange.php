<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Listeners;

use App\Domain\Booking\Events\BookingServiceCancelled;
use App\Domain\Booking\Events\BookingServiceConfirmed;
use App\Domain\Booking\Events\ReservationCancelled;
use App\Domain\Booking\Events\ReservationRescheduled;
use App\Domain\Catalog\Support\AllotmentConsumption;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ConsumeAllotmentOnServiceChange
{
    public const EVENTS = [BookingServiceConfirmed::class, BookingServiceCancelled::class, ReservationCancelled::class, ReservationRescheduled::class];

    public function __construct(private readonly AllotmentConsumption $consumption, private readonly AuditLogger $audit) {}

    public function handle(BookingServiceConfirmed|BookingServiceCancelled|ReservationCancelled|ReservationRescheduled $event): void
    {
        $this->syncReservation($event->reservationId, $event instanceof BookingServiceConfirmed ? $event->serviceId : null);
    }

    public function syncReservation(string $reservationId, ?string $confirmedServiceId = null): void
    {
        $contracts = $this->contracts($reservationId)->sortBy('id')->values();

        if ($contracts->isEmpty()) {
            return;
        }

        DB::table('catalog_allotments')->whereIn('id', $contracts->pluck('id')->all())->orderBy('id')->lock('for no key update')->pluck('id');

        $contracts->each(fn (object $contract) => $this->consumption->sync($contract));

        if ($confirmedServiceId !== null && $this->oversold($confirmedServiceId, $contracts)) {
            $contracts->each(fn (object $contract) => $this->consumption->sync($contract));
        }
    }

    private function contracts(string $reservationId): Collection
    {
        $columns = ['id', 'code', 'service_id', 'provider_id', 'kind', 'valid_from', 'valid_to', 'status'];
        $services = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->get(['catalog_service_id', 'provider_id', 'service_date']);
        $previous = DB::table('catalog_allotments as a')->whereNull('a.deleted_at')
            ->whereExists(fn ($query) => $query->from('catalog_allotment_consumptions as c')->join('catalog_allotment_days as d', 'd.id', '=', 'c.allotment_day_id')
                ->whereColumn('d.allotment_id', 'a.id')->where('c.reservation_id', $reservationId))
            ->get(array_map(fn (string $column): string => "a.{$column}", $columns));
        $catalogIds = $services->pluck('catalog_service_id')->filter()->unique()->values()->all();
        $providerIds = $services->pluck('provider_id')->filter()->unique()->values()->all();

        if ($catalogIds === [] && $providerIds === []) {
            return $previous;
        }

        return DB::table('catalog_allotments')->whereNull('deleted_at')
            ->where(fn ($query) => $query->whereIn('service_id', $catalogIds)->orWhereIn('provider_id', $providerIds))
            ->where('valid_to', '>=', (string) $services->min('service_date'))
            ->where('valid_from', '<=', (string) $services->max('service_date'))
            ->get($columns)->concat($previous)->unique('id')->values();
    }

    private function oversold(string $serviceId, Collection $contracts): bool
    {
        $days = DB::table('catalog_allotment_consumptions as c')->join('catalog_allotment_days as d', 'd.id', '=', 'c.allotment_day_id')
            ->where('c.booking_service_id', $serviceId)->where('c.state', 'consumido')
            ->whereRaw('d.blocked_qty - d.released_qty > 0')
            ->whereRaw('d.used_qty > d.blocked_qty - d.released_qty')
            ->get(['d.allotment_id', 'd.service_date', DB::raw('d.blocked_qty - d.released_qty - d.used_qty as available')]);

        if ($days->isEmpty()) {
            return false;
        }

        $service = DB::table('booking_reservation_services')->where('id', $serviceId)->first(['code', 'name', 'status']);
        DB::table('booking_reservation_services')->where('id', $serviceId)->update(['status' => 'solicitado', 'confirmation_code' => null, 'confirmed_at' => null, 'updated_at' => now()]);

        foreach ($days as $day) {
            $contract = $contracts->firstWhere('id', $day->allotment_id);
            DB::table('catalog_allotment_events')->insert([
                'allotment_id' => $day->allotment_id,
                'message' => mb_substr("Sobreventa: {$service->code} excede el cupo del {$day->service_date} ({$day->available}); el servicio queda on request (CUP-BR-006)", 0, 300),
            ]);
            $this->audit->log('Cupo', (string) ($contract->code ?? $day->allotment_id), 'sobreventa', null, "{$service->code} · {$day->service_date} · disponible {$day->available}");
        }

        $this->audit->log('Servicio reserva', (string) $service->code, 'sobreventa', (string) $service->status, 'solicitado (on request por sobreventa del cupo)');

        return true;
    }
}
