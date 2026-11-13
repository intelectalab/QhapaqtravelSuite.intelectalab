<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Crm\Actions\ClaimBookWorkflow;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditTrail;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ClaimBookDirectory
{
    public const CHANNELS = ['web' => 'Sitio web', 'customer_portal' => 'Portal del cliente', 'passenger_portal' => 'Portal del pasajero', 'in_person' => 'Presencial'];

    public const BOOK_STATUS = ['received' => 'Recibida', 'in_review' => 'En evaluación', 'answered' => 'Respondida', 'closed' => 'Cerrada'];

    public const TYPES = ['reclamo' => 'Reclamo', 'queja' => 'Queja'];

    public const CLOSE_REASONS = [
        'Consumidor conforme con la respuesta',
        'Sin respuesta del consumidor en 5 días hábiles',
        'Consumidor no conforme: se le informa su derecho de acudir a INDECOPI',
        'Solución aplicada (reembolso o nota de crédito ejecutada)',
    ];

    public function __construct(private readonly TenantContext $context, private readonly BusinessDays $days) {}

    public function settings(): object
    {
        return DB::table('crm_claim_book_settings')->first() ?? (object) ['response_days' => 15, 'alert_days' => 3, 'retention_years' => 2];
    }

    public function overview(User $viewer): array
    {
        $settings = $this->settings();
        $today = $this->today();
        $claims = $this->claims();

        return [
            'today' => $today->toDateString(),
            'settings' => ['response_days' => (int) $settings->response_days, 'alert_days' => (int) $settings->alert_days, 'retention_years' => (int) $settings->retention_years],
            'kpis' => $this->kpis($claims, $today),
            'by_type' => $this->group($claims, 'type'),
            'by_sede' => $this->group($claims, 'sede'),
            'claims' => $claims->values(),
            'sequences' => $this->sequences($today),
            'holidays' => $this->holidays($today),
            'options' => [
                'sedes' => DB::table('iam_sedes')->orderBy('code')->get(['id', 'name'])->map(fn (object $row): array => ['value' => $row->id, 'label' => $row->name])->values(),
                'clients' => DB::table('crm_clients')->whereNull('deleted_at')->orderBy('name')->get(['code', 'name'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name])->values(),
                'reservations' => DB::table('booking_reservations')->whereNull('deleted_at')->orderByDesc('created_at')->limit(100)->get(['code', 'title'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->title, 'hint' => $row->code])->values(),
                'owners' => app(Advisors::class)->all()->map(fn (array $user): array => ['value' => $user['id'], 'label' => $user['name']])->values(),
                'close_reasons' => array_map(fn (string $reason): array => ['value' => $reason, 'label' => $reason], self::CLOSE_REASONS),
            ],
            'can' => ['manage' => $viewer->can('crm.claims.manage'), 'settings' => $viewer->can('admin.settings.manage')],
            'public_path' => ($subdomain = $this->context->tenant()->subdomain ?? null) ? "/sitio/{$subdomain}/libro-reclamaciones" : null,
        ];
    }

    public function find(string $key): array
    {
        $claim = $this->claims(fn (Builder $query) => $query->where(fn (Builder $match) => $match->where('k.code', $key)->orWhere('k.book_number', $key)->when(Str::isUuid($key), fn (Builder $uuid) => $uuid->orWhere('k.id', $key))))->first();

        return $claim ?? throw ApiException::notFound('La hoja de reclamación no existe.');
    }

    public function settingsView(User $viewer): array
    {
        $settings = $this->settings();

        return [
            'response_days' => (int) $settings->response_days,
            'alert_days' => (int) $settings->alert_days,
            'retention_years' => (int) $settings->retention_years,
            'holidays' => $this->holidays($this->today()),
            'can' => ['update' => $viewer->can('admin.settings.manage')],
        ];
    }

    public function report(string $group, int $year): array
    {
        $today = $this->today();
        $claims = $this->claims($this->year($year));
        $field = ['type' => 'type', 'sede' => 'sede', 'month' => 'month'][$group];
        $rows = $claims->map(fn (array $claim): array => [...$claim, 'month' => substr((string) $claim['received_on'], 0, 7)])
            ->groupBy(fn (array $claim): string => (string) ($claim[$field] ?: 'Sin dato'))
            ->map(fn (Collection $items, string $label): array => [
                'label' => $label,
                'total' => $items->count(),
                'reclamos' => $items->where('type_code', 'reclamo')->count(),
                'quejas' => $items->where('type_code', 'queja')->count(),
                'open' => $items->whereIn('book_status', ['received', 'in_review'])->count(),
                'answered' => $items->whereIn('book_status', ['answered', 'closed'])->count(),
                'on_time' => $items->where('deadline', 'respondido_en_plazo')->count(),
                'late' => $items->whereIn('deadline', ['respondido_fuera_de_plazo', 'vencido'])->count(),
            ])->sortBy($group === 'month' ? 'label' : fn (array $row): int => -$row['total'])->values()->all();

        $overdue = $claims->where('deadline', 'vencido');

        return [
            'year' => $year,
            'group' => $group,
            'kpis' => $this->kpis($claims, $today),
            'total' => $claims->count(),
            'rows' => $rows,
            'compliance' => [
                'on_time' => $claims->where('deadline', 'respondido_en_plazo')->count(),
                'late' => $claims->where('deadline', 'respondido_fuera_de_plazo')->count(),
                'overdue' => $overdue->count(),
                'pending' => $claims->whereIn('deadline', ['en_plazo', 'por_vencer'])->count(),
            ],
            'overdue' => $overdue->sortBy('due_date')->map(fn (array $claim): array => [
                'code' => $claim['code'],
                'book_number' => $claim['book_number'],
                'type' => $claim['type'],
                'consumer' => $claim['consumer']['name'],
                'sede' => $claim['sede'],
                'due_date' => $claim['due_date'],
                'days_late' => $claim['days_left'] !== null ? abs((int) $claim['days_left']) : null,
                'owner' => $claim['owner'],
            ])->values()->all(),
        ];
    }

    public function audit(string $key): array
    {
        $claim = DB::table('crm_cases')->where('is_book', true)->where(fn (Builder $match) => $match->where('code', $key)->orWhere('book_number', $key))->first(['code', 'book_number'])
            ?? throw ApiException::notFound('La hoja de reclamación no existe.');

        return app(AuditTrail::class)->for('Libro de reclamaciones', [(string) $claim->book_number, (string) $claim->code]);
    }

    public function year(int $year): Closure
    {
        $zone = $this->context->timezone();

        return fn (Builder $query) => $query->whereBetween('k.received_at', [Carbon::create($year, 1, 1, 0, 0, 0, $zone)->utc(), Carbon::create($year, 12, 31, 23, 59, 59, $zone)->utc()]);
    }

    public function claims(?Closure $scope = null): Collection
    {
        $settings = $this->settings();
        $today = $this->today();
        $rows = DB::table('crm_cases as k')->where('k.is_book', true)
            ->leftJoin('iam_sedes as s', 's.id', '=', 'k.sede_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'k.client_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'k.reservation_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'k.owner_id')
            ->when($scope !== null, fn (Builder $query) => $scope($query))
            ->orderByDesc('k.received_at')
            ->get(['k.*', 's.name as sede', 'c.code as client_code', 'c.name as client', 'r.code as reservation', 'u.name as owner']);
        $events = DB::table('crm_case_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.user_id')->whereIn('e.case_id', $rows->pluck('id'))->orderBy('e.created_at')
            ->get(['e.case_id', 'e.message', 'e.created_at', 'u.name'])->groupBy('case_id');

        return $rows->map(fn ($row): array => $this->present($row, $events->get($row->id, collect()), (int) $settings->alert_days, $today));
    }

    private function kpis(Collection $claims, Carbon $today): array
    {
        $answered = $claims->filter(fn (array $claim): bool => $claim['response'] !== null && $claim['response']['answered_at'] !== null);
        $month = $today->format('Y-m');

        return [
            'month' => $claims->filter(fn (array $claim): bool => str_starts_with((string) $claim['received_on'], $month))->count(),
            'open' => $claims->whereIn('book_status', ['received', 'in_review'])->count(),
            'due_soon' => $claims->where('deadline', 'por_vencer')->count(),
            'overdue' => $claims->where('deadline', 'vencido')->count(),
            'avg_days' => $answered->isEmpty() ? null : round($answered->avg('business_days_to_answer'), 1),
            'on_time_pct' => $answered->isEmpty() ? null : (int) round($answered->where('deadline', 'respondido_en_plazo')->count() / $answered->count() * 100),
        ];
    }

    private function holidays(Carbon $today): Collection
    {
        return DB::table('sys_holidays')->where('date', '>=', $today->copy()->startOfYear()->toDateString())->orderBy('date')->get(['date', 'name'])
            ->map(fn (object $row): array => ['date' => substr((string) $row->date, 0, 10), 'name' => (string) $row->name])->values();
    }

    private function today(): Carbon
    {
        return Carbon::now($this->context->timezone())->startOfDay();
    }

    private function present(object $row, Collection $events, int $alertDays, Carbon $today): array
    {
        $response = $row->response ? json_decode((string) $row->response, true) : null;
        $consumer = $row->consumer ? json_decode((string) $row->consumer, true) : [];
        $good = $row->good ? json_decode((string) $row->good, true) : null;
        $due = $row->due_date ? Carbon::parse($row->due_date) : null;
        $received = Carbon::parse($row->received_at ?? $row->created_at)->setTimezone($this->context->timezone());
        $answeredAt = $response && ($response['sent_at'] ?? $response['answered_at'] ?? null) ? Carbon::parse($response['sent_at'] ?? $response['answered_at'])->setTimezone($this->context->timezone()) : null;
        $left = $due ? $this->days->between($today, $due) : null;

        $deadline = match (true) {
            $answeredAt !== null => $due && $answeredAt->copy()->startOfDay()->gt($due) ? 'respondido_fuera_de_plazo' : 'respondido_en_plazo',
            $row->book_status === 'closed' => 'respondido_en_plazo',
            $left !== null && $left < 0 => 'vencido',
            $left !== null && $left <= $alertDays => 'por_vencer',
            default => 'en_plazo',
        };

        return [
            'code' => $row->code,
            'book_number' => $row->book_number,
            'lock_version' => (int) $row->lock_version,
            'type_code' => $row->type_code,
            'type' => self::TYPES[$row->type_code] ?? ucfirst((string) $row->type_code),
            'priority' => $row->priority,
            'subject' => $row->subject,
            'detail' => $row->detail ?? $row->description,
            'request' => $row->request,
            'sede' => $row->sede,
            'sede_id' => $row->sede_id,
            'channel' => $row->channel,
            'channel_label' => self::CHANNELS[$row->channel] ?? $row->channel,
            'book_status' => $row->book_status,
            'book_status_label' => self::BOOK_STATUS[$row->book_status] ?? $row->book_status,
            'consumer' => ClaimConsumer::read($consumer),
            'good' => $good ? ['kind' => $good['kind'] ?? 'Servicio', 'description' => $good['description'] ?? '', 'amount' => (float) ($good['amount'] ?? 0), 'currency' => $good['currency'] ?? 'PEN'] : null,
            'received_at' => $row->received_at,
            'received_on' => $received->toDateString(),
            'due_date' => $row->due_date,
            'days_left' => $left,
            'deadline' => $deadline,
            'business_days_to_answer' => $answeredAt ? $this->days->between($received, $answeredAt) : null,
            'response' => $response ? [
                'decision' => $response['decision'] ?? null,
                'text' => $response['text'] ?? null,
                'actions' => $response['actions'] ?? null,
                'answered_at' => $response['answered_at'] ?? null,
                'sent_at' => $response['sent_at'] ?? null,
                'sent_to' => $response['sent_to'] ?? null,
            ] : null,
            'close_note' => $row->close_note,
            'closed_at' => $row->closed_at,
            'client' => $row->client_code ? ['code' => $row->client_code, 'name' => $row->client] : null,
            'reservation' => $row->reservation,
            'owner' => $row->owner,
            'log' => $events->map(fn ($event): array => ['message' => $event->message, 'at' => $event->created_at, 'by' => $event->name ?? 'Consumidor'])->values(),
        ];
    }

    private function sequences(Carbon $today): array
    {
        return DB::table('iam_sedes')->orderBy('code')->get(['id', 'name'])->map(function (object $sede) use ($today): array {
            $prefix = 'LR-'.ClaimBookWorkflow::sedePrefix($sede->name).'-'.$today->year.'-';
            $numbers = DB::table('crm_cases')->where('is_book', true)->where('book_number', 'like', $prefix.'%')->pluck('book_number');
            $last = $numbers->map(fn (string $number): int => (int) substr($number, strlen($prefix)))->max();

            return [
                'sede' => $sede->name,
                'year_count' => $numbers->count(),
                'last' => $last ? $prefix.str_pad((string) $last, 6, '0', STR_PAD_LEFT) : null,
                'next' => $prefix.str_pad((string) (((int) $last) + 1), 6, '0', STR_PAD_LEFT),
            ];
        })->values()->all();
    }

    private function group(Collection $claims, string $field): array
    {
        return $claims->groupBy($field)->map(fn (Collection $items, string $label): array => ['label' => $label ?: 'Sin dato', 'count' => $items->count()])->sortByDesc('count')->values()->all();
    }
}
