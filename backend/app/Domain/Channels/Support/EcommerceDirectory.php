<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class EcommerceDirectory
{
    public const OPEN_STATUSES = ['pago_pendiente', 'pago_por_validar', 'pago_rechazado'];

    public function overview(User $viewer): array
    {
        $orders = DB::table('channel_ecom_orders as o')
            ->leftJoin('catalog_products as p', 'p.id', '=', 'o.product_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'o.reservation_id')
            ->orderByDesc('o.ordered_at')
            ->get(['o.code', 'o.ordered_at', 'o.customer_name', 'o.customer_email', 'o.customer_country', 'o.pax_total', 'o.total', 'o.currency', 'o.status', 'o.promo_code', 'o.discount_amount', 'o.cancel_reason', 'o.product_id', 'p.code as product_code', 'p.name as product_name', 'r.code as reservation_code']);

        $products = DB::table('catalog_products as p')
            ->leftJoin('catalog_product_channels as c', fn ($join) => $join->on('c.product_id', '=', 'p.id')->where('c.channel', 'ecommerce'))
            ->whereNull('p.deleted_at')
            ->where(fn ($query) => $query->where('p.is_ecommerce', true)->orWhere('c.is_published', true))
            ->orderBy('p.name')
            ->get(['p.id', 'p.code', 'p.name', 'p.status', 'p.is_featured', 'p.rating_avg', 'p.rating_count', 'c.is_published', 'c.published_at']);

        $sessions = DB::table('channel_web_events')->distinct()->count('session_id');
        $events = DB::table('channel_web_events')->selectRaw('event, count(*) as total')->groupBy('event')->pluck('total', 'event');
        $confirmed = $orders->where('status', 'confirmado');

        return [
            'kpis' => [
                'orders' => $orders->count(),
                'confirmed' => $confirmed->count(),
                'pending' => $orders->whereIn('status', self::OPEN_STATUSES)->where('status', '<>', 'pago_rechazado')->count(),
                'rejected' => $orders->where('status', 'pago_rechazado')->count(),
                'conversion' => $orders->count() > 0 ? round($confirmed->count() / $orders->count() * 100, 1) : 0,
                'revenue' => $confirmed->groupBy('currency')->map(fn ($group) => ChannelKit::money($group->sum('total')))->all(),
                'published' => $products->where('is_published', true)->count(),
            ],
            'funnel' => [
                ['id' => 'sessions', 'label' => 'Sesiones', 'value' => $sessions],
                ['id' => 'views', 'label' => 'Vistas de página', 'value' => (int) ($events['page_view'] ?? 0)],
                ['id' => 'orders', 'label' => 'Pedidos', 'value' => $orders->count()],
                ['id' => 'paid', 'label' => 'Pagados', 'value' => $confirmed->count()],
            ],
            'orders' => $orders->map(fn (object $row): array => [
                'code' => $row->code,
                'ordered_at' => $row->ordered_at,
                'customer' => $row->customer_name,
                'email' => $row->customer_email,
                'country' => $row->customer_country,
                'product' => $row->product_code ? ['code' => $row->product_code, 'name' => $row->product_name] : null,
                'pax' => (int) $row->pax_total,
                'total' => ChannelKit::money($row->total),
                'currency' => $row->currency,
                'status' => $row->status,
                'promo_code' => $row->promo_code,
                'reservation' => $row->reservation_code,
                'cancel_reason' => $row->cancel_reason,
                'can_cancel' => in_array($row->status, self::OPEN_STATUSES, true),
            ])->values(),
            'products' => $products->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'status' => $row->status,
                'featured' => (bool) $row->is_featured,
                'rating' => $row->rating_avg !== null ? (float) $row->rating_avg : null,
                'rating_count' => (int) $row->rating_count,
                'published' => (bool) $row->is_published,
                'published_at' => $row->published_at,
                'orders' => $orders->where('product_id', $row->id)->count(),
                'sales' => $orders->where('product_id', $row->id)->where('status', 'confirmado')->groupBy('currency')->map(fn ($group) => ChannelKit::money($group->sum('total')))->all(),
            ])->values(),
            'can_manage' => $viewer->can('channels.ecommerce.manage'),
        ];
    }
}
