<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class BillingMetrics
{
    public const BILLABLE = ['active', 'past_due', 'cancel_scheduled'];

    private const CONNECTION = 'pgsql_platform';

    private const EVENT_ACTIONS = ['suspender', 'reactivar', 'cambio_plan', 'extender_trial', 'convertir_trial'];

    public function snapshot(?string $connection = null): array
    {
        $db = $this->db($connection);
        $month = Carbon::today('America/Lima')->startOfMonth();
        $rows = $this->subscriptions($db)->whereIn('status', self::BILLABLE);
        $mrr = round((float) $rows->sum('mrr'), 2);
        $active = $rows->count();
        $created = $db->table('tenants')->where('created_at', '>=', $month)->get(['status']);

        return [
            'day' => Carbon::today('America/Lima')->toDateString(),
            'mrr' => $mrr,
            'arr' => round($mrr * 12, 2),
            'arpa' => $active > 0 ? round($mrr / $active, 2) : 0,
            'active_tenants' => $active,
            'new_tenants' => $created->count(),
            'new_paying' => $created->where('status', 'activo')->count(),
            'churned_tenants' => $db->table('subscriptions')->where('status', 'canceled')->where('updated_at', '>=', $month)->count(),
            'by_plan' => $rows->groupBy('plan')->map(fn (Collection $items, string $plan) => ['plan' => $plan, 'tenants' => $items->count(), 'mrr' => round((float) $items->sum('mrr'), 2)])->values()->all(),
        ];
    }

    public function storeSnapshot(array $snapshot, ?string $connection = null): void
    {
        $this->db($connection)->table('platform_metrics_daily')->updateOrInsert(['day' => $snapshot['day']], [
            'mrr' => $snapshot['mrr'],
            'arr' => $snapshot['arr'],
            'arpa' => $snapshot['arpa'],
            'active_tenants' => $snapshot['active_tenants'],
            'new_tenants' => $snapshot['new_tenants'],
            'churned_tenants' => $snapshot['churned_tenants'],
            'breakdown' => json_encode(['by_plan' => $snapshot['by_plan'], 'suspended' => $this->db($connection)->table('tenants')->where('status', 'suspendido')->where('suspended_at', '>=', Carbon::today('America/Lima')->startOfMonth())->count()], JSON_UNESCAPED_UNICODE),
        ]);
    }

    public function overview(): array
    {
        $live = $this->snapshot();
        $series = $this->series($live);
        $previous = $series->slice(-2, 1)->first();
        $plans = $this->db()->table('plans')->orderBy('rank')->get(['code', 'name', 'rank', 'price_month']);
        $byPlan = collect($live['by_plan'])->keyBy('plan');

        return [
            'currency' => 'PEN',
            'mrr' => $live['mrr'],
            'arr' => $live['arr'],
            'arpa' => $live['arpa'],
            'mrr_change' => $previous && $previous['mrr'] > 0 ? round(($live['mrr'] - $previous['mrr']) / $previous['mrr'] * 100, 1) : null,
            'paying_tenants' => $live['active_tenants'],
            'churn' => $this->churn($live),
            'failed' => $this->failed(),
            'series' => $series->values(),
            'by_plan' => $plans->map(fn (object $plan) => [
                'code' => $plan->code,
                'name' => $plan->name,
                'rank' => (int) $plan->rank,
                'tenants' => (int) ($byPlan[$plan->name]['tenants'] ?? 0),
                'mrr' => (float) ($byPlan[$plan->name]['mrr'] ?? 0),
                'share' => $live['mrr'] > 0 ? round((float) ($byPlan[$plan->name]['mrr'] ?? 0) / $live['mrr'] * 100, 1) : 0,
            ])->values(),
            'events' => $this->events(),
        ];
    }

    public function series(?array $live = null): Collection
    {
        $live ??= $this->snapshot();
        $today = Carbon::today('America/Lima');
        $rows = $this->db()->table('platform_metrics_daily')->where('day', '>=', $today->copy()->startOfMonth()->subMonthsNoOverflow(5))->where('day', '<', $today->copy()->startOfMonth())->orderBy('day')->get();
        $months = $rows->groupBy(fn (object $row) => substr((string) $row->day, 0, 7))->map(fn (Collection $items) => $items->last());

        $past = $months->map(function (object $row): array {
            $breakdown = (array) json_decode((string) $row->breakdown, true);

            return [
                'month' => substr((string) $row->day, 0, 7),
                'mrr' => (float) $row->mrr,
                'active' => (int) $row->active_tenants,
                'new' => (int) $row->new_tenants,
                'churned' => (int) $row->churned_tenants,
                'suspended' => (int) ($breakdown['suspended'] ?? 0),
            ];
        });

        return $past->values()->push([
            'month' => $today->format('Y-m'),
            'mrr' => $live['mrr'],
            'active' => $live['active_tenants'],
            'new' => $live['new_tenants'],
            'churned' => $live['churned_tenants'],
            'suspended' => $this->db()->table('tenants')->where('status', 'suspendido')->where('suspended_at', '>=', $today->copy()->startOfMonth())->count(),
        ]);
    }

    public function failed(): array
    {
        $rows = $this->db()->table('platform_invoices')->whereIn('status', ['failed', 'uncollectible'])->get(['tenant_id', 'total', 'status']);

        return [
            'count' => $rows->count(),
            'amount' => round((float) $rows->sum('total'), 2),
            'tenants' => $rows->pluck('tenant_id')->unique()->count(),
            'in_dunning' => $rows->where('status', 'failed')->count(),
        ];
    }

    private function churn(array $live): array
    {
        $since = Carbon::today('America/Lima')->subDays(90);
        $base = $this->db()->table('platform_metrics_daily')->where('day', '<=', $since)->orderByDesc('day')->first();
        $window = $this->db()->table('platform_metrics_daily')->where('day', '>', $since)->get();
        $lost = $window->flatMap(fn (object $row) => (array) (json_decode((string) $row->breakdown, true)['cancellations'] ?? []));
        $churned = (int) $window->sum('churned_tenants') + $live['churned_tenants'];
        $lostMrr = round((float) $lost->sum('mrr'), 2);

        return [
            'churned' => $churned,
            'lost_mrr' => $lostMrr,
            'logo_pct' => $base && (int) $base->active_tenants > 0 ? round($churned / (int) $base->active_tenants * 100, 1) : null,
            'revenue_pct' => $base && (float) $base->mrr > 0 ? round($lostMrr / (float) $base->mrr * 100, 1) : null,
            'cancellations' => $lost->sortByDesc('date')->values(),
        ];
    }

    public function events(int $limit = 12): Collection
    {
        $db = $this->db();
        $since = Carbon::today('America/Lima')->subDays(150);
        $names = $db->table('tenants')->pluck('commercial_name', 'code');
        $plans = $db->table('plans')->pluck('name', 'id');

        $created = $db->table('tenants')->where('created_at', '>=', $since)->get(['code', 'commercial_name', 'status', 'plan_id', 'created_at'])
            ->map(fn (object $tenant) => ['at' => Carbon::parse($tenant->created_at)->toIso8601String(), 'kind' => 'alta', 'tenant' => $tenant->commercial_name, 'code' => $tenant->code, 'detail' => ($plans[$tenant->plan_id] ?? 'Sin plan').($tenant->status === 'prueba' ? ' · en prueba' : '')]);

        $cancelled = $db->table('platform_metrics_daily')->where('day', '>=', $since)->get(['breakdown'])
            ->flatMap(fn (object $row) => (array) (json_decode((string) $row->breakdown, true)['cancellations'] ?? []))
            ->map(fn (array $row) => ['at' => Carbon::parse($row['date'], 'America/Lima')->setTime(18, 0)->toIso8601String(), 'kind' => 'baja', 'tenant' => $row['name'], 'code' => null, 'detail' => "{$row['plan']} · {$row['reason']}", 'amount' => -1 * (float) $row['mrr']]);

        $audited = $db->table('audit_events')->whereNull('tenant_id')->where('entity', 'Tenant')->whereIn('action', self::EVENT_ACTIONS)->where('occurred_at', '>=', $since)->get(['entity_id', 'action', 'before_value', 'after_value', 'occurred_at'])
            ->map(fn (object $event) => ['at' => Carbon::parse($event->occurred_at)->toIso8601String(), 'kind' => $event->action, 'tenant' => $names[$event->entity_id] ?? $event->entity_id, 'code' => $event->entity_id, 'detail' => trim(($event->before_value ? "{$event->before_value} → " : '').(string) $event->after_value)]);

        $declined = $db->table('payment_attempts as a')->join('platform_invoices as i', 'i.id', '=', 'a.invoice_id')->join('tenants as t', 't.id', '=', 'i.tenant_id')
            ->where('a.result', '<>', 'succeeded')->where('a.created_at', '>=', $since)
            ->get(['a.created_at', 'a.message', 'i.series', 'i.number', 'i.total', 't.code', 't.commercial_name'])
            ->map(fn (object $row) => ['at' => Carbon::parse($row->created_at)->toIso8601String(), 'kind' => 'cobro_rechazado', 'tenant' => $row->commercial_name, 'code' => $row->code, 'detail' => sprintf('%s-%08d · %s', $row->series, $row->number, $row->message), 'amount' => (float) $row->total]);

        return $created->concat($cancelled)->concat($audited)->concat($declined)->sortByDesc('at')->take($limit)->values();
    }

    public function subscriptions(?ConnectionInterface $db = null): Collection
    {
        $db ??= $this->db();
        $addons = $db->table('subscription_items')->whereNull('ends_at')->selectRaw('subscription_id, sum(unit_price * quantity) as total')->groupBy('subscription_id')->pluck('total', 'subscription_id');

        return $db->table('subscriptions as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->join('plans as p', 'p.id', '=', 's.plan_id')
            ->where('s.status', '<>', 'canceled')
            ->get(['s.id', 's.status', 's.cycle', 't.mrr', 'p.name as plan', 'p.price_month', 'p.price_year'])
            ->map(function (object $row) use ($addons): object {
                $base = (float) $row->mrr > 0 ? (float) $row->mrr : ($row->cycle === 'annual' ? (float) $row->price_year / 12 : (float) $row->price_month);
                $row->mrr = round($base + (float) ($addons[$row->id] ?? 0), 2);

                return $row;
            });
    }

    private function db(?string $connection = null): ConnectionInterface
    {
        return DB::connection($connection ?? self::CONNECTION);
    }
}
