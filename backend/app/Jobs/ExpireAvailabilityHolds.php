<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Channels\Support\EcommerceOrderRelease;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Site\Support\CheckoutTerms;
use Illuminate\Support\Facades\DB;

final class ExpireAvailabilityHolds extends TenantJob
{
    public const QUEUE = 'critical';

    private const ORDER_REASON = 'Pago no recibido: el pedido web venció sin pago y se liberaron los cupos.';

    protected function run(): string
    {
        $audit = app(AuditLogger::class);
        $holds = $this->expireHolds('catalog_availability_holds', $audit);
        $inventory = $this->expireHolds('booking_inventory_holds', $audit);
        $orders = $this->expireOrders($audit);

        if ($holds + $inventory + $orders === 0) {
            return 'Sin holds ni pedidos vencidos';
        }

        return implode(' · ', array_filter([
            $holds + $inventory > 0 ? self::plural($holds + $inventory, 'hold expirado', 'holds expirados') : null,
            $orders > 0 ? self::plural($orders, 'pedido web vencido', 'pedidos web vencidos') : null,
        ]));
    }

    private function expireHolds(string $table, AuditLogger $audit): int
    {
        $rows = DB::table($table)->where('status', 'hold')->whereNotNull('expires_at')->where('expires_at', '<', now())
            ->orderBy('id')->lockForUpdate()->get(['id', ...($table === 'catalog_availability_holds' ? ['ref'] : [])]);

        if ($rows->isEmpty()) {
            return 0;
        }

        DB::table($table)->whereIn('id', $rows->pluck('id'))->update(['status' => 'expirada', 'updated_at' => now()]);

        foreach ($rows as $row) {
            $audit->log('Disponibilidad', (string) ($row->ref ?? $row->id), 'expirar_hold', 'hold', 'expirada');
        }

        return $rows->count();
    }

    private function expireOrders(AuditLogger $audit): int
    {
        $orders = DB::table('channel_ecom_orders as o')->whereIn('o.status', ['pago_pendiente', 'pago_rechazado'])
            ->whereNotNull('o.hold_expires_at')->where('o.hold_expires_at', '<', now())
            ->whereNotExists(fn ($query) => $query->selectRaw('1')->from('booking_reservation_web_snapshots as s')->whereColumn('s.order_code', 'o.code')->where('s.payment_mode', CheckoutTerms::PAY_LATER))
            ->orderBy('o.id')->lockForUpdate()->get(['o.id', 'o.code', 'o.status']);
        $release = app(EcommerceOrderRelease::class);

        foreach ($orders as $order) {
            $release->release((string) $order->id, 'expirada', self::ORDER_REASON, 'pedido web vencido');

            DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'expirado', 'updated_at' => now()]);
            $audit->log('Pedido web', (string) $order->code, 'expirar', (string) $order->status, 'expirado');
        }

        return $orders->count();
    }
}
