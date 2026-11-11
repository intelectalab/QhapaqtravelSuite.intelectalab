<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Actions\QuoteLifecycle;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QuoteDirectory
{
    public const OPEN = ['borrador', 'enviada', 'vista', 'negociacion'];

    private const SORTS = [
        'created_at' => 'q.created_at',
        'code' => 'q.code',
        'valid_until' => 'q.valid_until',
        'travel_from' => 'q.travel_from',
        'total' => 'v.grand_total',
    ];

    public function __construct(private readonly TenantContext $context) {}

    public function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }

    public function list(User $viewer, Request $request): array
    {
        $today = $this->today();
        $filters = CursorPage::filters($request);
        $scoped = $this->byOwner($this->rows($viewer), $viewer, $filters['owner'] ?? null);
        $query = $this->filtered(clone $scoped, $filters, $today);

        return CursorPage::respond($request, $query, self::SORTS, '-created_at,-code', fn (object $row): array => $this->summary($row, $today, $viewer), [
            'kpis' => $this->kpis($scoped, $today, $viewer),
            'can' => ['manage' => $viewer->can('quotes.create')],
            'today' => $today,
        ]);
    }

    private function kpis(Builder $scoped, string $today, User $viewer): array
    {
        $rows = $scoped->get()->map(fn (object $row): array => $this->summary($row, $today, $viewer));
        $open = $rows->filter(fn (array $quote): bool => in_array($quote['status'], self::OPEN, true));
        $openPen = $open->reduce(fn (BigDecimal $sum, array $quote): BigDecimal => $sum->plus($quote['total_pen']), BigDecimal::zero());

        return [
            'open' => $open->count(),
            'open_pen' => (string) $openPen->toScale(0, RoundingMode::HALF_UP),
            'expiring' => $open->filter(fn (array $quote): bool => $quote['days_left'] !== null && $quote['days_left'] <= 3)->count(),
            'approved' => $rows->whereIn('status', ['aprobada', 'convertida'])->count(),
            'conversion' => $this->conversion($rows),
            'total' => $rows->count(),
        ];
    }

    private function byOwner(Builder $query, User $viewer, ?string $owner): Builder
    {
        if ($owner === null || Portfolio::ownOnly($viewer)) {
            return $query;
        }

        $ownerId = $owner === 'me' ? (string) $viewer->getKey() : $owner;

        return Str::isUuid($ownerId) ? $query->where('q.owner_id', $ownerId) : $query->whereRaw('false');
    }

    private function filtered(Builder $query, array $filters, string $today): Builder
    {
        if (isset($filters['status'])) {
            $statuses = array_values(array_filter(array_map('trim', explode(',', $filters['status']))));
            $query->where(function (Builder $where) use ($statuses, $today): void {
                foreach ($statuses as $status) {
                    $where->orWhere(fn (Builder $one): Builder => $this->status($one, $status, $today));
                }
            });
        }

        if (isset($filters['internal_approval'])) {
            $this->internalApproval($query, $filters['internal_approval']);
        }

        if (isset($filters['q'])) {
            $term = '%'.mb_strtolower($filters['q']).'%';
            $query->where(fn (Builder $where): Builder => $where->whereRaw('lower(q.code) like ?', [$term])
                ->orWhereRaw('lower(q.title) like ?', [$term])
                ->orWhereRaw('lower(c.name) like ?', [$term]));
        }

        return $query;
    }

    private function status(Builder $query, string $status, string $today): Builder
    {
        if ($status === 'vencida') {
            return $query->where('q.status', 'vencida')
                ->orWhere(fn (Builder $expired): Builder => $expired->whereIn('q.status', self::OPEN)->where('q.valid_until', '<', $today));
        }

        $query->where('q.status', $status);

        return in_array($status, self::OPEN, true) ? $query->where('q.valid_until', '>=', $today) : $query;
    }

    private function internalApproval(Builder $query, string $state): void
    {
        $last = '(select a.status from quote_internal_approvals a where a.quote_version_id = v.id order by a.created_at desc limit 1)';
        $required = '(v.discount_pct > ? or v.margin_pct < ?)';
        $policy = QuoteLifecycle::currentLimits();
        $limits = [$policy['discount_limit'], $policy['margin_floor']];

        match ($state) {
            'pend' => $query->whereRaw("{$last} = 'pendiente'"),
            'ok' => $query->whereRaw("{$last} = 'aprobada'"),
            'req' => $query->whereRaw("{$required} and coalesce({$last}, '') not in ('pendiente', 'aprobada')", $limits),
            default => throw ApiException::unprocessable('FILTER_INVALID', 'filter[internal_approval] admite pend, req u ok.'),
        };
    }

    public function kpisFor(User $viewer, Request $request): array
    {
        $filters = CursorPage::filters($request);

        return $this->kpis($this->byOwner($this->rows($viewer), $viewer, $filters['owner'] ?? null), $this->today(), $viewer);
    }

    public function versions(User $viewer, string $code): ?array
    {
        $quote = $this->find($viewer, $code);

        return $quote === null ? null : ['code' => $quote['code'], 'current' => $quote['version'], 'see_margin' => $quote['see_margin'], 'versions' => collect($quote['versions'])->values()->all()];
    }

    public function versionOf(User $viewer, string $code, int $number): ?array
    {
        $versions = $this->versions($viewer, $code);

        return $versions === null ? null : collect($versions['versions'])->firstWhere('number', $number);
    }

    public function compare(User $viewer, string $code, int $a, int $b): ?array
    {
        $left = $this->versionOf($viewer, $code, $a);
        $right = $this->versionOf($viewer, $code, $b);

        if ($left === null || $right === null) {
            return null;
        }

        $keyed = function (array $version): array {
            $seen = [];
            $rows = [];
            foreach ($version['items'] as $item) {
                $base = $item['product']['code'].'|'.$item['segment'];
                $seen[$base] = ($seen[$base] ?? 0) + 1;
                $rows[$base.'#'.$seen[$base]] = $item;
            }

            return $rows;
        };
        $before = $keyed($left);
        $after = $keyed($right);
        $lines = [];

        foreach (array_unique([...array_keys($before), ...array_keys($after)]) as $key) {
            $old = $before[$key] ?? null;
            $new = $after[$key] ?? null;
            $changes = $old && $new ? array_values(array_filter(['date', 'qty', 'pax', 'unit_price', 'total'], fn (string $field): bool => (string) $old[$field] !== (string) $new[$field])) : [];
            $lines[] = [
                'key' => $key,
                'product' => ($new ?? $old)['product'],
                'segment' => ($new ?? $old)['segment'],
                'change' => $old === null ? 'agregada' : ($new === null ? 'quitada' : ($changes === [] ? 'igual' : 'modificada')),
                'fields' => $changes,
                'before' => $old,
                'after' => $new,
            ];
        }

        $delta = fn (string $field): ?string => $left['totals'][$field] === null || $right['totals'][$field] === null
            ? null
            : (string) BigDecimal::of((string) $right['totals'][$field])->minus((string) $left['totals'][$field])->toScale(2, RoundingMode::HALF_UP);

        return [
            'code' => $code,
            'a' => ['number' => $left['number'], 'status' => $left['status'], 'totals' => $left['totals'], 'discount_pct' => $left['discount_pct']],
            'b' => ['number' => $right['number'], 'status' => $right['status'], 'totals' => $right['totals'], 'discount_pct' => $right['discount_pct']],
            'lines' => $lines,
            'summary' => [
                'added' => count(array_filter($lines, fn (array $line): bool => $line['change'] === 'agregada')),
                'removed' => count(array_filter($lines, fn (array $line): bool => $line['change'] === 'quitada')),
                'changed' => count(array_filter($lines, fn (array $line): bool => $line['change'] === 'modificada')),
                'grand_delta' => $delta('grand'),
                'margin_delta' => $delta('margin_pct'),
            ],
        ];
    }

    public function activity(User $viewer, Request $request, string $code): ?array
    {
        if ($this->rows($viewer)->where('q.code', $code)->doesntExist()) {
            return null;
        }

        $query = DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->where('e.entity', 'Cotización')->where('e.entity_id', $code)
            ->select(['e.id', 'e.code', 'e.action', 'e.before_value', 'e.after_value', 'e.actor_type', 'e.occurred_at', 'u.name as actor_name']);

        return CursorPage::respond($request, $query, ['occurred_at' => 'e.occurred_at'], '-occurred_at', fn (object $event): array => [
            'id' => $event->id,
            'code' => $event->code,
            'action' => $event->action,
            'before' => $event->before_value,
            'after' => $event->after_value,
            'actor' => $event->actor_name ?? ($event->actor_type === 'system' ? 'Sistema' : null),
            'at' => $event->occurred_at,
        ]);
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->rows($viewer)->where('q.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $seeMargin = $this->seesMargin($viewer, (string) $row->owner_id);
        $current = DB::table('quote_versions')->where('id', $row->current_version_id)->first();
        $versions = DB::table('quote_versions as v')->join('iam_users as u', 'u.id', '=', 'v.author_id')->where('v.quote_id', $row->id)->orderByDesc('v.version_no')
            ->get(['v.id', 'v.version_no', 'v.status', 'v.issued_on', 'v.discount_pct', 'v.tax_pct', 'v.notes', 'v.snapshot_label', 'v.sale_total', 'v.discount_total', 'v.net_total', 'v.tax_total', 'v.grand_total', 'v.cost_total', 'v.profit_total', 'v.margin_pct', 'u.name as author']);
        $items = DB::table('quote_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->whereIn('i.quote_version_id', $versions->pluck('id'))->orderBy('i.line_no')
            ->get(['i.quote_version_id', 'i.line_no', 'i.service_date', 'i.qty', 'i.pax', 'i.segment', 'i.unit_cost', 'i.unit_price', 'i.cost_total', 'i.sale_total', 'p.code as product_code', 'p.name as product_name'])
            ->groupBy('quote_version_id');
        $sections = app(QuoteSections::class);
        $extras = $sections->versionExtras($versions);
        $seasons = DB::table('quote_items')->whereIn('quote_version_id', $versions->pluck('id'))->get(['quote_version_id', 'line_no', 'season_factor'])
            ->keyBy(fn (object $item): string => $item->quote_version_id.'#'.$item->line_no);

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
                'reassign' => $viewer->can('crm.records.reassign'),
                'duplicate' => $viewer->can('quotes.create'),
                'edit' => $viewer->can('quotes.create'),
                'send' => $viewer->can('quotes.send'),
                'approve_internal' => $viewer->can('quotes.approve_internal'),
                'register_approval' => $viewer->can('reservations.create'),
            ],
            'contact' => DB::table('crm_clients')->where('id', $row->client_id)->first(['email', 'phone']),
            'versions' => $versions->map(fn (object $version): array => [
                ...$this->version($version, collect($items->get($version->id, [])), $seeMargin),
                'conditions' => $extras[$version->id]->conditions ?? null,
                'markup_pct' => $seeMargin && isset($extras[$version->id]) ? (string) $extras[$version->id]->markup_pct : null,
                'fx_rate' => isset($extras[$version->id]) ? (string) $extras[$version->id]->fx_rate : null,
                'frozen_at' => $extras[$version->id]->frozen_at ?? null,
                'internal_status' => $extras[$version->id]->internal_status ?? null,
                'item_count' => collect($items->get($version->id, []))->count(),
                'seasons' => collect($items->get($version->id, []))->mapWithKeys(fn (object $item): array => [(int) $item->line_no => isset($seasons[$version->id.'#'.$item->line_no]) && $seasons[$version->id.'#'.$item->line_no]->season_factor !== null ? (string) $seasons[$version->id.'#'.$item->line_no]->season_factor : null])->all(),
            ])->values(),
            'history' => DB::table('audit_events')->where('entity', 'Cotización')->where('entity_id', $row->code)->orderByDesc('occurred_at')->limit(20)->get(['action', 'before_value', 'after_value', 'occurred_at']),
            ...$sections->extras($row),
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
            'discount_pct' => (string) BigDecimal::of((string) $version->discount_pct)->strippedOfTrailingZeros(),
            'tax_pct' => (string) BigDecimal::of((string) $version->tax_pct)->strippedOfTrailingZeros(),
            'totals' => [
                'sale' => Decimal::toApi((string) $version->sale_total),
                'discount' => Decimal::toApi((string) $version->discount_total),
                'net' => Decimal::toApi((string) $version->net_total),
                'tax' => Decimal::toApi((string) $version->tax_total),
                'grand' => Decimal::toApi((string) $version->grand_total),
                'cost' => $seeMargin ? Decimal::toApi((string) $version->cost_total) : null,
                'profit' => $seeMargin ? Decimal::toApi((string) $version->profit_total) : null,
                'margin_pct' => $seeMargin ? (string) $version->margin_pct : null,
            ],
            'items' => $items->map(fn (object $item): array => $this->item($item, $seeMargin))->values(),
        ];
    }

    private function item(object $item, bool $seeMargin): array
    {
        return [
            'line' => (int) $item->line_no,
            'product' => ['code' => $item->product_code, 'name' => $item->product_name],
            'date' => $item->service_date,
            'qty' => (int) $item->qty,
            'pax' => (int) $item->pax,
            'segment' => $item->segment,
            'unit_price' => Decimal::toApi((string) $item->unit_price),
            'total' => Decimal::toApi((string) $item->sale_total),
            'unit_cost' => $seeMargin ? Decimal::toApi((string) $item->unit_cost) : null,
            'margin_pct' => $seeMargin ? QuotePricing::lineMargin((string) $item->sale_total, (string) $item->cost_total) : null,
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
        $total = Decimal::round2((string) ($row->grand_total ?? '0'));
        $expired = in_array($row->status, self::OPEN, true) && $row->valid_until < $today;
        $status = $expired ? 'vencida' : $row->status;

        return [
            'id' => $row->id,
            'code' => $row->code,
            'client_id' => $row->client_id,
            'opportunity_id' => $row->opportunity_id,
            'owner_id' => $row->owner_id,
            'title' => $row->title,
            'status' => $status,
            'client' => ['code' => $row->client_code, 'name' => $row->client_name],
            'owner' => ['name' => $row->owner_name, 'color' => $row->owner_color],
            'version' => (int) $row->current_version_no,
            'current_version_no' => (int) $row->current_version_no,
            'current_version_id' => $row->current_version_id,
            'reservation_id' => $row->reservation_id,
            'currency' => $row->currency,
            'fx_rate' => (string) $row->fx_rate,
            'total' => (string) $total,
            'total_pen' => (string) Decimal::round2($total->multipliedBy((string) $row->fx_rate)),
            'margin_pct' => $this->seesMargin($viewer, (string) $row->owner_id) && $row->version_margin !== null ? (string) $row->version_margin : null,
            'lock_version' => (int) $row->lock_version,
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

    private function seesMargin(User $viewer, ?string $ownerId = null): bool
    {
        return $viewer->can('finance.profitability')
            || $viewer->can('catalog.products.view_profitability')
            || $viewer->can('quotes.approve_internal')
            || Portfolio::owns($viewer, $ownerId);
    }
}
