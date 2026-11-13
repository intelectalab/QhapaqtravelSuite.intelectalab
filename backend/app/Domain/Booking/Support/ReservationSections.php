<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Catalog\Support\CancellationTiers;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ReservationSections
{
    private const WEB_RULES = ['R-MULTICURRENCY', 'R-LODGING', 'R-ADDONS', 'R-PICKUP', 'R-COMMENTS', 'R-DEPOSIT', 'R-PAY-LATER'];

    public function extras(object $row, array $view, User $viewer): array
    {
        return [
            'created_at' => $row->created_at,
            'snapshot_label' => $row->snapshot_label,
            'policies' => $this->policies($row),
            'change_log' => $this->changeLog($row->id, $view),
            'operation' => $viewer->can('operations.view') ? $this->operation($row->id) : null,
            'counts' => [
                'web' => DB::table('booking_reservation_web_snapshots')->where('reservation_id', $row->id)->count(),
                'feedback' => DB::table('channel_pax_feedback')->where('reservation_id', $row->id)->count(),
                'unread_feedback' => DB::table('channel_pax_feedback')->where('reservation_id', $row->id)->where('status', 'nuevo')->count(),
            ],
            'pax_feedback_on' => self::paxFeedbackOn(),
            ...($view['price'] ? [
                'payments' => $this->payments($row->id),
                'invoices' => $this->invoices($row->id),
            ] : []),
        ];
    }

    public function webSnapshot(string $reservationId, array $view): ?array
    {
        $snapshot = DB::table('booking_reservation_web_snapshots as w')->leftJoin('catalog_products as p', 'p.id', '=', 'w.product_id')
            ->where('w.reservation_id', $reservationId)->orderByDesc('w.created_at')->first(['w.*', 'p.name as product_name', 'p.code as product_code']);

        if ($snapshot === null) {
            return null;
        }

        return [
            'product' => $snapshot->product_code ? ['code' => $snapshot->product_code, 'name' => $snapshot->product_name] : null,
            'service_date' => $snapshot->service_date,
            'pax' => ['adt' => (int) $snapshot->pax_adt, 'chd' => (int) $snapshot->pax_chd, 'inf' => (int) $snapshot->pax_inf],
            'source' => $snapshot->source,
            'order_code' => $snapshot->order_code,
            'currency_display' => $snapshot->currency_display,
            'charge_currency' => $snapshot->charge_currency,
            'fx_rate' => $snapshot->fx_rate,
            ...($view['price'] ? [
                'lines' => json_decode((string) $snapshot->lines, true) ?? [],
                'adjustments' => json_decode((string) $snapshot->adjustments, true) ?? [],
                'total' => $snapshot->total,
                'total_display' => $snapshot->total_display,
                'payment' => ['mode' => $snapshot->payment_mode, 'deposit_pct' => $snapshot->deposit_pct, 'deposit' => $snapshot->deposit, 'balance' => $snapshot->balance, 'balance_due' => $snapshot->balance_due],
            ] : []),
            'lodging' => DB::table('booking_reservation_web_lodging')->where('snapshot_id', $snapshot->id)->orderBy('created_at')->get(['city', 'hotel_name', 'room_type', 'rooms', 'nights']),
            'addons' => DB::table('booking_reservation_web_addons')->where('snapshot_id', $snapshot->id)->orderBy('created_at')->get($view['price'] ? ['name', 'qty', 'amount'] : ['name', 'qty']),
            'pickup' => ['point' => $snapshot->pickup_point, 'address' => $snapshot->pickup_address, 'flight' => $snapshot->pickup_flight, 'arrival' => $snapshot->pickup_arrival],
            'comments' => $snapshot->comments,
            'companions' => ['pending' => (bool) $snapshot->companions_pending, 'due' => $snapshot->companions_due],
            'rules_applied' => $this->pgArray($snapshot->rules_applied),
            'rules_inactive' => $this->inactiveRules($snapshot->product_id),
        ];
    }

    public static function paxFeedbackOn(): bool
    {
        return app(RuleResolver::class)->on('R-PAX-FEEDBACK');
    }

    private function inactiveRules(?string $productId): array
    {
        $rules = app(RuleResolver::class);
        [$disabled] = $productId === null ? [[]] : $rules->productOverrides($productId);

        return array_values(array_filter(self::WEB_RULES, fn (string $code): bool => ! $rules->on($code) || array_key_exists($code, $disabled)));
    }

    public function paxFeedback(string $reservationId): Collection
    {
        return DB::table('channel_pax_feedback as f')->leftJoin('booking_reservation_services as s', 's.id', '=', 'f.reservation_service_id')
            ->leftJoin('ops_incidents as i', 'i.id', '=', 'f.incident_id')->leftJoin('iam_users as u', 'u.id', '=', 'f.replied_by')
            ->where('f.reservation_id', $reservationId)->orderByDesc('f.created_at')
            ->get(['f.code', 'f.passenger_name', 'f.type', 'f.rating', 'f.text', 'f.status', 'f.reply', 'f.replied_at', 'f.channel', 'f.created_at', 's.name as service_name', 'i.code as incident_code', 'u.name as replied_by']);
    }

    public function paxMessages(string $reservationId): Collection
    {
        return DB::table('notif_pax_messages')->where('reservation_id', $reservationId)->orderByDesc(DB::raw('coalesce(sent_at, scheduled_at, created_at)'))
            ->get(['code', 'channel', 'recipient', 'subject', 'status', 'direction', 'origin', 'scheduled_at', 'sent_at', 'read_at', 'error']);
    }

    private function payments(string $reservationId): Collection
    {
        return DB::table('fin_payments as p')->leftJoin('fin_receivables as r', 'r.id', '=', 'p.receivable_id')
            ->where('p.reservation_id', $reservationId)->orderByDesc('p.paid_on')->orderByDesc('p.created_at')
            ->get(['p.code', 'p.paid_on', 'p.method', 'p.reference', 'p.amount', 'p.currency', 'p.status', 'p.reject_reason', 'r.code as receivable_code', 'r.concept as receivable_concept']);
    }

    private function invoices(string $reservationId): Collection
    {
        return DB::table('fin_invoices')->where('reservation_id', $reservationId)->orderByDesc('issue_date')->orderByDesc('number')
            ->get(['number', 'doc_type', 'issue_date', 'total_amount', 'currency', 'status', 'description']);
    }

    private function operation(string $reservationId): ?array
    {
        $order = DB::table('ops_orders as o')->leftJoin('iam_users as u', 'u.id', '=', 'o.coordinator_id')
            ->where('o.reservation_id', $reservationId)->whereNull('o.deleted_at')->first(['o.id', 'o.code', 'o.status', 'o.date_from', 'o.date_to', 'u.name as coordinator']);

        if ($order === null) {
            return null;
        }

        return [
            'code' => $order->code,
            'status' => $order->status,
            'date_from' => $order->date_from,
            'date_to' => $order->date_to,
            'coordinator' => $order->coordinator,
            'tasks' => DB::table('ops_order_tasks')->where('order_id', $order->id)->whereNull('deleted_at')->orderBy('position')->get(['title', 'done', 'done_at']),
            'assignments' => DB::table('ops_assignments as a')
                ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
                ->where('a.order_id', $order->id)->orderBy('a.service_date')->orderBy('a.service_time')
                ->get(['a.service_date', 'a.service_time', 'a.service_label', 'a.status', 'g.full_name as guide', 'd.full_name as driver', 'v.plate as vehicle', 'v.vehicle_type'])
                ->map(fn (object $item): array => [...(array) $item, 'service_time' => $item->service_time ? substr((string) $item->service_time, 0, 5) : null]),
        ];
    }

    private function changeLog(string $reservationId, array $view): Collection
    {
        return DB::table('booking_changes as c')->leftJoin('iam_users as rq', 'rq.id', '=', 'c.requested_by')->leftJoin('iam_users as dc', 'dc.id', '=', 'c.decided_by')
            ->where('c.reservation_id', $reservationId)->orderByDesc('c.requested_at')
            ->get(['c.type', 'c.description', 'c.extra_pax', 'c.service_date', 'c.delta_amount', 'c.status', 'c.requested_at', 'c.decided_at', 'c.applied_at', 'rq.name as requested_by', 'dc.name as decided_by'])
            ->map(fn (object $change): array => $view['price'] ? (array) $change : array_diff_key((array) $change, ['delta_amount' => true]));
    }

    private function policies(object $row): array
    {
        $snapshot = json_decode((string) $row->policies_snapshot, true);

        if (is_array($snapshot) && $snapshot !== []) {
            return ['source' => 'snapshot', 'items' => $this->snapshotPolicies($snapshot)];
        }

        $items = DB::table('booking_reservation_services as s')->join('catalog_products as p', 'p.id', '=', 's.product_id')
            ->join('catalog_product_policies as pp', 'pp.product_id', '=', 'p.id')
            ->where('s.reservation_id', $row->id)->distinct()
            ->get(['p.name as product', 'pp.cancellation', 'pp.modification', 'pp.no_show', 'pp.refund', 'pp.penalty_tiers'])
            ->map(fn (object $item): array => [...array_diff_key((array) $item, ['penalty_tiers' => true]), 'tiers' => CancellationTiers::resolve($item->penalty_tiers, $item->cancellation)])->values()->all();

        return ['source' => $items === [] ? 'none' : 'product', 'items' => $items];
    }

    private function snapshotPolicies(array $snapshot): array
    {
        $list = array_is_list($snapshot) ? $snapshot : array_map(fn ($value, $key) => is_array($value) ? ['product' => $value['product'] ?? (string) $key, ...$value] : ['product' => (string) $key, 'cancellation' => (string) $value], $snapshot, array_keys($snapshot));

        return array_map(fn (array $item): array => [
            'product' => (string) ($item['product'] ?? $item['name'] ?? 'Reserva'),
            'cancellation' => $item['cancellation'] ?? $item['cancel'] ?? null,
            'modification' => $item['modification'] ?? $item['modify'] ?? null,
            'no_show' => $item['no_show'] ?? $item['noshow'] ?? null,
            'refund' => $item['refund'] ?? null,
            'tiers' => CancellationTiers::resolve($item['penalty_tiers'] ?? null, $item['cancellation'] ?? $item['cancel'] ?? null),
        ], $list);
    }

    private function pgArray(?string $value): array
    {
        if ($value === null || $value === '{}') {
            return [];
        }

        return array_map(fn (string $item): string => trim($item, '"'), str_getcsv(trim($value, '{}')));
    }
}
