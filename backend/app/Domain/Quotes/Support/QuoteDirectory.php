<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Actions\QuoteLifecycle;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class QuoteDirectory
{
    public const OPEN = ['borrador', 'enviada', 'vista', 'negociacion'];

    public function __construct(private readonly TenantContext $context) {}

    public function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }

    public function list(User $viewer): array
    {
        $today = $this->today();
        $rows = $this->rows($viewer)->orderByDesc('q.created_at')->get()->map(fn (object $row) => $this->summary($row, $today, $viewer));
        $open = $rows->filter(fn (array $quote) => in_array($quote['status'], self::OPEN, true));

        return [
            'items' => $rows->values(),
            'can' => ['manage' => $viewer->can('quotes.create')],
            'kpis' => [
                'open' => $open->count(),
                'open_pen' => (int) round($open->sum('total_pen')),
                'expiring' => $open->filter(fn (array $quote) => $quote['days_left'] !== null && $quote['days_left'] <= 3)->count(),
                'approved' => $rows->whereIn('status', ['aprobada', 'convertida'])->count(),
                'conversion' => $this->conversion($rows),
            ],
            'today' => $today,
        ];
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->rows($viewer)->where('q.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $seeMargin = $this->seesMargin($viewer);
        $current = DB::table('quote_versions')->where('id', $row->current_version_id)->first();
        $versions = DB::table('quote_versions as v')->join('iam_users as u', 'u.id', '=', 'v.author_id')->where('v.quote_id', $row->id)->orderByDesc('v.version_no')
            ->get(['v.id', 'v.version_no', 'v.status', 'v.issued_on', 'v.discount_pct', 'v.tax_pct', 'v.notes', 'v.snapshot_label', 'v.sale_total', 'v.discount_total', 'v.net_total', 'v.tax_total', 'v.grand_total', 'v.cost_total', 'v.profit_total', 'v.margin_pct', 'u.name as author']);
        $items = DB::table('quote_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->whereIn('i.quote_version_id', $versions->pluck('id'))->orderBy('i.line_no')
            ->get(['i.quote_version_id', 'i.line_no', 'i.service_date', 'i.qty', 'i.pax', 'i.segment', 'i.unit_cost', 'i.unit_price', 'i.cost_total', 'i.sale_total', 'p.code as product_code', 'p.name as product_name'])
            ->groupBy('quote_version_id');

        return [
            ...$this->summary($row, $this->today(), $viewer),
            'opportunity' => $row->opportunity_code ? ['code' => $row->opportunity_code, 'title' => $row->opportunity_title] : null,
            'reservation' => $row->reservation_code ? ['code' => $row->reservation_code] : null,
            'approved_at' => $row->approved_at,
            'approved_by_name' => $row->approved_by_name,
            'rejected_reason' => $row->rejected_reason,
            'viewed_at' => $row->viewed_at,
            'see_margin' => $seeMargin,
            'lock_version' => (int) $row->lock_version,
            'internal' => $current ? app(QuoteLifecycle::class)->internalState($current) : null,
            'can' => [
                'edit' => $viewer->can('quotes.create'),
                'send' => $viewer->can('quotes.send'),
                'approve_internal' => $viewer->can('quotes.approve_internal'),
                'register_approval' => $viewer->can('reservations.create'),
            ],
            'contact' => DB::table('crm_clients')->where('id', $row->client_id)->first(['email', 'phone']),
            'versions' => $versions->map(fn (object $version): array => $this->version($version, collect($items->get($version->id, [])), $seeMargin))->values(),
            'history' => DB::table('audit_events')->where('entity', 'Cotización')->where('entity_id', $row->code)->orderByDesc('occurred_at')->limit(20)->get(['action', 'before_value', 'after_value', 'occurred_at']),
        ];
    }

    private function version(object $version, Collection $items, bool $seeMargin): array
    {
        return [
            'number' => (int) $version->version_no,
            'status' => $version->status,
            'issued_on' => $version->issued_on,
            'author' => $version->author,
            'notes' => $version->notes,
            'snapshot' => $version->snapshot_label,
            'discount_pct' => (float) $version->discount_pct,
            'tax_pct' => (float) $version->tax_pct,
            'totals' => [
                'sale' => (float) $version->sale_total,
                'discount' => (float) $version->discount_total,
                'net' => (float) $version->net_total,
                'tax' => (float) $version->tax_total,
                'grand' => (float) $version->grand_total,
                'cost' => $seeMargin ? (float) $version->cost_total : null,
                'profit' => $seeMargin ? (float) $version->profit_total : null,
                'margin_pct' => $seeMargin ? (float) $version->margin_pct : null,
            ],
            'items' => $items->map(fn (object $item): array => $this->item($item, $seeMargin))->values(),
        ];
    }

    private function item(object $item, bool $seeMargin): array
    {
        $sale = (float) $item->sale_total;

        return [
            'line' => (int) $item->line_no,
            'product' => ['code' => $item->product_code, 'name' => $item->product_name],
            'date' => $item->service_date,
            'qty' => (int) $item->qty,
            'pax' => (int) $item->pax,
            'segment' => $item->segment,
            'unit_price' => (float) $item->unit_price,
            'total' => $sale,
            'unit_cost' => $seeMargin ? (float) $item->unit_cost : null,
            'margin_pct' => $seeMargin && $sale > 0 ? round(($sale - (float) $item->cost_total) / $sale * 100, 1) : null,
        ];
    }

    private function rows(User $viewer): Builder
    {
        $query = DB::table('quote_quotes as q')
            ->join('crm_clients as c', 'c.id', '=', 'q.client_id')
            ->join('iam_users as u', 'u.id', '=', 'q.owner_id')
            ->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')
            ->leftJoin('crm_opportunities as o', 'o.id', '=', 'q.opportunity_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'q.reservation_id')
            ->whereNull('q.deleted_at')
            ->select(['q.*', 'c.code as client_code', 'c.name as client_name', 'u.name as owner_name', 'u.avatar_color as owner_color', 'v.grand_total', 'v.margin_pct as version_margin', 'o.code as opportunity_code', 'o.title as opportunity_title', 'r.code as reservation_code']);

        return Portfolio::scope($query, $viewer, 'q.owner_id');
    }

    private function summary(object $row, string $today, User $viewer): array
    {
        $total = (float) ($row->grand_total ?? 0);
        $expired = in_array($row->status, self::OPEN, true) && $row->valid_until < $today;
        $status = $expired ? 'vencida' : $row->status;

        return [
            'code' => $row->code,
            'title' => $row->title,
            'status' => $status,
            'client' => ['code' => $row->client_code, 'name' => $row->client_name],
            'owner' => ['name' => $row->owner_name, 'color' => $row->owner_color],
            'version' => (int) $row->current_version_no,
            'currency' => $row->currency,
            'total' => $total,
            'total_pen' => round($total * (float) $row->fx_rate, 2),
            'margin_pct' => $this->seesMargin($viewer) && $row->version_margin !== null ? (float) $row->version_margin : null,
            'travel_from' => $row->travel_from,
            'travel_to' => $row->travel_to,
            'valid_until' => $row->valid_until,
            'days_left' => in_array($status, self::OPEN, true) ? (int) Carbon::parse($today)->diffInDays(Carbon::parse($row->valid_until), false) : null,
            'pax' => ['adt' => (int) $row->pax_adt, 'chd' => (int) $row->pax_chd, 'inf' => (int) $row->pax_inf],
            'created_at' => Carbon::parse($row->created_at)->toDateString(),
        ];
    }

    private function conversion(Collection $rows): ?int
    {
        $closed = $rows->whereIn('status', ['aprobada', 'convertida', 'rechazada', 'vencida']);

        return $closed->isEmpty() ? null : (int) round($rows->whereIn('status', ['aprobada', 'convertida'])->count() / $closed->count() * 100);
    }

    private function seesMargin(User $viewer): bool
    {
        return $viewer->can('finance.profitability') || $viewer->can('catalog.products.view_profitability');
    }
}
