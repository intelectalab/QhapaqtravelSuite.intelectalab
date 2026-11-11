<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class EcommerceDirectory
{
    public const OPEN_STATUSES = ['pago_pendiente', 'pago_por_validar', 'pago_rechazado'];

    public function order(string $code, User $viewer): array
    {
        $order = collect($this->overview($viewer)['orders'])->firstWhere('code', $code) ?? throw ApiException::notFound('El pedido no existe.');
        $id = DB::table('channel_ecom_orders')->where('code', $code)->value('id');
        $reservations = DB::table('booking_reservations')->where('ecom_order_id', $id)->get(['id', 'code', 'status', 'title', 'travel_from']);

        return [
            ...$order,
            'passengers' => DB::table('channel_ecom_passengers')->where('order_id', $id)->orderBy('position')->get(['full_name', 'pax_type'])->map(fn (object $p): array => ['name' => $p->full_name, 'type' => $p->pax_type])->all(),
            'reservations' => $reservations->map(fn (object $r): array => [
                'code' => $r->code,
                'status' => $r->status,
                'title' => $r->title,
                'date' => $r->travel_from,
                'receivables' => DB::table('fin_receivables')->where('reservation_id', $r->id)->whereNull('deleted_at')->orderBy('due_date')->get(['code', 'kind', 'amount', 'paid_amount', 'currency', 'status', 'due_date'])
                    ->map(fn (object $c): array => ['code' => $c->code, 'kind' => $c->kind, 'amount' => ChannelKit::money($c->amount), 'paid' => ChannelKit::money($c->paid_amount), 'currency' => $c->currency, 'status' => $c->status, 'due_date' => $c->due_date])->all(),
            ])->all(),
        ];
    }

    public function overview(User $viewer): array
    {
        $orders = DB::table('channel_ecom_orders as o')
            ->leftJoin('catalog_products as p', 'p.id', '=', 'o.product_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'o.reservation_id')
            ->orderByDesc('o.ordered_at')
            ->get(['o.id', 'o.code', 'o.ordered_at', 'o.customer_name', 'o.customer_email', 'o.customer_country', 'o.pax_total', 'o.total', 'o.currency', 'o.status', 'o.promo_code', 'o.discount_amount', 'o.cancel_reason', 'o.lock_version', 'o.product_id', 'p.code as product_code', 'p.name as product_name', 'r.code as reservation_code']);

        $products = DB::table('catalog_products as p')
            ->leftJoin('catalog_product_channels as c', fn ($join) => $join->on('c.product_id', '=', 'p.id')->where('c.channel', 'ecommerce'))
            ->whereNull('p.deleted_at')
            ->where(fn ($query) => $query->where('p.is_ecommerce', true)->orWhere('c.is_published', true))
            ->orderBy('p.name')
            ->get(['p.id', 'p.code', 'p.name', 'p.status', 'p.is_featured', 'p.rating_avg', 'p.rating_count', 'c.is_published', 'c.published_at']);

        $attempts = [];
        foreach (DB::table('channel_ecom_payment_attempts')->whereIn('order_id', $orders->pluck('id'))->orderByDesc('attempted_at')
            ->get(['order_id', 'attempted_at', 'method', 'card_masked', 'operation_ref', 'result', 'gateway_code', 'message', 'amount', 'currency']) as $a) {
            $attempts[(string) $a->order_id][] = [
                'at' => $a->attempted_at,
                'method' => $a->method,
                'card' => $a->card_masked,
                'operation' => $a->operation_ref,
                'result' => $a->result,
                'code' => $a->gateway_code,
                'message' => $a->message,
                'amount' => $a->amount === null ? null : ChannelKit::money($a->amount),
                'currency' => $a->currency,
            ];
        }
        $links = [];
        foreach (DB::table('audit_events')->where('entity', 'Pedido web')->where('action', 'enviar_enlace_pago')->whereIn('entity_id', $orders->pluck('code'))
            ->orderByDesc('occurred_at')->get(['entity_id', 'occurred_at', 'after_value']) as $l) {
            $links[(string) $l->entity_id][] = ['at' => $l->occurred_at, 'detail' => $l->after_value];
        }
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
                'can_send_link' => in_array($row->status, ['pago_pendiente', 'pago_rechazado'], true),
                'attempts' => $attempts[(string) $row->id] ?? [],
                'links' => $links[(string) $row->code] ?? [],
                'lock_version' => (int) $row->lock_version,
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
