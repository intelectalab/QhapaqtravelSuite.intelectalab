<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Channels\Support\EcommerceDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ManageEcommerce
{
    public function __construct(private readonly AuditLogger $audit, private readonly ChannelKit $kit) {}

    public function publish(string $productCode, bool $published, User $actor): void
    {
        $product = DB::table('catalog_products')->where('code', $productCode)->whereNull('deleted_at')->first(['id', 'status', 'name']);

        if ($product === null) {
            throw ApiException::notFound('El producto no existe.');
        }

        if ($published && $product->status !== 'ACTIVE') {
            throw ApiException::conflict('ECO-BR-01', 'Solo se publican productos activos en el catálogo.');
        }

        $current = DB::table('catalog_product_channels')->where('product_id', $product->id)->where('channel', 'ecommerce')->first(['id', 'is_published']);
        $values = ['is_published' => $published, 'published_at' => $published ? now() : null, 'published_by' => $published ? $actor->getKey() : null, 'updated_by' => $actor->getKey(), 'updated_at' => now()];

        if ($current === null) {
            DB::table('catalog_product_channels')->insert(['product_id' => $product->id, 'channel' => 'ecommerce', 'created_by' => $actor->getKey(), ...$values]);
        } else {
            DB::table('catalog_product_channels')->where('id', $current->id)->update($values);
        }

        $this->audit->log('Producto en e-commerce', $productCode, $published ? 'publicar' : 'despublicar', $current && $current->is_published ? 'publicado' : 'no publicado', $published ? 'publicado' : 'no publicado');
    }

    public function cancel(string $code, string $reason, User $actor): void
    {
        $order = $this->kit->row('channel_ecom_orders', $code, ['id', 'status', 'lock_version']);

        if (! in_array($order->status, EcommerceDirectory::OPEN_STATUSES, true)) {
            throw ApiException::conflict('ECO-BR-04', 'Solo se anulan pedidos con el pago pendiente o rechazado.');
        }

        DB::table('channel_ecom_orders')->where('id', $order->id)->update([
            'status' => 'cancelado',
            'cancel_reason' => $reason,
            'lock_version' => $order->lock_version + 1,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Pedido web', $code, 'anular', $order->status, "cancelado · {$reason}");
    }
}
