<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Actions\PaymentLinks;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PaymentLinkDirectory
{
    private const SORTS = ['created_at' => 'l.created_at', 'expires_at' => 'l.expires_at', 'amount' => 'l.amount', 'code' => 'l.code'];

    public function list(Request $request, User $viewer): array
    {
        DB::table('fin_payment_links')->where('status', 'activo')->where('expires_at', '<', now())->update(['status' => 'vencido']);
        $filters = CursorPage::filters($request);
        $query = $this->base($viewer);
        $kpis = $this->kpis(clone $query);

        if (isset($filters['status']) && isset(PaymentLinks::STATUSES[$filters['status']])) {
            $query->where('l.status', $filters['status']);
        }

        if (isset($filters['q'])) {
            $term = '%'.mb_strtolower($filters['q']).'%';
            $query->where(fn (Builder $scope) => $scope->whereRaw('lower(l.code) like ?', [$term])->orWhereRaw('lower(r.code) like ?', [$term])->orWhereRaw('lower(c.name) like ?', [$term])->orWhereRaw('lower(coalesce(f.code, \'\')) like ?', [$term]));
        }

        return CursorPage::respond($request, $query, self::SORTS, '-created_at', fn (object $row): array => $this->row($row), [
            'kpis' => $kpis,
            'methods' => collect(PaymentLinks::METHODS)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'statuses' => collect(PaymentLinks::STATUSES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'own_portfolio' => Portfolio::ownOnly($viewer),
        ]);
    }

    public function find(string $code, User $viewer): ?array
    {
        $row = $this->base($viewer)->where('l.code', $code)->first();

        return $row === null ? null : $this->row($row);
    }

    public function targets(User $viewer): array
    {
        $receivables = Portfolio::scope(
            DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->join('crm_clients as c', 'c.id', '=', 'r.client_id')
                ->whereNull('f.deleted_at')->whereIn('f.status', ['abierta', 'parcial', 'vencida']),
            $viewer,
            'r.owner_id',
        )->orderBy('f.due_date')->limit(60)->get(['f.code', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'r.code as reservation', 'c.name as client']);

        return $receivables->map(fn (object $row) => [
            'code' => $row->code,
            'label' => $row->code.' · '.$row->client,
            'detail' => trim(($row->concept ? $row->concept.' · ' : '').$row->reservation),
            'currency' => $row->currency,
            'open' => (string) Decimal::round2(BigDecimal::of((string) $row->amount)->minus((string) $row->paid_amount)),
            'due_date' => $row->due_date,
        ])->all();
    }

    private function base(User $viewer): Builder
    {
        $query = DB::table('fin_payment_links as l')
            ->leftJoin('fin_receivables as f', 'f.id', '=', 'l.receivable_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', DB::raw('coalesce(l.reservation_id, f.reservation_id)'))
            ->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('fin_payments as p', 'p.id', '=', 'l.payment_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'l.created_by')
            ->select(['l.id', 'l.code', 'l.amount', 'l.currency', 'l.methods', 'l.installments_max', 'l.url', 'l.sent_via', 'l.expires_at', 'l.status', 'l.paid_at', 'l.lock_version', 'l.created_at', 'l.reservation_id', 'l.receivable_id', 'l.gift_card_id', 'l.provider',
                'f.code as receivable_code', 'f.concept as receivable_concept', 'r.code as reservation_code', 'r.title as reservation_title', 'c.name as client_name', 'c.email as client_email', 'c.phone as client_phone', 'p.code as payment_code', 'u.name as created_by_name']);

        return Portfolio::scope($query, $viewer, 'r.owner_id');
    }

    private function kpis(Builder $query): array
    {
        $rows = $query->reorder()->select(['l.status', 'l.currency', DB::raw('count(*) as total'), DB::raw('sum(l.amount) as amount')])->groupBy('l.status', 'l.currency')->get();
        $result = [];

        foreach (array_keys(PaymentLinks::STATUSES) as $status) {
            $items = $rows->where('status', $status);
            $result[$status] = [
                'count' => (int) $items->sum('total'),
                'pen' => (string) Decimal::round2((string) ($items->firstWhere('currency', 'PEN')->amount ?? '0')),
                'usd' => (string) Decimal::round2((string) ($items->firstWhere('currency', 'USD')->amount ?? '0')),
            ];
        }

        return $result;
    }

    private function row(object $row): array
    {
        $methods = array_values(array_filter(explode(',', trim((string) $row->methods, '{}'))));

        return [
            'id' => $row->id,
            'code' => $row->code,
            'reservation_id' => $row->reservation_id,
            'receivable_id' => $row->receivable_id,
            'gift_card_id' => $row->gift_card_id,
            'status' => $row->status,
            'status_label' => PaymentLinks::STATUSES[$row->status] ?? $row->status,
            'amount' => (string) $row->amount,
            'currency' => $row->currency,
            'methods' => $methods,
            'method_labels' => array_map(fn (string $method) => PaymentLinks::METHODS[$method] ?? $method, $methods),
            'installments_max' => (int) $row->installments_max,
            'provider' => $row->provider,
            'url' => $row->status === 'activo' ? $row->url : null,
            'sent_via' => $row->sent_via,
            'expires_at' => Carbon::parse((string) $row->expires_at)->toIso8601String(),
            'paid_at' => $row->paid_at ? Carbon::parse((string) $row->paid_at)->toIso8601String() : null,
            'created_at' => Carbon::parse((string) $row->created_at)->toIso8601String(),
            'created_by' => $row->created_by_name,
            'reservation' => $row->reservation_code ? ['code' => $row->reservation_code, 'title' => $row->reservation_title] : null,
            'receivable' => $row->receivable_code ? ['code' => $row->receivable_code, 'concept' => $row->receivable_concept] : null,
            'client' => ['name' => $row->client_name, 'email' => $row->client_email, 'phone' => $row->client_phone],
            'payment' => $row->payment_code,
            'lock_version' => (int) $row->lock_version,
        ];
    }
}
