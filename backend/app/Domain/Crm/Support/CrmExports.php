<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;

final class CrmExports
{
    public const MAX_ROWS = 50000;

    public const FORMATS = ['CSV', 'XLSX'];

    public const RESOURCES = [
        'crm.leads' => ['key' => 'crm_leads', 'title' => 'Leads', 'permissions' => ['crm.leads.view']],
        'crm.opportunities' => ['key' => 'crm_oportunidades', 'title' => 'Oportunidades', 'permissions' => ['crm.opportunities.manage']],
        'crm.clients' => ['key' => 'crm_clientes', 'title' => 'Clientes', 'permissions' => ['crm.clients.manage', 'finance.receivables']],
        'crm.cases' => ['key' => 'crm_casos', 'title' => 'Casos de postventa', 'permissions' => ['crm.clients.manage']],
        'crm.loyalty_segments' => ['key' => 'crm_fidelizacion', 'title' => 'Segmentos de fidelización', 'permissions' => ['crm.clients.manage']],
    ];

    public const FILTERS = [
        'crm.leads' => ['status', 'source', 'channel', 'interest', 'owner', 'q'],
        'crm.opportunities' => ['stage', 'client', 'q'],
        'crm.clients' => ['kind', 'segment', 'q'],
        'crm.cases' => ['status', 'type', 'q'],
        'crm.loyalty_segments' => ['segment', 'last_purchase', 'destination'],
    ];

    private const FILTER_LABELS = [
        'status' => 'estado',
        'source' => 'fuente',
        'channel' => 'canal',
        'interest' => 'interés',
        'owner' => 'responsable',
        'q' => 'búsqueda',
        'stage' => 'etapa',
        'client' => 'cliente',
        'kind' => 'tipo',
        'segment' => 'segmento',
        'type' => 'tipo',
        'last_purchase' => 'última compra',
        'destination' => 'destino',
    ];

    private const COLUMNS = [
        'crm.leads' => [
            ['key' => 'code', 'label' => 'Código', 'format' => 'text'],
            ['key' => 'name', 'label' => 'Nombre', 'format' => 'text'],
            ['key' => 'company', 'label' => 'Empresa', 'format' => 'text'],
            ['key' => 'email', 'label' => 'Correo', 'format' => 'text'],
            ['key' => 'phone', 'label' => 'Teléfono', 'format' => 'text'],
            ['key' => 'source', 'label' => 'Fuente', 'format' => 'text'],
            ['key' => 'channel', 'label' => 'Canal', 'format' => 'text'],
            ['key' => 'interest', 'label' => 'Interés', 'format' => 'text'],
            ['key' => 'destination', 'label' => 'Destino', 'format' => 'text'],
            ['key' => 'travel_date', 'label' => 'Fecha de viaje', 'format' => 'date'],
            ['key' => 'pax', 'label' => 'Pasajeros', 'format' => 'number'],
            ['key' => 'score', 'label' => 'Puntaje', 'format' => 'number'],
            ['key' => 'status', 'label' => 'Estado', 'format' => 'text'],
            ['key' => 'owner', 'label' => 'Responsable', 'format' => 'text'],
            ['key' => 'created_at', 'label' => 'Registrado', 'format' => 'datetime'],
        ],
        'crm.opportunities' => [
            ['key' => 'code', 'label' => 'Código', 'format' => 'text'],
            ['key' => 'title', 'label' => 'Oportunidad', 'format' => 'text'],
            ['key' => 'client', 'label' => 'Cliente', 'format' => 'text'],
            ['key' => 'stage', 'label' => 'Etapa', 'format' => 'text'],
            ['key' => 'amount', 'label' => 'Monto', 'format' => 'text'],
            ['key' => 'amount_pen', 'label' => 'Monto en soles', 'format' => 'money'],
            ['key' => 'probability', 'label' => 'Probabilidad', 'format' => 'percent'],
            ['key' => 'expected_close_date', 'label' => 'Cierre previsto', 'format' => 'date'],
            ['key' => 'destination', 'label' => 'Destino', 'format' => 'text'],
            ['key' => 'pax', 'label' => 'Pasajeros', 'format' => 'number'],
            ['key' => 'owner', 'label' => 'Responsable', 'format' => 'text'],
            ['key' => 'updated_at', 'label' => 'Última actualización', 'format' => 'datetime'],
        ],
        'crm.clients' => [
            ['key' => 'code', 'label' => 'Código', 'format' => 'text'],
            ['key' => 'name', 'label' => 'Cliente', 'format' => 'text'],
            ['key' => 'kind', 'label' => 'Tipo', 'format' => 'text'],
            ['key' => 'document', 'label' => 'Documento', 'format' => 'text'],
            ['key' => 'email', 'label' => 'Correo', 'format' => 'text'],
            ['key' => 'phone', 'label' => 'Teléfono', 'format' => 'text'],
            ['key' => 'city', 'label' => 'Ciudad', 'format' => 'text'],
            ['key' => 'country', 'label' => 'País', 'format' => 'text'],
            ['key' => 'segment', 'label' => 'Segmento', 'format' => 'text'],
            ['key' => 'owner', 'label' => 'Responsable', 'format' => 'text'],
            ['key' => 'trips_count', 'label' => 'Viajes', 'format' => 'number'],
            ['key' => 'total_pen', 'label' => 'Compras', 'format' => 'money'],
            ['key' => 'balance_pen', 'label' => 'Saldo por cobrar', 'format' => 'money'],
            ['key' => 'last_purchase_date', 'label' => 'Última compra', 'format' => 'date'],
            ['key' => 'satisfaction', 'label' => 'NPS', 'format' => 'number'],
            ['key' => 'created_at', 'label' => 'Cliente desde', 'format' => 'date'],
        ],
        'crm.cases' => [
            ['key' => 'code', 'label' => 'Código', 'format' => 'text'],
            ['key' => 'type', 'label' => 'Tipo', 'format' => 'text'],
            ['key' => 'priority', 'label' => 'Prioridad', 'format' => 'text'],
            ['key' => 'subject', 'label' => 'Asunto', 'format' => 'text'],
            ['key' => 'status', 'label' => 'Estado', 'format' => 'text'],
            ['key' => 'client', 'label' => 'Cliente', 'format' => 'text'],
            ['key' => 'reservation', 'label' => 'Reserva', 'format' => 'text'],
            ['key' => 'origin', 'label' => 'Origen', 'format' => 'text'],
            ['key' => 'owner', 'label' => 'Responsable', 'format' => 'text'],
            ['key' => 'created_at', 'label' => 'Registrado', 'format' => 'datetime'],
            ['key' => 'resolved_at', 'label' => 'Resuelto', 'format' => 'datetime'],
        ],
        'crm.loyalty_segments' => [
            ['key' => 'code', 'label' => 'Código', 'format' => 'text'],
            ['key' => 'name', 'label' => 'Cliente', 'format' => 'text'],
            ['key' => 'segment', 'label' => 'Segmento', 'format' => 'text'],
            ['key' => 'owner', 'label' => 'Responsable', 'format' => 'text'],
            ['key' => 'last_purchase_date', 'label' => 'Última compra', 'format' => 'date'],
            ['key' => 'days_since', 'label' => 'Días sin comprar', 'format' => 'number'],
            ['key' => 'purchases', 'label' => 'Compras', 'format' => 'number'],
            ['key' => 'total_pen', 'label' => 'Total comprado', 'format' => 'money'],
            ['key' => 'average_pen', 'label' => 'Ticket promedio', 'format' => 'money'],
            ['key' => 'nps', 'label' => 'NPS', 'format' => 'number'],
            ['key' => 'destinations', 'label' => 'Destinos previos', 'format' => 'text'],
            ['key' => 'open_opportunity', 'label' => 'Oportunidad abierta', 'format' => 'text'],
        ],
    ];

