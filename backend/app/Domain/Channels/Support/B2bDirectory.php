<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class B2bDirectory
{
    public function __construct(private readonly ChannelKit $kit) {}

    public function overview(User $viewer): array
    {
        $today = $this->kit->today();
        $rows = DB::table('channel_b2b_agencies as a')
            ->join('channel_b2b_price_lists as l', 'l.id', '=', 'a.price_list_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'a.crm_client_id')
            ->whereNull('a.deleted_at')
            ->orderBy('a.code')
            ->get(['a.*', 'l.name as price_list_name', 'c.code as client_code', 'c.name as client_name']);

        $sales = DB::table('booking_reservations')
            ->whereNotIn('status', ['cancelada', 'borrador'])
            ->whereNull('deleted_at')
            ->where(fn ($query) => $query->whereIn('agency_id', $rows->pluck('id'))->orWhereIn('client_id', $rows->pluck('crm_client_id')->filter()))
            ->get(['code', 'agency_id', 'client_id', 'total_amount', 'currency', 'status', 'travel_from', 'title']);

        $items = $rows->map(function (object $row) use ($sales, $today): array {
            $own = $sales->filter(fn (object $sale): bool => $sale->agency_id === $row->id || ($row->crm_client_id && $sale->client_id === $row->crm_client_id))->values();
            $limit = ChannelKit::money($row->credit_limit);
            $used = ChannelKit::money($row->credit_used);
            $total = ChannelKit::money($own->sum(fn (object $sale): float => (float) $sale->total_amount));

            return [
                'id' => $row->id,
                'code' => $row->code,
                'legal_name' => $row->legal_name,
                'ruc' => $row->ruc,
                'contact_name' => $row->contact_name,
                'booking_email' => $row->booking_email,
                'client' => $row->client_code ? ['code' => $row->client_code, 'name' => $row->client_name] : null,
                'price_list' => ['id' => $row->price_list_id, 'name' => $row->price_list_name],
                'commission_pct' => (float) $row->commission_pct,
                'currency' => $row->credit_currency,
                'credit_limit' => $limit,
                'credit_used' => $used,
                'credit_available' => max(0, $limit - $used),
                'usage_pct' => $limit > 0 ? round($used / $limit * 100, 1) : null,
                'valid_from' => $row->valid_from,
                'valid_to' => $row->valid_to,
                'status' => $row->status,
                'effective_status' => $row->status === 'activa' && $row->valid_to < $today ? 'vencida' : $row->status,
                'block_reason' => $row->block_reason,
                'lock_version' => (int) $row->lock_version,
                'sales' => $total,
                'commission' => round($total * (float) $row->commission_pct / 100, 2),
                'reservations' => $own->map(fn (object $sale): array => ['code' => $sale->code, 'title' => $sale->title, 'status' => $sale->status, 'travel_from' => $sale->travel_from, 'total' => ChannelKit::money($sale->total_amount), 'currency' => $sale->currency])->all(),
            ];
        })->values();

        $active = $items->where('effective_status', 'activa');

        return [
            'today' => $today,
            'kpis' => [
                'active' => $active->count(),
                'total' => $items->count(),
                'restricted' => $items->whereIn('effective_status', ['bloqueada', 'vencida'])->count(),
                'credit_limit' => ChannelKit::money($items->sum('credit_limit')),
                'credit_used' => ChannelKit::money($items->sum('credit_used')),
                'sales' => ChannelKit::money($items->sum('sales')),
                'commission' => ChannelKit::money($items->sum('commission')),
                'currency' => 'PEN',
            ],
            'items' => $items,
            'price_lists' => DB::table('channel_b2b_price_lists')->where('status', 'activa')->orderBy('name')->get(['id', 'name']),
            'clients' => DB::table('crm_clients')->whereNull('deleted_at')->orderBy('name')->get(['code', 'name']),
            'can_manage' => $viewer->can('channels.b2b.manage'),
        ];
    }
}
