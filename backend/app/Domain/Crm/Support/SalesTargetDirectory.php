<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class SalesTargetDirectory
{
    public const COUNTED = ['confirmada', 'en_operacion', 'completada', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'incidencia', 'reprogramada', 'pendiente_disponibilidad'];

    public const SCOPES = ['asesor' => 'Asesor', 'sede' => 'Sede', 'equipo' => 'Equipo'];

    private array $members = [];

    private ?float $usd = null;

    public function __construct(private readonly TenantContext $context, private readonly Advisors $advisors) {}

    public function overview(User $viewer): array
    {
        $manage = $viewer->can('crm.targets.manage');
        $today = Carbon::now($this->context->timezone())->startOfDay();
        $policy = $this->policy();
        $rows = DB::table('crm_sales_targets')
            ->when(! $manage, fn (Builder $query) => $query->where('status', '<>', 'borrador'))
            ->orderByDesc('period_from')->orderBy('scope_type')->orderBy('code')
            ->get();
        $names = $this->scopeNames();
        $targets = $rows->map(fn (object $row): array => $this->present($row, $names, $policy, $today));

        if (! $manage) {
            $mine = $targets->filter(fn (array $target): bool => $target['scope_type'] === 'asesor' && $target['scope']['id'] === $viewer->getKey());
            $ranking = $this->ranking($targets, false, $viewer);
            $targets = $mine;
        } else {
            $ranking = $this->ranking($targets, true, $viewer);
        }

        $periods = $targets->pluck('period_key')->unique()->sortDesc()->values();
        $current = TargetPeriod::current('mes', $today);

        return [
            'today' => $today->toDateString(),
            'current_period' => $periods->contains($current) ? $current : $periods->first(),
            'periods' => $periods->map(fn (string $key): array => ['value' => $key, 'label' => TargetPeriod::label($key)])->values(),
            'targets' => $targets->values(),
            'ranking' => $ranking,
            'policy' => $policy,
            'options' => $manage ? [
                'advisors' => $this->advisors->all(['manager', 'sales'])->map(fn (array $user): array => ['value' => $user['id'], 'label' => $user['name']])->values(),
                'sedes' => DB::table('iam_sedes')->orderBy('code')->get(['id', 'name'])->map(fn (object $row): array => ['value' => $row->id, 'label' => $row->name])->values(),
                'teams' => DB::table('crm_sales_teams')->orderBy('code')->get(['id', 'name'])->map(fn (object $row): array => ['value' => $row->id, 'label' => $row->name])->values(),
                'periods' => $this->openPeriods($today),
            ] : null,
            'can' => ['manage' => $manage, 'reduce_late' => $viewer->can('admin.settings.manage')],
        ];
    }

    public function detail(string $code, User $viewer): array
    {
        $manage = $viewer->can('crm.targets.manage');
        $row = DB::table('crm_sales_targets')->where('code', $code)->first();

        if ($row === null || (! $manage && ($row->status === 'borrador' || $row->scope_type !== 'asesor' || $row->scope_id !== $viewer->getKey()))) {
            throw ApiException::notFound('La meta no existe o no está a tu alcance.');
        }

        $today = Carbon::now($this->context->timezone())->startOfDay();
        $policy = $this->policy();
        $names = $this->scopeNames();
        $target = $this->present($row, $names, $policy, $today);
        $history = DB::table('crm_sales_targets')->where('scope_type', $row->scope_type)->where('scope_id', $row->scope_id)->where('id', '<>', $row->id)
            ->when(! $manage, fn (Builder $query) => $query->where('status', '<>', 'borrador'))
            ->orderByDesc('period_from')->limit(12)->get()
            ->map(fn (object $other): array => $this->present($other, $names, $policy, $today))
            ->map(fn (array $other): array => [...$other, 'reservations' => [], 'pipeline' => []])
            ->values();

        $commission = DB::table('fin_commissions')->where('sales_target_id', $row->id)->whereNull('deleted_at')->first(['code', 'status', 'amount', 'currency']);

        return [
            'target' => $target,
            'commission' => $commission === null ? null : ['code' => $commission->code, 'status' => $commission->status, 'amount' => (float) $commission->amount, 'currency' => $commission->currency, 'can_open' => $viewer->can('finance.commissions')],
            'breakdown' => $this->breakdown($row, $target, $names, $today),
            'history' => $history,
            'adjustments' => DB::table('crm_sales_target_adjustments')->where('target_id', $row->id)->orderByDesc('occurred_at')->get()
                ->map(fn (object $entry): array => [
                    'action' => $entry->action,
                    'before' => $entry->before ? json_decode((string) $entry->before, true) : null,
                    'after' => $entry->after ? json_decode((string) $entry->after, true) : null,
                    'reason' => $entry->reason,
                    'by' => $names['asesor'][$entry->actor_id] ?? 'Sistema',
                    'at' => $entry->occurred_at,
                ])->values(),
            'policy' => $policy,
            'can' => ['manage' => $manage, 'reduce_late' => $viewer->can('admin.settings.manage')],
        ];
    }

    public function progress(object $row, Carbon $today): array
    {
        $owners = $this->owners($row);
        $reservations = DB::table('booking_reservations as r')->whereNull('r.deleted_at')->whereIn('r.status', self::COUNTED)
            ->where('r.created_at', '>=', Carbon::parse($row->period_from, $this->context->timezone())->startOfDay()->utc())
            ->where('r.created_at', '<=', Carbon::parse($row->period_to, $this->context->timezone())->endOfDay()->utc())
            ->when($row->scope_type === 'sede', fn (Builder $query) => $query->where('r.sede_id', $row->scope_id), fn (Builder $query) => $query->whereIn('r.owner_id', $owners))
            ->get(['r.id', 'r.code', 'r.title', 'r.total_amount', 'r.currency', 'r.fx_rate', 'r.created_at']);
        $costs = DB::table('booking_reservation_services')->whereIn('reservation_id', $reservations->pluck('id'))->where('status', '<>', 'cancelado')
            ->selectRaw('reservation_id, sum(cost_amount * coalesce(fx_rate, 1)) as cost')->groupBy('reservation_id')->pluck('cost', 'reservation_id');
        $sales = $reservations->sum(fn (object $item): float => (float) $item->total_amount * (float) $item->fx_rate);
        $cost = $reservations->sum(fn (object $item): float => (float) ($costs[$item->id] ?? 0));
        $opportunities = DB::table('crm_opportunities as o')->whereNull('o.deleted_at')
            ->when($row->scope_type === 'sede', fn (Builder $query) => $query->join('iam_users as u', 'u.id', '=', 'o.owner_id')->where('u.sede_id', $row->scope_id), fn (Builder $query) => $query->whereIn('o.owner_id', $owners));
        $closed = (clone $opportunities)->whereIn('o.stage', ['ganada', 'perdida'])->whereBetween('o.closed_at', [$row->period_from, $row->period_to])->pluck('o.stage');
        $won = $closed->filter(fn (string $stage): bool => $stage === 'ganada')->count();
        $pipeline = (clone $opportunities)->whereNotIn('o.stage', ['ganada', 'perdida'])
            ->whereBetween('o.expected_close_date', [max($today->toDateString(), $row->period_from), $row->period_to])
            ->get(['o.code', 'o.title', 'o.amount', 'o.currency', 'o.probability', 'o.expected_close_date', 'o.stage']);
        $weighted = $pipeline->sum(fn (object $item): float => $this->pen((float) $item->amount, $item->currency) * (int) $item->probability / 100);

        return [
            'sales' => round($sales, 2),
            'bookings' => $reservations->count(),
            'margin' => $sales > 0 ? round($sales - $cost, 2) : 0.0,
            'conversion' => $closed->isEmpty() ? null : round($won / $closed->count() * 100, 1),
            'weighted_pipeline' => round($weighted, 2),
            'reservations' => $reservations->sortByDesc('created_at')->map(fn (object $item): array => ['code' => $item->code, 'title' => $item->title, 'total' => (float) $item->total_amount, 'currency' => $item->currency, 'total_pen' => round((float) $item->total_amount * (float) $item->fx_rate, 2), 'created_at' => $item->created_at])->values()->all(),
            'pipeline' => $pipeline->map(fn (object $item): array => ['code' => $item->code, 'title' => $item->title, 'amount' => (float) $item->amount, 'currency' => $item->currency, 'probability' => (int) $item->probability, 'close' => $item->expected_close_date, 'stage' => $item->stage])->values()->all(),
        ];
    }

    public function policy(): array
    {
        $row = DB::table('crm_sales_target_policies')->first();

        return [
            'tiers' => $row ? json_decode((string) $row->tiers, true) : [['min' => 90, 'pay' => 50], ['min' => 100, 'pay' => 100], ['min' => 120, 'pay' => 130]],
            'lock_decrease_after_pct' => (int) ($row->lock_decrease_after_pct ?? 50),
        ];
    }

    private function present(object $row, array $names, array $policy, Carbon $today): array
    {
        $result = $row->result ? json_decode((string) $row->result, true) : null;
        $frozen = $row->status === 'cerrada' && is_array($result);
        $live = $frozen || in_array($row->status, ['anulada'], true) ? null : $this->progress($row, $today);
        $actual = $frozen ? ['sales' => (float) $result['sales'], 'bookings' => (int) $result['bookings'], 'margin' => (float) $result['margin'], 'conversion' => $result['conversion'] !== null ? (float) $result['conversion'] : null] : [
            'sales' => $live['sales'] ?? 0.0,
            'bookings' => $live['bookings'] ?? 0,
            'margin' => $live['margin'] ?? 0.0,
            'conversion' => $live['conversion'] ?? null,
        ];
        $goal = (float) $row->goal_sales_pen;
        $from = Carbon::parse($row->period_from);
        $to = Carbon::parse($row->period_to);
        $days = $from->diffInDays($to) + 1;
        $elapsed = (int) max(0, min($days, $from->diffInDays($today, false) + 1));
        $projection = $frozen ? $actual['sales'] : $actual['sales'] + ($live['weighted_pipeline'] ?? 0);
        $progress = $goal > 0 ? round($actual['sales'] / $goal * 100, 1) : 0.0;
        $projectionPct = $goal > 0 ? round($projection / $goal * 100, 1) : 0.0;
        $bonusPct = collect($policy['tiers'])->filter(fn (array $tier): bool => ($frozen ? $progress : $projectionPct) >= $tier['min'])->max('pay') ?? 0;

        return [
            'code' => $row->code,
            'lock_version' => (int) $row->lock_version,
            'scope_type' => $row->scope_type,
            'scope_label' => self::SCOPES[$row->scope_type] ?? $row->scope_type,
            'scope' => ['id' => $row->scope_id, 'name' => $names[$row->scope_type][$row->scope_id] ?? 'Sin nombre'],
            'period_type' => $row->period_type,
            'period_key' => $row->period_key,
            'period_label' => TargetPeriod::label($row->period_key),
            'period_from' => $row->period_from,
            'period_to' => $row->period_to,
            'elapsed_pct' => $days > 0 ? (int) round($elapsed / $days * 100) : 0,
            'days_left' => (int) max(0, $today->diffInDays($to, false)),
            'status' => $row->status,
            'health' => $this->health($row->status, $progress, $projectionPct, $from, $to, $today),
            'goals' => [
                'sales' => $goal,
                'bookings' => $row->goal_bookings !== null ? (int) $row->goal_bookings : null,
                'margin' => $row->goal_margin_pen !== null ? (float) $row->goal_margin_pen : null,
                'conversion' => $row->goal_conversion_pct !== null ? (float) $row->goal_conversion_pct : null,
            ],
            'actual' => $actual,
            'progress_pct' => $progress,
            'projection' => round($projection, 2),
            'projection_pct' => $projectionPct,
            'bonus' => $row->bonus_amount !== null ? ['amount' => (float) $row->bonus_amount, 'currency' => $row->bonus_currency ?? 'PEN', 'pct' => (int) $bonusPct, 'estimated' => round((float) $row->bonus_amount * $bonusPct / 100, 2)] : null,
            'reservations' => $live['reservations'] ?? [],
            'pipeline' => $live['pipeline'] ?? [],
            'closed_at' => $result['closed_at'] ?? null,
        ];
    }

    private function health(string $status, float $progress, float $projection, Carbon $from, Carbon $to, Carbon $today): string
    {
        return match (true) {
            $status === 'borrador' => 'borrador',
            $status === 'anulada' => 'anulada',
            $status === 'cerrada' => $progress >= 100 ? 'cumplida' : 'no_cumplida',
            $from->gt($today) => 'por_iniciar',
            $to->lt($today) => 'por_cerrar',
            $projection >= 100 => 'en_camino',
            $projection >= 80 => 'en_riesgo',
            default => 'critico',
        };
    }

    private function ranking(Collection $targets, bool $amounts, User $viewer): array
    {
        $period = $targets->where('scope_type', 'asesor')->whereIn('status', ['vigente', 'cerrada'])->pluck('period_key')->filter(fn (string $key): bool => ! str_contains($key, 'Q'))->sortDesc()->first(fn (string $key): bool => $key <= Carbon::now($this->context->timezone())->format('Y-m'));

        return $targets->where('scope_type', 'asesor')->where('period_key', $period)->whereIn('status', ['vigente', 'cerrada'])
            ->sortByDesc('progress_pct')->values()
            ->map(fn (array $target, int $index): array => [
                'position' => $index + 1,
                'name' => $target['scope']['name'],
                'me' => $target['scope']['id'] === $viewer->getKey(),
                'progress_pct' => $target['progress_pct'],
                'sales' => $amounts ? $target['actual']['sales'] : null,
                'goal' => $amounts ? $target['goals']['sales'] : null,
            ])->all();
    }

    private function breakdown(object $row, array $target, array $names, Carbon $today): array
    {
        if ($row->scope_type === 'asesor') {
            $teams = DB::table('crm_sales_team_members')->where('user_id', $row->scope_id)->where('valid_from', '<=', $row->period_to)
                ->where(fn (Builder $query) => $query->whereNull('valid_to')->orWhere('valid_to', '>=', $row->period_from))->pluck('team_id');
            $sede = DB::table('iam_users')->where('id', $row->scope_id)->value('sede_id');
            $groups = DB::table('crm_sales_targets')->whereIn('status', ['vigente', 'cerrada'])
                ->where('period_from', '<=', $row->period_to)->where('period_to', '>=', $row->period_from)
                ->where(fn (Builder $query) => $query->where(fn (Builder $team) => $team->where('scope_type', 'equipo')->whereIn('scope_id', $teams))->orWhere(fn (Builder $place) => $place->where('scope_type', 'sede')->where('scope_id', $sede)))
                ->orderBy('scope_type')->get();

            return $groups->map(function (object $group) use ($names, $target, $today): array {
                $goal = (float) $group->goal_sales_pen;
                $result = $group->result ? json_decode((string) $group->result, true) : null;
                $live = $group->status === 'cerrada' && is_array($result) ? ['sales' => (float) $result['sales'], 'bookings' => (int) $result['bookings']] : $this->progress($group, $today);

                return [
                    'kind' => $group->scope_type,
                    'name' => $names[$group->scope_type][$group->scope_id] ?? 'Sin nombre',
                    'target_code' => $group->code,
                    'period_label' => TargetPeriod::label($group->period_key),
                    'sales' => round((float) $live['sales'], 2),
                    'bookings' => (int) $live['bookings'],
                    'goal' => $goal,
                    'progress_pct' => $goal > 0 ? round((float) $live['sales'] / $goal * 100, 1) : null,
                    'share_pct' => (float) $live['sales'] > 0 ? round($target['actual']['sales'] / (float) $live['sales'] * 100, 1) : 0.0,
                ];
            })->values()->all();
        }

        $members = $row->scope_type === 'equipo'
            ? $this->owners($row)
            : DB::table('iam_users as u')->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')->join('roles as ro', 'ro.id', '=', 'mr.role_id')
                ->where('u.sede_id', $row->scope_id)->whereNull('u.deleted_at')->whereIn('ro.name', ['manager', 'sales'])->distinct()->pluck('u.id')->all();
        $tz = $this->context->timezone();
        $sales = DB::table('booking_reservations as r')->whereNull('r.deleted_at')->whereIn('r.status', self::COUNTED)
            ->where('r.created_at', '>=', Carbon::parse($row->period_from, $tz)->startOfDay()->utc())
            ->where('r.created_at', '<=', Carbon::parse($row->period_to, $tz)->endOfDay()->utc())
            ->when($row->scope_type === 'sede', fn (Builder $query) => $query->where('r.sede_id', $row->scope_id), fn (Builder $query) => $query->whereIn('r.owner_id', $members))
            ->groupBy('r.owner_id')
            ->selectRaw('r.owner_id, sum(r.total_amount * r.fx_rate) as sales, count(*) as bookings')
            ->get()->keyBy('owner_id');
        $goals = DB::table('crm_sales_targets')->where('scope_type', 'asesor')->whereIn('scope_id', [...$members, ...$sales->keys()->all()])->whereIn('status', ['vigente', 'cerrada', 'borrador'])
            ->where('period_from', '>=', $row->period_from)->where('period_to', '<=', $row->period_to)
            ->get(['code', 'scope_id', 'goal_sales_pen', 'status'])->groupBy('scope_id');
        $total = (float) $sales->sum('sales');

        return collect([...$members, ...$sales->keys()->all()])->filter()->unique()->map(function (string $id) use ($sales, $goals, $names, $total): array {
            $own = $goals->get($id, collect());
            $goal = (float) $own->sum('goal_sales_pen');
            $sold = round((float) ($sales[$id]->sales ?? 0), 2);

            return [
                'kind' => 'asesor',
                'name' => $names['asesor'][$id] ?? 'Sin nombre',
                'target_code' => $own->count() === 1 ? $own->first()->code : null,
                'period_label' => null,
                'sales' => $sold,
                'bookings' => (int) ($sales[$id]->bookings ?? 0),
                'goal' => $goal > 0 ? $goal : null,
                'progress_pct' => $goal > 0 ? round($sold / $goal * 100, 1) : null,
                'share_pct' => $total > 0 ? round($sold / $total * 100, 1) : 0.0,
            ];
        })->sortByDesc('sales')->values()->all();
    }

    private function owners(object $row): array
    {
        if ($row->scope_type === 'asesor') {
            return [$row->scope_id];
        }

        if ($row->scope_type === 'equipo') {
            return $this->members[$row->scope_id] ??= DB::table('crm_sales_team_members')->where('team_id', $row->scope_id)
                ->where('valid_from', '<=', $row->period_to)
                ->where(fn (Builder $query) => $query->whereNull('valid_to')->orWhere('valid_to', '>=', $row->period_from))
                ->pluck('user_id')->all();
        }

        return [];
    }

    private function scopeNames(): array
    {
        return [
            'asesor' => DB::table('iam_users')->pluck('name', 'id')->all(),
            'sede' => DB::table('iam_sedes')->pluck('name', 'id')->all(),
            'equipo' => DB::table('crm_sales_teams')->pluck('name', 'id')->all(),
        ];
    }

    private function openPeriods(Carbon $today): array
    {
        $months = collect(range(0, 5))->map(fn (int $offset): string => $today->copy()->startOfMonth()->addMonths($offset)->format('Y-m'));
        $quarters = collect(range(0, 3))->map(fn (int $offset): string => TargetPeriod::current('trimestre', $today->copy()->startOfMonth()->addMonths($offset * 3)));

        return $months->concat($quarters)->unique()->map(fn (string $key): array => ['value' => $key, 'label' => TargetPeriod::label($key)])->values()->all();
    }

    private function pen(float $amount, string $currency): float
    {
        if ($currency === 'PEN') {
            return $amount;
        }

        $this->usd ??= (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? 3.75);

        return $amount * $this->usd;
    }
}