    public function __construct(
        private readonly LeadDirectory $leads,
        private readonly OpportunityDirectory $opportunities,
        private readonly ClientDirectory $clients,
        private readonly AfterSalesDirectory $afterSales,
        private readonly LoyaltySegments $loyalty,
    ) {}

    public static function allows(User $user, string $resource): bool
    {
        return collect(self::RESOURCES[$resource]['permissions'] ?? [])->contains(fn (string $permission): bool => $user->can($permission));
    }

    public static function keysFor(User $user): array
    {
        return collect(self::RESOURCES)->filter(fn (array $meta, string $resource): bool => self::allows($user, $resource))->pluck('key')->values()->all();
    }

    public static function resourceFor(string $key): ?string
    {
        return collect(self::RESOURCES)->search(fn (array $meta): bool => $meta['key'] === $key) ?: null;
    }

    public static function filters(string $resource, array $filters): array
    {
        return collect($filters)->only(self::FILTERS[$resource] ?? [])->map(fn (mixed $value): string => trim((string) $value))->filter(fn (string $value): bool => $value !== '')->all();
    }

    public function document(User $viewer, string $resource, array $filters): array
    {
        $filters = self::filters($resource, $filters);
        $rows = $this->rows($viewer, $resource, $filters)->take(self::MAX_ROWS)->values()->all();
        $title = self::RESOURCES[$resource]['title'];

        return [
            'title' => "CRM · {$title}",
            'scope' => Portfolio::ownOnly($viewer) ? 'own' : 'tenant',
            'filters' => ['from' => null, 'to' => null, 'label' => $this->label($filters), 'sede' => null],
            'kpis' => [['label' => 'Registros exportados', 'value' => count($rows), 'format' => 'number', 'hint' => 'Según los filtros y el alcance de tu rol']],
            'table' => ['columns' => self::COLUMNS[$resource], 'rows' => $rows, 'totals' => null],
            'charts' => [],
        ];
    }

