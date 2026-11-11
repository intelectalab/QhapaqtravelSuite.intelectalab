<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Channels\Support\EcommerceOrderRelease;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Site\Support\CheckoutTerms;
use Illuminate\Support\Facades\DB;

final class ReleasePayLaterHolds extends TenantJob
{
    public const QUEUE = 'critical';

    private const REASON = 'Pagar después: venció el bloqueo sin pago y se liberaron los cupos.';

    protected function run(): string
    {
        $orders = DB::table('channel_ecom_orders as o')->whereIn('o.status', ['pago_pendiente', 'pago_rechazado'])
            ->whereNotNull('o.hold_expires_at')->where('o.hold_expires_at', '<', now())
            ->whereExists(fn ($query) => $query->selectRaw('1')->from('booking_reservation_web_snapshots as s')->whereColumn('s.order_code', 'o.code')->where('s.payment_mode', CheckoutTerms::PAY_LATER))
            ->orderBy('o.id')->lockForUpdate()->get(['o.id', 'o.code', 'o.status']);

        if ($orders->isEmpty()) {
            return 'Sin reservas de pagar después vencidas';
        }

        $release = app(EcommerceOrderRelease::class);
        $audit = app(AuditLogger::class);

        foreach ($orders as $order) {
            $release->release((string) $order->id, 'expirada', self::REASON, 'pagar después vencido');
            DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'expirado', 'updated_at' => now()]);
            $audit->log('Pedido web', (string) $order->code, 'liberar_pagar_despues', (string) $order->status, 'expirado');
        }

        return self::plural($orders->count(), 'reserva liberada', 'reservas liberadas');
    }
}
