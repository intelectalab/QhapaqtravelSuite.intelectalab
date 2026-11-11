<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AllotmentDirectory
{
    public const KINDS = ['hotel', 'tren', 'entrada'];

    public const STATUSES = ['activo', 'en_release', 'liberado', 'vencido'];

    public const SERVICE_KINDS = ['Alojamiento' => 'hotel', 'Tren' => 'tren', 'Entrada' => 'entrada'];

    public const PROVIDER_TYPES = ['Hotel', 'Tren', 'Entrada'];

    public const UNITS = ['hotel' => 'hab./noche', 'tren' => 'asiento/día', 'entrada' => 'cupo/día'];

    private const HORIZON = 30;

    public function __construct(private readonly Consolidation $money) {}

    public static function closed(object $contract): bool
    {
        return in_array($contract->status, ['liberado', 'vencido'], true);
    }

    public static function cell(object $day, object $contract, string $today): array
    {
        $blocked = (int) $day->blocked_qty;
        $released = min($blocked, (int) $day->released_qty);
        $used = (int) $day->used_qty;
        $pending = (int) $day->pending_qty;
        $capacity = $blocked - $released;
        $available = max(0, $capacity - $used - $pending);
        $over = max(0, $used - $capacity);
        $deadline = (string) $day->release_deadline;
        $toDeadline = (int) Carbon::parse($today)->diffInDays(Carbon::parse($deadline), false);
        $retained = $day->retained_at !== null;
        $date = (string) $day->service_date;

        $state = match (true) {
            $blocked === 0 => 'off',
            $date < $today => 'past',
            $over > 0 => 'over',
            $capacity === 0 && $released > 0 => 'free',
            $retained && $toDeadline < 0 && $available > 0 => 'ret',
            $available > 0 && $toDeadline <= 3 && ! self::closed($contract) => 'rel',
            $capacity > 0 && $available === 0 => 'full',
            $capacity > 0 && $used / $capacity >= 0.5 => 'mid',
            default => 'ok',
        };

        return [
            'date' => $date,
            'blocked' => $blocked,
            'released' => $released,
            'used' => $used,
            'pending' => $pending,
            'capacity' => $capacity,
            'available' => $available,
            'over' => $over,
            'deadline' => $deadline,
            'to_deadline' => $toDeadline,
            'retained' => $retained ? (string) $day->retained_reason : null,
            'closed' => $day->closed_at !== null,
            'exposure' => $retained && $toDeadline < 0 && $available > 0 ? self::penalty($contract, $available) : 0.0,
            'state' => $state,
        ];
    }

    public static function penalty(object $contract, int $units): float
    {
        return round($units * (float) $contract->net_rate * (float) $contract->penalty_pct / 100, 2);
    }

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $contracts = $this->contracts();
        $days = $this->days($contracts->pluck('id')->all(), $today, Carbon::parse($today)->addDays(130)->toDateString());
        $charges = $this->chargeTotals();
        $rate = $this->money->usdRate();
        $alerts = [];
        $rows = [];

        foreach ($contracts as $contract) {
            $cells = ($days[$contract->id] ?? collect())->map(fn (object $day) => self::cell($day, $contract, $today));
            $window = $cells->filter(fn (array $cell) => $cell['date'] < Carbon::parse($today)->addDays(self::HORIZON)->toDateString());
            $stats = self::stats($window);
            $open = ! self::closed($contract);

            foreach ($open ? $cells : [] as $cell) {
                $base = ['contract' => $contract->code, 'name' => $contract->name, 'provider' => $contract->provider_name, 'kind' => $contract->kind, 'currency' => $contract->currency, 'date' => $cell['date'], 'deadline' => $cell['deadline'], 'to_deadline' => $cell['to_deadline'], 'units' => $cell['available'], 'penalty' => self::penalty($contract, $cell['available'])];

                if ($cell['available'] > 0 && $cell['retained'] === null && $cell['to_deadline'] <= 0) {
                    $alerts[] = [...$base, 'type' => 'vencido', 'reason' => null];
                } elseif ($cell['available'] > 0 && $cell['retained'] === null && $cell['to_deadline'] <= 3) {
                    $alerts[] = [...$base, 'type' => 'proximo', 'reason' => null];
                } elseif ($cell['retained'] !== null && $cell['available'] > 0) {
                    $alerts[] = [...$base, 'type' => 'retenido', 'reason' => $cell['retained'], 'penalty' => $cell['to_deadline'] < 0 ? $base['penalty'] : 0.0];
                }

                if ($cell['over'] > 0) {
                    $alerts[] = [...$base, 'type' => 'sobreventa', 'units' => $cell['over'], 'penalty' => 0.0, 'reason' => null];
                }
            }

            $exposure = $open ? $cells->sum('exposure') : 0.0;
            $penalties = (float) ($charges[$contract->id] ?? 0);
            $rows[] = [
                ...$this->summary($contract),
                'utilization' => $open ? $stats['utilization'] : null,
                'window' => $stats,
                'penalties' => round($penalties, 2),
                'exposure' => round($exposure, 2),
                'penalties_pen' => round($contract->currency === 'USD' ? $penalties * $rate : $penalties, 2),
                'exposure_pen' => round($contract->currency === 'USD' ? $exposure * $rate : $exposure, 2),
            ];
        }

        $job = DB::table('sys_scheduled_jobs')->where('code', 'JOB-10')->first(['cron_label', 'last_run_at', 'last_status', 'last_result', 'paused']);

        return [
            'today' => $today,
            'usd_rate' => $rate,
            'contracts' => $rows,
            'alerts' => collect($alerts)->sortBy([['date', 'asc'], ['contract', 'asc']])->values(),
            'job' => $job ? [
                'schedule' => $job->cron_label,
                'last_run_at' => $job->last_run_at ? Carbon::parse($job->last_run_at)->toIso8601String() : null,
                'status' => $job->last_status,
                'result' => $job->last_result,
                'paused' => (bool) $job->paused,
            ] : null,
            'options' => $this->options(),
            'can' => ['manage' => $viewer->can('catalog.allotments.manage')],
        ];
    }

    public function grid(?string $from, int $length, ?string $kind, bool $all): array
    {
        $today = CatalogAccess::today();
        $start = $from !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) === 1 ? Carbon::parse($from)->toDateString() : Carbon::parse($today)->subDays(2)->toDateString();
        $length = max(7, min(31, $length));
        $end = Carbon::parse($start)->addDays($length - 1)->toDateString();
        $dates = collect(range(0, $length - 1))->map(fn (int $offset) => Carbon::parse($start)->addDays($offset)->toDateString());

        $contracts = $this->contracts()
            ->filter(fn (object $contract) => ($kind === null || $contract->kind === $kind) && ($all || ! self::closed($contract)))
            ->filter(fn (object $contract) => $contract->valid_from <= $end && $contract->valid_to >= $start)
            ->values();
        $days = $this->days($contracts->pluck('id')->all(), $start, $end);
        $refs = $this->consumptions($contracts->pluck('id')->all(), $start, $end)->groupBy(fn (object $row) => "{$row->allotment_id}|{$row->service_date}");

        return [
            'today' => $today,
            'from' => $start,
            'to' => $end,
            'length' => $length,
            'kind' => $kind,
            'all' => $all,
            'dates' => $dates,
            'rows' => $contracts->map(function (object $contract) use ($days, $dates, $today, $refs) {
                $byDate = ($days[$contract->id] ?? collect())->keyBy('service_date');

                return [
                    ...$this->summary($contract),
                    'cells' => $dates->map(function (string $date) use ($byDate, $contract, $today, $refs) {
                        $day = $byDate->get($date);

                        if ($day === null) {
                            return ['date' => $date, 'state' => 'off'];
                        }

                        return [
                            ...self::cell($day, $contract, $today),
                            'lock_version' => (int) $day->lock_version,
                            'charge' => $day->charge_amount !== null ? (float) $day->charge_amount : null,
                            'refs' => ($refs["{$contract->id}|{$date}"] ?? collect())->map(fn (object $row) => $this->consumption($row))->values(),
                        ];
                    })->values(),
                ];
            })->values(),
        ];
    }

    public function pickup(int $horizon = self::HORIZON, int $weeks = 8): array
    {
        $today = CatalogAccess::today();
        $end = Carbon::parse($today)->addDays($horizon - 1)->toDateString();
        $contracts = $this->contracts()->filter(fn (object $contract) => $contract->status !== 'vencido')->values();
        $days = $this->days($contracts->pluck('id')->all(), $today, $end);
        $consumptions = $this->consumptions($contracts->pluck('id')->all(), $today, $end)->groupBy('allotment_id');
        $cuts = collect(range(0, $weeks))->map(fn (int $index) => Carbon::parse($today)->subDays(7 * ($weeks - $index))->toDateString());

        return [
            'today' => $today,
            'horizon' => $horizon,
            'cuts' => $cuts,
            'rows' => $contracts->map(function (object $contract) use ($days, $consumptions, $today, $cuts) {
                $stats = self::stats(($days[$contract->id] ?? collect())->map(fn (object $day) => self::cell($day, $contract, $today)));
                $sold = ($consumptions[$contract->id] ?? collect())->where('state', 'consumido');
                $since = fn (int $back) => (int) $sold->filter(fn (object $row) => substr((string) $row->booked_at, 0, 10) > Carbon::parse($today)->subDays($back)->toDateString())->sum('qty');

                return [
                    ...$this->summary($contract),
                    'window' => $stats,
                    'pickup_7' => $since(7),
                    'pickup_30' => $since(30),
                    'recommendation' => match (true) {
                        $contract->status === 'liberado' => 'liberado',
                        $stats['utilization'] >= 85 => 'ampliar',
                        $stats['capacity'] > 0 && $stats['utilization'] < 25 => 'reducir',
                        default => 'mantener',
                    },
                    'curve' => $cuts->map(fn (string $cut) => (int) $sold->filter(fn (object $row) => substr((string) $row->booked_at, 0, 10) <= $cut)->sum('qty'))->values(),
                ];
            })->values(),
        ];
    }

    public function detail(string $code, User $viewer): array
    {
        $today = CatalogAccess::today();
        $contract = $this->find($code);
        $cells = ($this->days([$contract->id], $contract->valid_from, $contract->valid_to)[$contract->id] ?? collect())
            ->map(fn (object $day) => [...self::cell($day, $contract, $today), 'lock_version' => (int) $day->lock_version, 'charge' => $day->charge_amount !== null ? (float) $day->charge_amount : null]);
        $from = max($today, (string) $contract->valid_from);
        $window = $cells->filter(fn (array $cell) => $cell['date'] >= $from && $cell['date'] < Carbon::parse($from)->addDays(self::HORIZON)->toDateString());
        $open = ! self::closed($contract);
        $future = $cells->filter(fn (array $cell) => $cell['date'] >= $today);

        $charges = DB::table('catalog_allotment_charges as c')->join('catalog_allotment_days as d', 'd.id', '=', 'c.allotment_day_id')
            ->leftJoin('fin_payables as f', 'f.id', '=', 'c.payable_id')
            ->where('d.allotment_id', $contract->id)->orderByDesc('d.service_date')
            ->get(['d.service_date', 'c.qty', 'c.amount', 'c.currency', 'c.reason', 'c.created_at', 'f.code as payable'])
            ->map(fn (object $charge) => [
                'date' => $charge->service_date,
                'qty' => (int) $charge->qty,
                'amount' => (float) $charge->amount,
                'currency' => $charge->currency,
                'reason' => $charge->reason,
                'payable' => $charge->payable,
                'created_at' => Carbon::parse($charge->created_at)->toIso8601String(),
            ]);

        $requests = DB::table('catalog_allotment_requests as r')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.created_by')
            ->leftJoin('iam_users as a', 'a.id', '=', 'r.responded_by')
            ->where('r.allotment_id', $contract->id)->orderByDesc('r.created_at')
            ->get(['r.*', 'u.name as requested_by', 'a.name as answered_by'])
            ->map(fn (object $request) => [
                'code' => $request->code,
                'date_from' => $request->date_from,
                'date_to' => $request->date_to,
                'extra_qty' => (int) $request->extra_qty,
                'note' => $request->note,
                'status' => $request->status,
                'response' => $request->response,
                'requested_by' => $request->requested_by,
                'requested_at' => Carbon::parse($request->created_at)->toIso8601String(),
                'answered_by' => $request->answered_by,
                'answered_at' => $request->responded_at ? Carbon::parse($request->responded_at)->toIso8601String() : null,
            ]);

        $events = DB::table('catalog_allotment_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.user_id')
            ->where('e.allotment_id', $contract->id)->orderByDesc('e.occurred_at')->limit(60)
            ->get(['e.occurred_at', 'e.message', 'u.name as user'])
            ->map(fn (object $event) => ['at' => Carbon::parse($event->occurred_at)->toIso8601String(), 'message' => $event->message, 'user' => $event->user]);

        return [
            'today' => $today,
            'contract' => [
                ...$this->summary($contract),
                'provider_contact' => $contract->provider_contact,
                'payment_terms' => $contract->payment_terms,
                'owner' => $contract->owner_name,
                'notes' => $contract->notes,
                'released_at' => $contract->released_at ? Carbon::parse($contract->released_at)->toIso8601String() : null,
                'release_reason' => $contract->release_reason,
                'created_at' => Carbon::parse($contract->created_at)->toIso8601String(),
            ],
            'window' => self::stats($window),
            'window_from' => $from,
            'exposure' => $open ? round($future->sum('exposure'), 2) : 0.0,
            'exposure_units' => $open ? (int) $future->filter(fn (array $cell) => $cell['exposure'] > 0)->sum('available') : 0,
            'upcoming' => $open ? $future->filter(fn (array $cell) => $cell['available'] > 0 && $cell['retained'] === null && $cell['to_deadline'] > 0 && $cell['to_deadline'] <= 3)->values() : [],
            'pending' => $open ? $future->filter(fn (array $cell) => $cell['available'] > 0 && $cell['retained'] === null && $cell['to_deadline'] <= 0)->values() : [],
            'special' => $cells->filter(fn (array $cell) => $cell['blocked'] !== (int) $contract->base_qty)->map(fn (array $cell) => ['date' => $cell['date'], 'blocked' => $cell['blocked']])->values(),
            'days' => $cells->values(),
            'consumptions' => $this->consumptions([$contract->id], $contract->valid_from, $contract->valid_to)->map(fn (object $row) => $this->consumption($row))->values(),
            'requests' => $requests,
            'charges' => $charges,
            'penalties' => round((float) $charges->sum('amount'), 2),
            'events' => $events,
            'options' => $this->options(),
            'can' => ['manage' => $viewer->can('catalog.allotments.manage')],
        ];
    }

    public function find(string $code): object
    {
        return $this->contracts($code)->first() ?? throw ApiException::notFound('El contrato de cupo no existe.');
    }

    private static function stats(Collection $cells): array
    {
        $blocked = (int) $cells->sum('blocked');
        $released = (int) $cells->sum('released');
        $used = (int) $cells->sum('used');
        $capacity = $blocked - $released;

        return [
            'blocked' => $blocked,
            'released' => $released,
            'capacity' => $capacity,
            'used' => $used,
            'pending' => (int) $cells->sum('pending'),
            'available' => (int) $cells->sum('available'),
            'utilization' => $capacity > 0 ? (int) round($used / $capacity * 100) : 0,
        ];
    }

    private function summary(object $contract): array
    {
        return [
            'code' => $contract->code,
            'name' => $contract->name,
            'contract_ref' => $contract->contract_ref,
            'kind' => $contract->kind,
            'unit' => self::UNITS[$contract->kind] ?? 'unidad',
            'provider' => ['id' => $contract->provider_id, 'code' => $contract->provider_ref, 'name' => $contract->provider_name],
            'service' => ['id' => $contract->service_id, 'code' => $contract->service_ref, 'name' => $contract->service_name],
            'valid_from' => $contract->valid_from,
            'valid_to' => $contract->valid_to,
            'base_qty' => (int) $contract->base_qty,
            'release_days' => (int) $contract->release_days,
            'net_rate' => (float) $contract->net_rate,
            'currency' => $contract->currency,
            'penalty_pct' => (float) $contract->penalty_pct,
            'status' => $contract->status,
            'lock_version' => (int) $contract->lock_version,
        ];
    }

    private function contracts(?string $code = null): Collection
    {
        return DB::table('catalog_allotments as a')
            ->join('catalog_providers as p', 'p.id', '=', 'a.provider_id')
            ->join('catalog_services as s', 's.id', '=', 'a.service_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'a.owner_id')
            ->whereNull('a.deleted_at')
            ->when($code !== null, fn ($query) => $query->where(Str::isUuid((string) $code) ? 'a.id' : 'a.code', $code))
            ->orderByRaw("case a.status when 'en_release' then 0 when 'activo' then 1 when 'liberado' then 2 else 3 end")
            ->orderBy('a.valid_from')
            ->get(['a.*', 'p.ref as provider_ref', 'p.name as provider_name', 'p.contact_name as provider_contact', 'p.payment_terms', 's.ref as service_ref', 's.name as service_name', 'u.name as owner_name']);
    }

    private function days(array $ids, string $from, string $to): array
    {
        if ($ids === []) {
            return [];
        }

        return DB::table('catalog_allotment_days as d')
            ->leftJoin('catalog_allotment_charges as c', 'c.allotment_day_id', '=', 'd.id')
            ->whereIn('d.allotment_id', $ids)->whereBetween('d.service_date', [$from, $to])
            ->orderBy('d.service_date')
            ->get(['d.*', 'c.amount as charge_amount'])
            ->groupBy('allotment_id')
            ->all();
    }

    private function consumptions(array $ids, string $from, string $to): Collection
    {
        if ($ids === []) {
            return collect();
        }

        return DB::table('catalog_allotment_consumptions as c')
            ->join('catalog_allotment_days as d', 'd.id', '=', 'c.allotment_day_id')
            ->join('booking_reservations as r', 'r.id', '=', 'c.reservation_id')
            ->join('booking_reservation_services as s', 's.id', '=', 'c.booking_service_id')
            ->whereIn('d.allotment_id', $ids)->whereBetween('d.service_date', [$from, $to])
            ->where('c.state', '<>', 'revertido')
            ->orderBy('d.service_date')->orderBy('r.code')
            ->get(['d.allotment_id', 'd.service_date', 'c.qty', 'c.state', 'r.code as reservation', 'r.created_at as booked_at', 's.name as service', 's.status as service_status']);
    }

    private function consumption(object $row): array
    {
        return [
            'date' => $row->service_date,
            'reservation' => $row->reservation,
            'service' => $row->service,
            'service_status' => $row->service_status,
            'qty' => (int) $row->qty,
            'state' => $row->state,
            'booked_at' => Carbon::parse($row->booked_at)->toIso8601String(),
        ];
    }

    private function chargeTotals(): array
    {
        return DB::table('catalog_allotment_charges as c')->join('catalog_allotment_days as d', 'd.id', '=', 'c.allotment_day_id')
            ->groupBy('d.allotment_id')->selectRaw('d.allotment_id, sum(c.amount) as total')->pluck('total', 'allotment_id')->all();
    }

    private function options(): array
    {
        return [
            'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->whereIn('type', self::PROVIDER_TYPES)->where('status', 'activo')
                ->orderBy('name')->get(['id', 'ref as code', 'name', 'type']),
            'services' => DB::table('catalog_services')->whereNull('deleted_at')->whereIn('type', array_keys(self::SERVICE_KINDS))->where('status', 'activo')
                ->orderBy('name')->get(['id', 'ref as code', 'name', 'type', 'provider_id', 'cost', 'currency'])
                ->map(fn (object $service) => [...(array) $service, 'cost' => (float) $service->cost, 'kind' => self::SERVICE_KINDS[$service->type]]),
            'kinds' => collect(self::UNITS)->map(fn (string $unit, string $kind) => ['value' => $kind, 'unit' => $unit])->values(),
        ];
    }
}