    private function rows(User $viewer, string $resource, array $filters): Collection
    {
        return match ($resource) {
            'crm.leads' => $this->leadRows($viewer, $filters),
            'crm.opportunities' => $this->opportunityRows($viewer, $filters),
            'crm.clients' => $this->clientRows($viewer, $filters),
            'crm.cases' => $this->caseRows($viewer, $filters),
            default => $this->loyaltyRows($viewer, $filters),
        };
    }

    private function leadRows(User $viewer, array $filters): Collection
    {
        return $this->leads->list($viewer)
            ->when(isset($filters['status']), fn (Collection $items) => $items->whereIn('status', $this->list($filters['status'])))
            ->when(isset($filters['source']), fn (Collection $items) => $items->where('codes.source', $filters['source']))
            ->when(isset($filters['channel']), fn (Collection $items) => $items->where('codes.channel', $filters['channel']))
            ->when(isset($filters['interest']), fn (Collection $items) => $items->where('codes.interest', $filters['interest']))
            ->when(isset($filters['owner']), fn (Collection $items) => $items->filter(fn (array $lead): bool => $filters['owner'] === 'none' ? $lead['owner_id'] === null : (string) $lead['owner_id'] === $filters['owner']))
            ->when(isset($filters['q']), fn (Collection $items) => $items->filter(fn (array $lead): bool => $this->matches($filters['q'], [$lead['code'], $lead['name'], $lead['company'], $lead['email'], $lead['phone']])))
            ->map(fn (array $lead): array => [
                ...$lead,
                'status' => ucfirst((string) $lead['status']),
                'owner' => $lead['owner']['name'] ?? 'Sin asignar',
            ]);
    }

    private function opportunityRows(User $viewer, array $filters): Collection
    {
        $board = $this->opportunities->board($viewer);
        $stages = collect($board['stages'])->pluck('name', 'code');

        return collect($board['items'])
            ->when(isset($filters['stage']), fn (Collection $items) => $items->whereIn('stage', $this->list($filters['stage'])))
            ->when(isset($filters['client']), fn (Collection $items) => $items->where('client.code', $filters['client']))
            ->when(isset($filters['q']), fn (Collection $items) => $items->filter(fn (array $item): bool => $this->matches($filters['q'], [$item['code'], $item['title'], $item['client']['name'], $item['destination']])))
            ->map(fn (array $item): array => [
                ...$item,
                'client' => $item['client']['name'],
                'stage' => $stages[$item['stage']] ?? $item['stage'],
                'amount' => "{$item['currency']} {$item['amount']}",
                'owner' => $item['owner']['name'],
            ]);
    }

    private function clientRows(User $viewer, array $filters): Collection
    {
        return $this->clients->list($viewer)
            ->when(isset($filters['kind']), fn (Collection $items) => $items->where('kind', $filters['kind']))
            ->when(isset($filters['segment']), fn (Collection $items) => $items->where('segment', $filters['segment']))
            ->when(isset($filters['q']), fn (Collection $items) => $items->filter(fn (array $client): bool => $this->matches($filters['q'], [$client['code'], $client['name'], $client['document'], $client['email'], $client['phone']])))
            ->map(fn (array $client): array => [...$client, 'kind' => ucfirst((string) $client['kind']), 'owner' => $client['owner']['name'] ?? null]);
    }

    private function caseRows(User $viewer, array $filters): Collection
    {
        return $this->afterSales->caseList($viewer)
            ->when(isset($filters['status']), fn (Collection $items) => $items->whereIn('status', $this->list($filters['status'])))
            ->when(isset($filters['type']), fn (Collection $items) => $items->where('type_code', $filters['type']))
            ->when(isset($filters['q']), fn (Collection $items) => $items->filter(fn (array $case): bool => $this->matches($filters['q'], [$case['code'], $case['subject'], $case['client']['name'] ?? null])))
            ->map(fn (array $case): array => [
                ...array_diff_key($case, ['log' => true]),
                'status' => $case['status_label'],
                'priority' => ucfirst((string) $case['priority']),
                'client' => $case['client']['name'] ?? null,
                'owner' => $case['owner']['name'] ?? null,
            ]);
    }

    private function loyaltyRows(User $viewer, array $filters): Collection
    {
        return $this->loyalty->rows($viewer, $filters)->map(fn (array $row): array => [
            ...$row,
            'destinations' => implode(', ', $row['destinations']),
            'open_opportunity' => $row['has_open_opportunity'] ? 'Sí' : 'No',
        ]);
    }

    private function matches(string $search, array $values): bool
    {
        return str_contains(mb_strtolower(implode(' ', array_filter($values))), mb_strtolower($search));
    }

    private function list(string $value): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $value))));
    }

    private function label(array $filters): string
    {
        return $filters === [] ? 'Sin filtros' : 'Filtros: '.collect($filters)->map(fn (mixed $value, string $key): string => (self::FILTER_LABELS[$key] ?? $key)." {$value}")->implode(' · ');
    }
}
