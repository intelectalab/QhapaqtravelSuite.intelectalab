<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AllotmentConsumption
{
    private const USED = ['confirmado', 'en_curso', 'completado'];

    private const PENDING = ['pendiente', 'solicitado'];

    private const KINDS = ['hotel' => 'alojamiento', 'tren' => 'tren_entrada', 'entrada' => 'tren_entrada'];

    public function sync(object $contract): void
    {
        $days = DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)->pluck('id', 'service_date');

        $services = DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->where(fn ($query) => $query->where('s.catalog_service_id', $contract->service_id)
                ->orWhere(fn ($loose) => $loose->whereNull('s.catalog_service_id')->where('s.provider_id', $contract->provider_id)->where('s.service_kind', self::KINDS[$contract->kind] ?? 'tren_entrada')))
            ->whereBetween('s.service_date', [Carbon::parse($contract->valid_from)->subDays(30)->toDateString(), $contract->valid_to])
            ->whereIn('s.status', [...self::USED, ...self::PENDING])
            ->where('r.status', '<>', 'cancelada')
            ->whereNull('r.deleted_at')
            ->get(['s.id', 's.reservation_id', 's.service_date', 's.name', 's.pax', 's.status', 'r.status as reservation_status']);

        $seen = [];

        foreach ($services as $service) {
            $state = $service->reservation_status !== 'borrador' && in_array($service->status, self::USED, true) ? 'consumido' : 'en_tramite';

            foreach ($this->units($contract, $service) as $date => $qty) {
                $dayId = $days[$date] ?? null;

                if ($dayId === null) {
                    continue;
                }

                DB::table('catalog_allotment_consumptions')->upsert(
                    [['allotment_day_id' => $dayId, 'booking_service_id' => $service->id, 'reservation_id' => $service->reservation_id, 'qty' => $qty, 'state' => $state, 'updated_at' => now()]],
                    ['allotment_day_id', 'booking_service_id'],
                    ['qty', 'state', 'updated_at'],
                );
                $seen[] = "{$dayId}|{$service->id}";
            }
        }

        DB::table('catalog_allotment_consumptions')->whereIn('allotment_day_id', $days->values())->where('state', '<>', 'revertido')->get(['id', 'allotment_day_id', 'booking_service_id'])
            ->reject(fn (object $row) => in_array("{$row->allotment_day_id}|{$row->booking_service_id}", $seen, true))
            ->each(fn (object $row) => DB::table('catalog_allotment_consumptions')->where('id', $row->id)->update(['state' => 'revertido', 'updated_at' => now()]));

        $totals = DB::table('catalog_allotment_consumptions')->whereIn('allotment_day_id', $days->values())
            ->groupBy('allotment_day_id')
            ->selectRaw("allotment_day_id, sum(case when state = 'consumido' then qty else 0 end) as used, sum(case when state = 'en_tramite' then qty else 0 end) as pending")
            ->get()->keyBy('allotment_day_id');

        foreach ($days as $dayId) {
            $total = $totals->get($dayId);
            DB::table('catalog_allotment_days')->where('id', $dayId)
                ->where(fn ($query) => $query->where('used_qty', '<>', (int) ($total->used ?? 0))->orWhere('pending_qty', '<>', (int) ($total->pending ?? 0)))
                ->update(['used_qty' => (int) ($total->used ?? 0), 'pending_qty' => (int) ($total->pending ?? 0), 'updated_at' => now()]);
        }
    }

    private function units(object $contract, object $service): array
    {
        if ($contract->kind !== 'hotel') {
            return [(string) $service->service_date => max(1, (int) $service->pax)];
        }

        preg_match_all('/(\d+)\s*(?:hab\.?|habitaci|twin|doble|triple|simple|matrimonial)/iu', (string) $service->name, $rooms);
        preg_match('/(\d+)\s*noches?/iu', (string) $service->name, $nights);
        $count = max(1, array_sum(array_map('intval', $rooms[1])));
        $length = max(1, min(30, (int) ($nights[1] ?? 1)));
        $units = [];

        foreach (range(0, $length - 1) as $offset) {
            $units[Carbon::parse($service->service_date)->addDays($offset)->toDateString()] = $count;
        }

        return $units;
    }

    public function status(object $contract, string $today): string
    {
        if ($contract->status === 'liberado') {
            return 'liberado';
        }

        if ($contract->valid_to < $today) {
            return 'vencido';
        }

        $pending = DB::table('catalog_allotment_days')->where('allotment_id', $contract->id)
            ->whereNull('closed_at')->whereNull('retained_at')
            ->where('service_date', '>=', $today)->where('release_deadline', '<=', $today)
            ->whereRaw('blocked_qty - released_qty - used_qty - pending_qty > 0')
            ->exists();

        return $pending ? 'en_release' : 'activo';
    }
}
