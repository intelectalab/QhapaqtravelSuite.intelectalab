<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Actions\Support\ServicesFromQuoteItem;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class ReservationAssembler
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly ServicesFromQuoteItem $servicesFromItem,
    ) {}

    public function addServices(Reservation $reservation, object $item, ?string $departureId, string $discountPct, string $currency, string $fxRate, ?string $mainProviderId, int $seq, User $actor, bool $hold = true): int
    {
        $number = SequenceService::numberOf($reservation->code);
        $tenantId = $this->context->idOrFail();
        $rows = $this->servicesFromItem->build($item, $discountPct, $currency, $fxRate, $departureId, $mainProviderId);

        foreach ($rows as $index => $row) {
            $seq++;
            $serviceId = (string) DB::table('booking_reservation_services')->insertGetId([
                ...$row,
                'tenant_id' => $tenantId,
                'reservation_id' => $reservation->id,
                'code' => sprintf('RS-%d%02d', $number, $seq),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);

            if ($hold && $departureId !== null && $index === 0) {
                DB::table('booking_inventory_holds')->insert([
                    'tenant_id' => $tenantId,
                    'departure_id' => $departureId,
                    'reservation_id' => $reservation->id,
                    'booking_service_id' => $serviceId,
                    'pax' => (int) $item->pax,
                    'status' => 'confirmada',
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ]);
            }
        }

        if ($hold && $departureId !== null) {
            $pax = (int) $item->pax;
            DB::table('catalog_product_departures')->where('id', $departureId)->update([
                'sold' => DB::raw("sold + {$pax}"),
                'status' => DB::raw("case when sold + {$pax} >= capacity then 'completa' else status end"),
                'updated_by' => $actor->getKey(),
            ]);
        }

        return $seq;
    }

    public function placeholders(Reservation $reservation, int $adults, int $children, int $infants): void
    {
        $rows = [];
        $seq = 0;
        $tenantId = $this->context->idOrFail();

        foreach (['ADT' => $adults, 'CHD' => $children, 'INF' => $infants] as $type => $count) {
            for ($i = 1; $i <= $count; $i++) {
                $seq++;
                $rows[] = [
                    'tenant_id' => $tenantId,
                    'reservation_id' => $reservation->id,
                    'seq' => $seq,
                    'full_name' => "Pasajero {$type} {$i} (por completar)",
                    'pax_type' => $type,
                    'is_placeholder' => true,
                    'is_lead' => $seq === 1,
                ];
            }
        }

        if ($rows !== []) {
            DB::table('booking_passengers')->insert($rows);
        }
    }

    public function sedeFor(string $ownerId, User $actor): ?string
    {
        return DB::table('iam_users')->where('id', $ownerId)->value('sede_id')
            ?? $actor->sede_id
            ?? DB::table('iam_sedes')->orderBy('created_at')->value('id');
    }

    public function channelFor(string $clientId): string
    {
        return match (mb_strtolower((string) DB::table('crm_clients')->where('id', $clientId)->value('segment_code'))) {
            'corporativo', 'grupos' => 'Corporativo',
            'b2b', 'agencia aliada' => 'B2B',
            default => 'Directo',
        };
    }
}
