<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\EcommerceDirectory;
use App\Domain\Channels\Support\EcommerceOrderRelease;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Actions\SiteCheckout;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ManageEcommerce
{
    public const LINKABLE = ['pago_pendiente', 'pago_rechazado'];

    private const LINK_DAYS = 3;

    public function __construct(private readonly AuditLogger $audit, private readonly EcommerceOrderRelease $release, private readonly TenantContext $context) {}

    public function sendPaymentLink(string $code, ?string $note, User $actor): array
    {
        $order = DB::table('channel_ecom_orders')->where('code', $code)->first() ?? throw ApiException::notFound('El pedido no existe.');

        if (! in_array($order->status, self::LINKABLE, true)) {
            throw ApiException::conflict('ECO-BR-14', 'El enlace de pago solo se envía a pedidos con el pago pendiente o rechazado.');
        }

        $tenant = $this->context->tenant();
        $until = Carbon::now($tenant->timezone ?: 'America/Lima')->addDays(self::LINK_DAYS)->toDateString();
        $link = rtrim((string) config('app.frontend_url'), '/').'/sitio/'.$tenant->subdomain.'/confirmacion/'.$order->code.'/acceso?token='.SiteCheckout::paymentLink($order, $until);
        $body = "Hola {$order->customer_name}:\n\nTu pedido {$order->code} con {$tenant->commercial_name} está listo para el pago.".($note ? "\n\n{$note}" : '')."\n\nPaga aquí con tarjeta, transferencia, Yape o Plin:\n{$link}\n\nEl enlace vence el ".Carbon::parse($until)->format('d/m/Y').'.';
        app(QueuedMail::class)->send((string) $order->customer_email, (string) $order->customer_name, "Completa el pago de tu pedido {$order->code} · {$tenant->commercial_name}", $body);
        $this->audit->log('Pedido web', $code, 'enviar_enlace_pago', $order->status, "{$order->customer_email} · vence {$until}", actor: $actor);

        return ['code' => $order->code, 'sent_to' => $order->customer_email, 'expires_on' => $until];
    }

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
        DB::transaction(function () use ($code, $reason, $actor): void {
            $order = DB::table('channel_ecom_orders')->where('code', $code)->lockForUpdate()->first(['id', 'status', 'lock_version']) ?? throw ApiException::notFound();

            if (! in_array($order->status, EcommerceDirectory::OPEN_STATUSES, true)) {
                throw ApiException::conflict('ECO-BR-04', 'Solo se anulan pedidos con el pago pendiente o rechazado.');
            }

            $this->release->release((string) $order->id, 'liberada', "Pedido web anulado: {$reason}", 'pedido web anulado');

            DB::table('channel_ecom_orders')->where('id', $order->id)->update([
                'status' => 'cancelado',
                'cancel_reason' => $reason,
                'lock_version' => $order->lock_version + 1,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);

            $this->audit->log('Pedido web', $code, 'anular', $order->status, "cancelado · {$reason}");
        });
    }
}
