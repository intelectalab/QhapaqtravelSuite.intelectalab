<?php

declare(strict_types=1);

namespace App\Domain\Booking\Inventory;

use App\Domain\Booking\Contracts\InventoryReader;
use Illuminate\Support\Facades\DB;

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
