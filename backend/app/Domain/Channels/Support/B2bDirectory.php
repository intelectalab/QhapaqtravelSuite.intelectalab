<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Catalog\Support\B2bRateDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class B2bDirectory
{
    public function __construct(private readonly ChannelKit $kit, private readonly B2bRateDirectory $rates) {}

    public function agency(string $code, User $viewer): array
    {
        return collect($this->overview($viewer)['items'])->firstWhere('code', $code) ?? throw ApiException::notFound('La agencia no existe.');
    }

    public function movements(string $code): array
    {
        $agency = DB::table('channel_b2b_agencies')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'credit_limit', 'credit_used', 'credit_currency'])
            ?? throw ApiException::notFound('La agencia no existe.');
        $rows = DB::table('channel_b2b_credit_movements as m')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'm.reservation_id')
            ->leftJoin('fin_payments as p', 'p.id', '=', 'm.payment_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'm.created_by')
            ->where('m.agency_id', $agency->id)->orderByDesc('m.created_at')
            ->get(['m.movement_type', 'm.amount', 'm.currency', 'm.source_amount', 'm.source_currency', 'm.fx_rate', 'm.balance_after', 'm.note', 'm.created_at', 'r.code as reservation', 'p.code as payment', 'u.name as user']);
        $items = [];

        foreach ($rows as $row) {
            $items[] = [
                'type' => $row->movement_type,
                'amount' => ChannelKit::money($row->amount),
                'currency' => $row->currency,
                'source' => $row->source_amount !== null ? ['amount' => ChannelKit::money($row->source_amount), 'currency' => $row->source_currency, 'fx_rate' => $row->fx_rate !== null ? (float) $row->fx_rate : null] : null,
                'balance_after' => ChannelKit::money($row->balance_after),
                'reservation' => $row->reservation,
                'payment' => $row->payment,
                'note' => $row->note,
                'user' => $row->user ?? 'Sistema',
                'at' => $row->created_at,
            ];
        }

        return [
            'agency' => $agency->code,
            'currency' => $agency->credit_currency,
            'credit_limit' => ChannelKit::money($agency->credit_limit),
            'credit_used' => ChannelKit::money($agency->credit_used),
            'items' => $items,
        ];
    }

    public function settlements(?string $status): array
    {
        $rows = DB::table('channel_b2b_settlement_requests as s')->join('channel_b2b_agencies as a', 'a.id', '=', 's.agency_id')->leftJoin('iam_users as u', 'u.id', '=', 's.requested_by')
            ->when($status !== null && $status !== '', fn ($query) => $query->where('s.status', $status))
            ->orderByDesc('s.created_at')
            ->get(['s.code', 's.amount_pen', 's.fx_rate', 's.commission_ids', 's.status', 's.created_at', 's.updated_at', 'a.code as agency_code', 'a.legal_name', 'u.name as requested_by']);
        $items = [];

        foreach ($rows as $row) {
            $items[] = [
                'code' => $row->code,
                'agency' => ['code' => $row->agency_code, 'name' => $row->legal_name],
                'amount_pen' => ChannelKit::money($row->amount_pen),
                'fx_rate' => (float) $row->fx_rate,
                'commissions' => count(array_filter(explode(',', trim((string) $row->commission_ids, '{}')))),
                'status' => $row->status,
                'requested_by' => $row->requested_by,
                'requested_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ];
        }

        return $items;
    }

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
                'rates' => $this->rates->forAgency((string) $row->id),
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
