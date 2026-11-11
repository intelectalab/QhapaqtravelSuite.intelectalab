<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Crm\Actions\ArcoRequests;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Site\Actions\SiteAccount;
use Brick\Math\BigDecimal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SiteAccountDirectory
{
    public function __construct(private readonly SiteCatalog $catalog) {}

    public function me(PortalAccount $account): array
    {
        $client = $account->client;
        $consent = DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $client->id)->where('channel', 'email')->value('status');

        return [
            'code' => $client->code,
            'name' => $client->name,
            'email' => $client->email,
            'login_email' => $account->user->email,
            'phone' => $client->phone,
            'country' => $client->country,
            'city' => $client->city,
            'document' => $client->doc_number ? trim(($client->doc_type ?? '').' '.$client->doc_number) : null,
            'birth_date' => $client->birth_date,
            'locale' => $account->user->locale ?? 'es',
            'verified' => SiteAccount::verified($account->user),
            'newsletter' => $consent === 'otorgado',
            'passenger' => $account->isPassenger(),
            'arco_types' => collect(ArcoRequests::TYPES)->map(fn (array $type, string $value): array => ['value' => $value, 'label' => $type['label'], 'days' => $type['days']])->values()->all(),
            'arco_requests' => $account->isPassenger() ? [] : DB::table('crm_cases')->where('client_id', $client->id)->where('type_code', ArcoRequests::CASE_TYPE)->orderByDesc('created_at')->limit(10)
                ->get(['code', 'subject', 'status', 'due_date', 'created_at', 'resolution'])->map(fn (stdClass $row): array => (array) $row)->all(),
            'portal_url' => rtrim((string) config('app.frontend_url'), '/').'/portal',
        ];
    }

    public function reservations(PortalAccount $account): array
    {
        $rows = $account->reservations();
        $ids = $rows->pluck('id')->all();
        $receivables = $this->receivableRows($account, $ids);
        $vouchers = DB::table('ops_vouchers')->whereIn('reservation_id', $ids)->where('status', '<>', 'anulado')->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
        $orders = DB::table('booking_reservations as r')->join('channel_ecom_orders as o', 'o.id', '=', 'r.ecom_order_id')->whereIn('r.id', $ids)->pluck('o.code', 'r.id');

        return [
            'items' => $rows->map(fn (stdClass $row): array => [
                'code' => $row->code,
                'title' => $row->title,
                'status' => $row->status,
                'from' => $row->travel_from,
                'to' => $row->travel_to,
                'total' => Decimal::toApi((string) $row->total_amount),
                'currency' => $row->currency,
                'balance' => $this->sum($receivables->where('reservation_id', $row->id), 'payable'),
                'vouchers' => (int) ($vouchers[$row->id] ?? 0),
                'order' => $orders[$row->id] ?? null,
            ])->values()->all(),
        ];
    }

    public function reservation(PortalAccount $account, string $code): array
    {
        $row = $account->reservation($code);
        $services = DB::table('booking_reservation_services')->where('reservation_id', $row->id)->orderBy('service_date')->orderBy('service_time')->get(['name', 'service_date', 'service_time', 'pax', 'status', 'confirmation_code']);
        $passengers = DB::table('booking_passengers')->where('reservation_id', $row->id)->orderBy('seq')->get(['full_name', 'pax_type', 'pending', 'is_lead']);
        $payments = DB::table('fin_payments')->where('reservation_id', $row->id)->where('kind', 'cobro')->orderByDesc('paid_on')->get(['code', 'method', 'amount', 'currency', 'status', 'paid_on']);
        $order = DB::table('booking_reservations as r')->join('channel_ecom_orders as o', 'o.id', '=', 'r.ecom_order_id')->where('r.id', $row->id)->value('o.code');

        return [
            'code' => $row->code,
            'title' => $row->title,
            'status' => $row->status,
            'from' => $row->travel_from,
            'to' => $row->travel_to,
            'total' => Decimal::toApi((string) $row->total_amount),
            'currency' => $row->currency,
            'order' => $order,
            'services' => $services->map(fn (stdClass $s): array => ['name' => $s->name, 'date' => $s->service_date, 'time' => $s->service_time ? substr((string) $s->service_time, 0, 5) : null, 'pax' => (int) $s->pax, 'status' => $s->status, 'confirmation' => $s->confirmation_code])->all(),
            'passengers' => $passengers->map(fn (stdClass $p): array => ['name' => $p->full_name, 'type' => $p->pax_type, 'pending' => (bool) $p->pending, 'lead' => (bool) $p->is_lead])->all(),
            'receivables' => $account->isPassenger() ? [] : $this->receivableRows($account, [$row->id])->map(fn (array $r): array => $this->receivable($r))->values()->all(),
            'vouchers' => $this->voucherRows([$row->id])->all(),
            'payments' => $account->isPassenger() ? [] : $payments->map(fn (stdClass $p): array => ['code' => $p->code, 'method' => $p->method, 'amount' => Decimal::toApi((string) $p->amount), 'currency' => $p->currency, 'status' => $p->status, 'date' => $p->paid_on])->all(),
        ];
    }

    public function vouchers(PortalAccount $account): array
    {
        return ['items' => $this->voucherRows($account->reservations()->pluck('id')->all())->all()];
    }

    public function voucher(PortalAccount $account, string $code): string
    {
        $id = DB::table('ops_vouchers')->where('code', $code)->where('status', '<>', 'anulado')->whereIn('reservation_id', $account->reservations()->pluck('id')->all())->value('id');

        return (string) ($id ?? throw ApiException::notFound('No encontramos ese voucher en tu cuenta.'));
    }

    public function receivables(PortalAccount $account, ?string $status): array
    {
        $rows = $account->isPassenger() ? collect() : $this->receivableRows($account, $account->reservations()->pluck('id')->all());
        $open = $rows->filter(fn (array $r): bool => in_array($r['status'], ['abierta', 'parcial', 'vencida'], true));
        $list = $status === 'open' ? $open : $rows;

        return [
            'items' => $list->map(fn (array $r): array => $this->receivable($r))->values()->all(),
            'totals' => ['payable' => $this->sum($open, 'payable'), 'pending' => $this->sum($open, 'pending')],
            'methods' => collect(CheckoutTerms::METHODS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'bank_accounts' => CheckoutTerms::bankAccounts(),
        ];
    }

    public function wishlist(PortalAccount $account): array
    {
        $ids = DB::table('channel_wishlist_items')->where('crm_client_id', $account->client->id)->orderByDesc('created_at')->pluck('product_id')->all();
        $products = $this->catalog->products()->whereIn('id', $ids)->sortBy(fn (stdClass $product): int|false => array_search($product->id, $ids, true));

        return ['items' => $products->map(fn (stdClass $product): array => $this->catalog->card($product))->values()->all()];
    }

    public static function payable(stdClass $receivable, string $pending): BigDecimal
    {
        $open = BigDecimal::of((string) $receivable->amount)->minus((string) $receivable->paid_amount)->minus($pending);

        return $open->isPositive() ? Decimal::round2($open) : BigDecimal::zero()->toScale(2);
    }

    public static function pending(string $receivableId): string
    {
        return (string) Decimal::round2(BigDecimal::of((string) (DB::table('fin_payments')->where('receivable_id', $receivableId)->where('status', 'pendiente')->sum('amount') ?: '0')));
    }

    private function receivableRows(PortalAccount $account, array $reservationIds): Collection
    {
        $rows = DB::table('fin_receivables as f')->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')
            ->whereIn('f.reservation_id', $reservationIds)->where('f.client_id', $account->client->id)->whereNull('f.deleted_at')->where('f.status', '<>', 'cancelada')
            ->orderBy('f.due_date')->get(['f.id', 'f.code', 'f.kind', 'f.concept', 'f.amount', 'f.paid_amount', 'f.currency', 'f.due_date', 'f.status', 'f.reservation_id', 'r.code as reservation', 'r.title as reservation_title']);
        $pending = DB::table('fin_payments')->whereIn('receivable_id', $rows->pluck('id'))->where('status', 'pendiente')->selectRaw('receivable_id, sum(amount) as total')->groupBy('receivable_id')->pluck('total', 'receivable_id');

        return $rows->map(function (stdClass $row) use ($pending): array {
            $waiting = (string) Decimal::round2(BigDecimal::of((string) ($pending[$row->id] ?? '0')));

            return [...(array) $row, 'pending' => $waiting, 'payable' => (string) self::payable($row, $waiting)];
        });
    }

    private function receivable(array $row): array
    {
        return [
            'code' => $row['code'],
            'kind' => $row['kind'],
            'concept' => $row['concept'],
            'reservation' => $row['reservation'],
            'reservation_title' => $row['reservation_title'],
            'amount' => Decimal::toApi((string) $row['amount']),
            'paid' => Decimal::toApi((string) $row['paid_amount']),
            'pending' => Decimal::toApi($row['pending']),
            'payable' => Decimal::toApi($row['payable']),
            'currency' => $row['currency'],
            'due_date' => $row['due_date'],
            'status' => $row['status'],
            'can_pay' => BigDecimal::of($row['payable'])->isPositive(),
        ];
    }

    private function voucherRows(array $reservationIds): Collection
    {
        return DB::table('ops_vouchers as v')->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')->whereIn('v.reservation_id', $reservationIds)->where('v.status', '<>', 'anulado')
            ->orderBy('v.service_date')->get(['v.code', 'v.service_label', 'v.service_date', 'v.status', 'r.code as reservation'])
            ->map(fn (stdClass $v): array => ['code' => $v->code, 'label' => $v->service_label, 'date' => $v->service_date, 'status' => $v->status, 'reservation' => $v->reservation]);
    }

    private function sum(Collection $rows, string $key): array
    {
        return $rows->groupBy('currency')->map(fn (Collection $group, string $currency): array => [
            'currency' => $currency,
            'amount' => Decimal::toApi((string) $group->reduce(fn (BigDecimal $carry, array $row): BigDecimal => $carry->plus((string) $row[$key]), BigDecimal::zero()->toScale(2))),
        ])->values()->all();
    }
}
