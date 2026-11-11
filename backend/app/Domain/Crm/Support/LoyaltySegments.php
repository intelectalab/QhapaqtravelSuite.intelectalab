<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class LoyaltySegments
{
    public const ORIGIN = 'fidelizacion';

    public const SUGGESTIONS = [
        'Cusco' => 'Arequipa y Cañón del Colca',
        'Arequipa' => 'Cusco y Machu Picchu',
        'Ica' => 'Cusco y Valle Sagrado',
        'Machu Picchu' => 'Lago Titicaca — Puno',
        'Puno' => 'Paracas e Islas Ballestas',
    ];

    public const DEFAULT_SUGGESTION = 'Cusco y Machu Picchu';

    public const DEFAULT_AMOUNT = 4000;

    public const RECENCY = ['30' => 'Últimos 30 días', '90' => 'Hace más de 90 días', '180' => 'Hace más de 180 días', 'none' => 'Sin compras'];

    private const OPEN_STAGES = ['calificacion', 'descubrimiento', 'cotizacion', 'negociacion'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly Advisors $advisors,
        private readonly AuditLogger $audit,
    ) {}

    public function rows(User $viewer, array $filters = []): Collection
    {
        $today = Carbon::now($this->context->timezone())->startOfDay();
        $clients = Portfolio::scope(DB::table('crm_clients as c'), $viewer, 'c.owner_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'c.owner_id')
            ->whereNull('c.deleted_at')
            ->orderBy('c.name')
            ->get(['c.id', 'c.code', 'c.name', 'c.segment_code', 'c.owner_id', 'c.nps_last', 'u.name as owner_name']);
        $ids = $clients->pluck('id')->all();
        $sales = $this->sales($ids);
        $destinations = $this->destinations($ids);
        $surveys = $this->latestSurveys($ids);
        $open = $this->openOpportunities($ids);

        $rows = $clients->map(fn (object $client): array => $this->row($client, $sales->get($client->id), $destinations->get($client->id, []), $surveys->get($client->id), $open->get($client->id, collect()), $today, $viewer));

        return $rows->filter(fn (array $row): bool => $this->matches($row, $filters))->values();
    }

    public function proposal(User $viewer, string $code): array
    {
        $row = $this->rows($viewer)->firstWhere('code', $code) ?? throw Portfolio::missing($viewer, 'crm_clients', $code, 'El cliente no existe.', 'Este cliente');

        return [
            'client' => ['code' => $row['code'], 'name' => $row['name']],
            'proposal' => $row['proposal'],
            'open_opportunities' => $row['open_opportunities'],
        ];
    }

    public function guard(object $client, array $data): void
    {
        $open = DB::table('crm_opportunities')->where('client_id', $client->id)->whereNull('deleted_at')->whereIn('stage', self::OPEN_STAGES)->pluck('code');

        if ($open->isNotEmpty() && ! ($data['confirm_open'] ?? false)) {
            throw ApiException::conflict('CRM-BR-45', 'El cliente ya tiene '.$open->count().' '.($open->count() === 1 ? 'oportunidad abierta' : 'oportunidades abiertas').' ('.$open->implode(', ').'). Confirma que quieres crear otra de recompra.');
        }
    }

    public function record(string $clientCode, string $opportunityCode): void
    {
        $this->audit->log('Cliente', $clientCode, 'accion_fidelizacion', null, "oportunidad {$opportunityCode}");
    }

    private function row(object $client, ?object $sales, array $destinations, ?int $survey, Collection $open, Carbon $today, User $viewer): array
    {
        $count = (int) ($sales->purchases ?? 0);
        $total = (float) ($sales->total_pen ?? 0);
        $last = $sales?->last_purchase_at ? Carbon::parse($sales->last_purchase_at)->setTimezone($this->context->timezone())->startOfDay() : null;
        $average = $count > 0 ? $total / $count : 0.0;
        $nps = $survey ?? ($client->nps_last === null ? null : (int) $client->nps_last);
        $suggestion = collect(self::SUGGESTIONS)->first(fn (string $next, string $place): bool => in_array($place, $destinations, true)) ?? self::DEFAULT_SUGGESTION;
        $owner = Portfolio::ownOnly($viewer) ? (string) $viewer->getKey() : ($client->owner_id && $this->advisors->has($client->owner_id) ? $client->owner_id : (string) $viewer->getKey());

        return [
            'code' => $client->code,
            'name' => $client->name,
            'segment' => $client->segment_code,
            'owner' => $client->owner_name,
            'last_purchase_date' => $last?->toDateString(),
            'days_since' => $last ? (int) $last->diffInDays($today) : null,
            'destinations' => $destinations,
            'purchases' => $count,
            'total_pen' => (int) round($total),
            'average_pen' => (int) round($average),
            'nps' => $nps,
            'has_open_opportunity' => $open->isNotEmpty(),
            'open_opportunities' => $open->values()->all(),
            'proposal' => [
                'title' => "Recompra — {$client->name} — {$suggestion}",
                'destination' => $suggestion,
                'amount' => $average > 0 ? (int) round($average) : self::DEFAULT_AMOUNT,
                'currency' => 'PEN',
                'stage' => 'calificacion',
                'expected_close_date' => $today->copy()->addDays(30)->toDateString(),
                'owner_id' => $owner,
                'notes' => 'Campaña de fidelización (PROC-010). Última compra: '.($last ? $last->format('d/m/Y') : 'sin compras').'. Destinos previos: '.($destinations === [] ? '—' : implode(', ', $destinations)).'.',
            ],
        ];
    }

    private function matches(array $row, array $filters): bool
    {
        $segment = (string) ($filters['segment'] ?? '');
        $recency = (string) ($filters['last_purchase'] ?? '');
        $destination = (string) ($filters['destination'] ?? '');
        $days = $row['days_since'];

        return ($segment === '' || $row['segment'] === $segment)
            && ($destination === '' || in_array($destination, $row['destinations'], true))
            && match ($recency) {
                '' => true,
                'none' => $days === null,
                '30' => $days !== null && $days <= 30,
                '90', '180' => $days !== null && $days > (int) $recency,
                default => true,
            };
    }

    private function sales(array $ids): Collection
    {
        return DB::table('booking_reservations')->whereIn('client_id', $ids)->whereNull('deleted_at')->whereIn('status', ClientDirectory::COUNTED)
            ->groupBy('client_id')
            ->selectRaw('client_id, count(*) as purchases, coalesce(sum(total_amount * coalesce(nullif(fx_rate, 0), 1)), 0) as total_pen, max(created_at) as last_purchase_at')
            ->get()->keyBy('client_id');
    }

    private function destinations(array $ids): Collection
    {
        $reserved = DB::table('booking_reservations as r')
            ->join('booking_reservation_services as s', 's.reservation_id', '=', 'r.id')
            ->join('catalog_products as p', 'p.id', '=', 's.product_id')
            ->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->whereIn('r.client_id', $ids)->whereNull('r.deleted_at')->where('r.status', '<>', 'cancelada')
            ->distinct()
            ->selectRaw("r.client_id, coalesce(nullif(split_part(d.path, ' / ', 3), ''), d.name) as place")
            ->get();
        $won = DB::table('crm_opportunities')->whereIn('client_id', $ids)->whereNull('deleted_at')->where('stage', 'ganada')->whereNotNull('destination_label')
            ->get(['client_id', 'destination_label'])
            ->flatMap(fn (object $row): array => collect(explode('/', (string) $row->destination_label))->map(fn (string $place): string => trim($place))->filter(fn (string $place): bool => $place !== '' && $place !== 'Varios')->map(fn (string $place): object => (object) ['client_id' => $row->client_id, 'place' => $place])->all());

        return $reserved->concat($won)->groupBy('client_id')->map(fn (Collection $places): array => $places->pluck('place')->unique()->sort()->values()->all());
    }

    private function latestSurveys(array $ids): Collection
    {
        return DB::table('crm_surveys')->whereIn('client_id', $ids)->orderByDesc('responded_at')->get(['client_id', 'score'])
            ->unique('client_id')->mapWithKeys(fn (object $row): array => [$row->client_id => (int) $row->score]);
    }

    private function openOpportunities(array $ids): Collection
    {
        return DB::table('crm_opportunities')->whereIn('client_id', $ids)->whereNull('deleted_at')->whereIn('stage', self::OPEN_STAGES)->orderBy('code')
            ->get(['client_id', 'code', 'title', 'stage'])
            ->groupBy('client_id')
            ->map(fn (Collection $items): Collection => $items->map(fn (object $item): array => ['code' => $item->code, 'title' => $item->title, 'stage' => $item->stage]));
    }
}
