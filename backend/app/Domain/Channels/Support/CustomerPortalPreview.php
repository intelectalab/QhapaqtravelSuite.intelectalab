<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class CustomerPortalPreview
{
    private const AWAITING = ['enviada', 'vista', 'negociacion'];

    public function __construct(private readonly ChannelKit $kit) {}

    public function show(User $viewer, ?string $clientCode): array
    {
        $today = $this->kit->today();
        $clients = Portfolio::clients(DB::table('crm_clients as c'), $viewer, 'c')
            ->whereNull('c.deleted_at')
            ->where(fn ($query) => $query
                ->whereExists(fn ($sub) => $sub->from('booking_reservations as r')->whereColumn('r.client_id', 'c.id')->whereNull('r.deleted_at'))
                ->orWhereExists(fn ($sub) => $sub->from('quote_quotes as q')->whereColumn('q.client_id', 'c.id')->where('q.status', '<>', 'borrador')->whereNull('q.deleted_at')))
            ->orderBy('c.name')
            ->get(['c.id', 'c.code', 'c.name', 'c.email', 'c.country', 'c.owner_id']);

        $client = $clients->firstWhere('code', $clientCode) ?? $clients->first();

        return [
            'today' => $today,
            'clients' => $clients->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->name])->values(),
            'client' => $client ? $this->portal($client, $today) : null,
        ];
    }

    public function portal(object $client, string $today): array
    {
        $reservations = DB::table('booking_reservations')->where('client_id', $client->id)->whereNull('deleted_at')->where('status', '<>', 'borrador')->orderByDesc('travel_from')->get(['id', 'code', 'title', 'status', 'travel_from', 'travel_to', 'total_amount', 'currency']);
        $ids = $reservations->pluck('id');
        $services = DB::table('booking_reservation_services')->whereIn('reservation_id', $ids)->where('status', '<>', 'cancelado')->get(['reservation_id', 'status']);
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $ids)->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
        $quotes = DB::table('quote_quotes as q')->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')->where('q.client_id', $client->id)->whereNull('q.deleted_at')->where('q.status', '<>', 'borrador')->orderByDesc('q.created_at')
            ->get(['q.code', 'q.title', 'q.status', 'q.valid_until', 'q.travel_from', 'q.currency', 'q.current_version_no', 'v.grand_total']);
        $receivables = DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->where('f.client_id', $client->id)->whereNull('f.deleted_at')->where('f.status', '<>', 'cancelada')->orderBy('f.due_date')
            ->get(['f.code', 'f.concept', 'f.kind', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'f.status', 'r.code as reservation']);
        $vouchers = DB::table('ops_vouchers as o')->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')->whereIn('o.reservation_id', $ids)->where('o.status', '<>', 'anulado')->orderBy('o.service_date')
            ->get(['o.code', 'o.service_label', 'o.service_date', 'o.status', 'o.version', 'r.code as reservation']);
        $wishlist = DB::table('channel_wishlist_items as w')->join('catalog_products as p', 'p.id', '=', 'w.product_id')->where('w.crm_client_id', $client->id)->get(['p.code', 'p.name']);
        $advisor = $client->owner_id ? DB::table('iam_users')->where('id', $client->owner_id)->first(['name', 'email', 'phone']) : null;
        $next = $reservations->filter(fn (object $row): bool => $row->travel_to >= $today && ! in_array($row->status, ['cancelada', 'completada'], true))->sortBy('travel_from')->first();
        $open = $receivables->filter(fn (object $row): bool => (float) $row->amount > (float) $row->paid_amount);

        return [
            'code' => $client->code,
            'name' => $client->name,
            'email' => $client->email,
            'country' => $client->country,
            'advisor' => $advisor ? ['name' => $advisor->name, 'email' => $advisor->email, 'phone' => $advisor->phone ?? null] : null,
            'kpis' => [
                'next_trip' => $next ? ['code' => $next->code, 'title' => $next->title, 'from' => $next->travel_from] : null,
                'awaiting_quotes' => $quotes->whereIn('status', self::AWAITING)->count(),
                'balance' => $open->groupBy('currency')->map(fn ($group) => ChannelKit::money($group->sum(fn (object $row): float => (float) $row->amount - (float) $row->paid_amount)))->all(),
                'documents' => $vouchers->count(),
            ],
            'reservations' => $reservations->map(function (object $row) use ($services, $passengers): array {
                $own = $services->where('reservation_id', $row->id);

                return [
                    'code' => $row->code,
                    'title' => $row->title,
                    'status' => $row->status,
                    'from' => $row->travel_from,
                    'to' => $row->travel_to,
                    'total' => ChannelKit::money($row->total_amount),
                    'currency' => $row->currency,
                    'services' => $own->count(),
                    'confirmed' => $own->whereIn('status', ['confirmado', 'completado'])->count(),
                    'passengers' => (int) ($passengers[$row->id] ?? 0),
                ];
            })->values(),
            'quotes' => $quotes->map(fn (object $row): array => [
                'code' => $row->code,
                'title' => $row->title,
                'status' => $row->status,
                'valid_until' => $row->valid_until,
                'travel_from' => $row->travel_from,
                'version' => (int) $row->current_version_no,
                'total' => $row->grand_total !== null ? ChannelKit::money($row->grand_total) : null,
                'currency' => $row->currency,
                'expired' => $row->status === 'vencida' || ($row->valid_until && $row->valid_until < $this->kit->today() && in_array($row->status, self::AWAITING, true)),
            ])->values(),
            'payments' => $receivables->map(fn (object $row): array => [
                'code' => $row->code,
                'concept' => $row->concept,
                'kind' => $row->kind,
                'reservation' => $row->reservation,
                'amount' => ChannelKit::money($row->amount),
                'paid' => ChannelKit::money($row->paid_amount),
                'balance' => ChannelKit::money((float) $row->amount - (float) $row->paid_amount),
                'currency' => $row->currency,
                'due_date' => $row->due_date,
                'status' => $row->status,
            ])->values(),
            'documents' => $vouchers->map(fn (object $row): array => ['code' => $row->code, 'label' => $row->service_label, 'date' => $row->service_date, 'status' => $row->status, 'version' => (int) $row->version, 'reservation' => $row->reservation])->values(),
            'wishlist' => $wishlist,
        ];
    }
}
