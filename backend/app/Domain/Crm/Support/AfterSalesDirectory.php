<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class AfterSalesDirectory
{
    public const CASE_STATUS = ['abierta' => 'Abierta', 'en_proceso' => 'En proceso', 'resuelta' => 'Resuelta', 'cerrada' => 'Cerrada'];

    public function __construct(private readonly TenantContext $context, private readonly Advisors $advisors) {}

    public function overview(User $viewer): array
    {
        $today = Carbon::now($this->context->timezone())->startOfDay();
        $surveys = $this->surveys($viewer);
        $trips = $this->trips($viewer, $today, $surveys);
        $cases = $this->cases($viewer);
        $recent = $surveys->filter(fn (array $survey): bool => Carbon::parse($survey['responded_at'])->gte($today->copy()->subYear()));
        $total = max(1, $recent->count());
        $promoters = $recent->where('category', 'promotor')->count();
        $detractors = $recent->where('category', 'detractor')->count();

        return [
            'today' => $today->toDateString(),
            'kpis' => [
                'to_close' => $trips->whereNull('survey')->count(),
                'nps' => $recent->isEmpty() ? null : (int) round(($promoters - $detractors) / $total * 100),
                'average' => $recent->isEmpty() ? null : round($recent->avg('score'), 1),
                'responses' => $recent->count(),
                'open_cases' => $cases->whereIn('status', ['abierta', 'en_proceso'])->count(),
                'promoters' => $promoters,
                'passives' => $recent->where('category', 'pasivo')->count(),
                'detractors' => $detractors,
            ],
            'distribution' => collect(range(0, 10))->map(fn (int $score): array => ['score' => $score, 'count' => $recent->where('score', $score)->count()])->values(),
            'trend' => $this->trend($surveys, $today),
            'trips' => $trips->values(),
            'surveys' => $surveys->values(),
            'cases' => $cases->values(),
            'clients' => Portfolio::scope(DB::table('crm_clients')->whereNull('deleted_at'), $viewer, 'owner_id')->orderBy('name')->get(['code', 'name'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name])->values(),
            'channels' => $this->catalog('survey_channel'),
            'case_types' => $this->catalog('case_type'),
            'owners' => Portfolio::ownOnly($viewer) ? [] : $this->advisors->all()->values(),
            'can' => ['manage' => $viewer->can('crm.clients.manage')],
        ];
    }

    private function surveys(User $viewer): Collection
    {
        return Portfolio::scope(DB::table('crm_surveys as s')->join('crm_clients as c', 'c.id', '=', 's.client_id'), $viewer, 'c.owner_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 's.recorded_by')
            ->leftJoin('crm_catalog_items as k', fn ($join) => $join->on('k.code', '=', 's.channel_code')->where('k.kind', '=', 'survey_channel'))
            ->orderByDesc('s.responded_at')
            ->get(['s.code', 's.score', 's.comment', 's.channel_code', 's.responded_at', 'c.code as client_code', 'c.name as client', 'r.code as reservation', 'r.title as reservation_title', 'u.name as recorded_by', 'k.label as channel'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'score' => (int) $row->score,
                'category' => $row->score >= 9 ? 'promotor' : ($row->score >= 7 ? 'pasivo' : 'detractor'),
                'comment' => $row->comment,
                'channel_code' => $row->channel_code,
                'channel' => $row->channel ?? $row->channel_code,
                'responded_at' => $row->responded_at,
                'client' => ['code' => $row->client_code, 'name' => $row->client],
                'reservation' => $row->reservation ? ['code' => $row->reservation, 'title' => $row->reservation_title] : null,
                'recorded_by' => $row->recorded_by,
            ]);
    }

    private function trips(User $viewer, Carbon $today, Collection $surveys): Collection
    {
        $byReservation = $surveys->filter(fn (array $survey): bool => $survey['reservation'] !== null)->keyBy(fn (array $survey): string => $survey['reservation']['code']);

        return Portfolio::scope(DB::table('booking_reservations as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->join('iam_users as u', 'u.id', '=', 'r.owner_id')
            ->where(fn ($query) => $query
                ->where(fn ($done) => $done->where('r.status', 'completada')->where('r.travel_to', '>=', $today->copy()->subDays(90)->toDateString()))
                ->orWhere(fn ($live) => $live->where('r.status', 'en_operacion')->where('r.travel_to', '<=', $today->copy()->addDays(5)->toDateString())))
            ->orderByDesc('r.travel_to')
            ->get(['r.code', 'r.title', 'r.status', 'r.travel_from', 'r.travel_to', 'r.total_amount', 'r.currency', 'c.code as client_code', 'c.name as client', 'u.name as owner'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'title' => $row->title,
                'status' => $row->status,
                'travel_from' => $row->travel_from,
                'travel_to' => $row->travel_to,
                'days_since' => (int) Carbon::parse($row->travel_to)->diffInDays($today, false),
                'total' => (float) $row->total_amount,
                'currency' => $row->currency,
                'client' => ['code' => $row->client_code, 'name' => $row->client],
                'owner' => $row->owner,
                'survey' => isset($byReservation[$row->code]) ? ['code' => $byReservation[$row->code]['code'], 'score' => $byReservation[$row->code]['score']] : null,
            ]);
    }

    private function cases(User $viewer): Collection
    {
        $rows = Portfolio::scope(DB::table('crm_cases as k')->where('k.is_book', false), $viewer, 'k.owner_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'k.client_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'k.reservation_id')
            ->leftJoin('crm_surveys as s', 's.id', '=', 'k.survey_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'k.owner_id')
            ->leftJoin('crm_catalog_items as t', fn ($join) => $join->on('t.code', '=', 'k.type_code')->where('t.kind', '=', 'case_type'))
            ->orderByRaw("case k.status when 'abierta' then 0 when 'en_proceso' then 1 when 'resuelta' then 2 else 3 end")
            ->orderByDesc('k.created_at')
            ->get(['k.id', 'k.code', 'k.type_code', 'k.priority', 'k.subject', 'k.description', 'k.status', 'k.origin', 'k.resolution', 'k.created_at', 'k.resolved_at', 'k.closed_at', 'k.owner_id', 'c.code as client_code', 'c.name as client', 'r.code as reservation', 's.code as survey', 's.score', 'u.name as owner', 't.label as type']);
        $events = DB::table('crm_case_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.user_id')->whereIn('e.case_id', $rows->pluck('id'))->orderBy('e.created_at')
            ->get(['e.case_id', 'e.event', 'e.message', 'e.created_at', 'u.name'])->groupBy('case_id');

        return $rows->map(fn (object $row): array => [
            'code' => $row->code,
            'type_code' => $row->type_code,
            'type' => $row->type ?? $row->type_code,
            'priority' => $row->priority,
            'subject' => $row->subject,
            'description' => $row->description,
            'status' => $row->status,
            'status_label' => self::CASE_STATUS[$row->status] ?? $row->status,
            'origin' => $row->origin,
            'resolution' => $row->resolution,
            'created_at' => $row->created_at,
            'resolved_at' => $row->resolved_at,
            'closed_at' => $row->closed_at,
            'client' => $row->client_code ? ['code' => $row->client_code, 'name' => $row->client] : null,
            'reservation' => $row->reservation,
            'survey' => $row->survey ? ['code' => $row->survey, 'score' => (int) $row->score] : null,
            'owner' => ['id' => $row->owner_id, 'name' => $row->owner],
            'log' => $events->get($row->id, collect())->map(fn ($event): array => ['event' => $event->event, 'message' => $event->message, 'at' => $event->created_at, 'by' => $event->name ?? 'Sistema'])->values(),
        ]);
    }

    private function trend(Collection $surveys, Carbon $today): array
    {
        return collect(range(5, 0))->map(function (int $back) use ($surveys, $today): array {
            $month = $today->copy()->startOfMonth()->subMonths($back);
            $items = $surveys->filter(fn (array $survey): bool => str_starts_with(Carbon::parse($survey['responded_at'])->setTimezone($this->context->timezone())->format('Y-m'), $month->format('Y-m')));
            $total = $items->count();

            return [
                'key' => $month->format('Y-m'),
                'label' => ucfirst(rtrim($month->locale('es')->isoFormat('MMM'), '.')),
                'responses' => $total,
                'nps' => $total === 0 ? null : (int) round(($items->where('category', 'promotor')->count() - $items->where('category', 'detractor')->count()) / $total * 100),
            ];
        })->values()->all();
    }

    private function catalog(string $kind): array
    {
        return DB::table('crm_catalog_items')->where('kind', $kind)->where('is_active', true)->orderBy('sort_order')->get(['code', 'label'])
            ->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->label])->values()->all();
    }
}
