<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Finance\Actions\GiftCards;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class GiftCardDirectory
{
    private const SORTS = ['created_at' => 'g.created_at', 'expires_at' => 'g.expires_at', 'balance' => 'g.balance', 'code' => 'g.code'];

    public function list(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->base();
        $kpis = $this->kpis();

        if (isset($filters['status']) && isset(GiftCards::STATUSES[$filters['status']])) {
            $query->where('g.status', $filters['status']);
        }

        if (isset($filters['q'])) {
            $term = '%'.mb_strtolower($filters['q']).'%';
            $query->where(fn (Builder $scope) => $scope->whereRaw('lower(g.code) like ?', [$term])->orWhereRaw('lower(coalesce(g.recipient_name, \'\')) like ?', [$term])->orWhereRaw('lower(coalesce(c.name, \'\')) like ?', [$term])->orWhere('g.redeem_code_last4', mb_strtoupper($filters['q'])));
        }

        return CursorPage::respond($request, $query, self::SORTS, '-created_at', fn (object $row): array => $this->row($row), [
            'kpis' => $kpis,
            'statuses' => collect(GiftCards::STATUSES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
        ]);
    }

    public function find(string $code): ?array
    {
        $row = $this->base()->where('g.code', $code)->first();

        return $row === null ? null : $this->row($row);
    }

    public function detail(string $code): ?array
    {
        $card = $this->find($code);

        if ($card === null) {
            return null;
        }

        $movements = DB::table('fin_gift_card_movements as m')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'm.reservation_id')
            ->leftJoin('fin_receivables as f', 'f.id', '=', 'm.receivable_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'm.created_by')
            ->where('m.gift_card_id', $card['id'])
            ->orderBy('m.created_at')->orderBy('m.id')
            ->get(['m.kind', 'm.amount', 'm.balance_after', 'm.note', 'm.created_at', 'r.code as reservation', 'f.code as receivable', 'u.name as user'])
            ->map(fn (object $row) => [
                'kind' => $row->kind,
                'kind_label' => GiftCards::KINDS[$row->kind] ?? $row->kind,
                'amount' => (string) $row->amount,
                'balance_after' => (string) $row->balance_after,
                'note' => $row->note,
                'reservation' => $row->reservation,
                'receivable' => $row->receivable,
                'user' => $row->user,
                'at' => Carbon::parse((string) $row->created_at)->toIso8601String(),
            ])->all();

        return [...$card, 'movements' => $movements];
    }

    private function base(): Builder
    {
        return DB::table('fin_gift_cards as g')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'g.buyer_client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'g.created_by')
            ->select(['g.id', 'g.code', 'g.redeem_code_last4', 'g.initial_amount', 'g.balance', 'g.currency', 'g.recipient_name', 'g.recipient_email', 'g.message', 'g.deliver_at', 'g.expires_at', 'g.status', 'g.lock_version', 'g.created_at', 'c.code as buyer_code', 'c.name as buyer_name', 'u.name as created_by_name']);
    }

    private function kpis(): array
    {
        $rows = DB::table('fin_gift_cards')->select(['status', 'currency', DB::raw('count(*) as total'), DB::raw('sum(balance) as balance'), DB::raw('sum(initial_amount) as issued')])->groupBy('status', 'currency')->get();
        $result = [];

        foreach (array_keys(GiftCards::STATUSES) as $status) {
            $items = $rows->where('status', $status);
            $result[$status] = [
                'count' => (int) $items->sum('total'),
                'balance_pen' => (string) Decimal::round2((string) ($items->firstWhere('currency', 'PEN')->balance ?? '0')),
                'balance_usd' => (string) Decimal::round2((string) ($items->firstWhere('currency', 'USD')->balance ?? '0')),
            ];
        }

        $redeemed = DB::table('fin_gift_card_movements as m')->join('fin_gift_cards as g', 'g.id', '=', 'm.gift_card_id')->where('m.kind', 'canje')->select(['g.currency', DB::raw('sum(-m.amount) as total')])->groupBy('g.currency')->pluck('total', 'currency');
        $result['redeemed'] = ['pen' => (string) Decimal::round2((string) ($redeemed['PEN'] ?? '0')), 'usd' => (string) Decimal::round2((string) ($redeemed['USD'] ?? '0'))];

        return $result;
    }

    private function row(object $row): array
    {
        $used = (float) $row->initial_amount > 0 ? round((1 - (float) $row->balance / (float) $row->initial_amount) * 100) : 0;

        return [
            'id' => $row->id,
            'code' => $row->code,
            'last4' => $row->redeem_code_last4,
            'status' => $row->status,
            'status_label' => GiftCards::STATUSES[$row->status] ?? $row->status,
            'initial_amount' => (string) $row->initial_amount,
            'balance' => (string) $row->balance,
            'currency' => $row->currency,
            'used_pct' => (int) $used,
            'recipient_name' => $row->recipient_name,
            'recipient_email' => $row->recipient_email,
            'message' => $row->message,
            'buyer' => $row->buyer_code ? ['code' => $row->buyer_code, 'name' => $row->buyer_name] : null,
            'deliver_at' => $row->deliver_at ? Carbon::parse((string) $row->deliver_at)->toIso8601String() : null,
            'expires_at' => $row->expires_at,
            'created_at' => Carbon::parse((string) $row->created_at)->toIso8601String(),
            'created_by' => $row->created_by_name ?? 'Sitio web',
            'lock_version' => (int) $row->lock_version,
        ];
    }
}
