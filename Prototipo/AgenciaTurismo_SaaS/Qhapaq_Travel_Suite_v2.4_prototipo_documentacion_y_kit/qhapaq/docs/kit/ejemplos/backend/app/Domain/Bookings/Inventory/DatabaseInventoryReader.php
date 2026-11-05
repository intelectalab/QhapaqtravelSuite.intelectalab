<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Inventory;

use App\Domain\Bookings\Contracts\InventoryReader;
use Illuminate\Support\Facades\DB;

/**
 * Ocupación desde PostgreSQL (spec 16 §8.1 AvailabilityCalculator). Corre con app.tenant_id fijado (RLS).
 *
 * vendidos  = Σ pax de booking_reservation_services del producto en la fecha, no cancelados, de reservas que no
 *             están en borrador ni canceladas (criterio de `BE.soldOn` del prototipo). Un ítem de cotización genera
 *             una línea por componente: se cuenta el pax UNA vez por (reserva, quote_item_id).
 * retenidos = Σ quantity de catalog_availability_holds con status `hold` y expires_at futuro.
 *
 * Para salidas programadas el motor usa `catalog_product_departures.sold` (no esta consulta).
 */
final class DatabaseInventoryReader implements InventoryReader
{
    public function soldOn(string $productId, string $date): int
    {
        $perItem = DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->where('s.product_id', $productId)
            ->where('s.service_date', $date)
            ->where('s.status', '<>', 'cancelado')
            ->whereNotIn('r.status', ['borrador', 'cancelada'])
            ->whereNull('r.deleted_at')
            ->groupBy('s.reservation_id', DB::raw('coalesce(s.quote_item_id, s.id)'))
            ->selectRaw('max(coalesce(s.pax, 0)) as pax');

        return (int) DB::query()->fromSub($perItem, 'x')->sum('pax');
    }

    public function heldOn(string $productId, string $date): int
    {
        return (int) DB::table('catalog_availability_holds')
            ->where('product_id', $productId)
            ->where('service_date', $date)
            ->where('status', 'hold')
            ->where('expires_at', '>', now())
            ->sum('quantity');
    }
}
