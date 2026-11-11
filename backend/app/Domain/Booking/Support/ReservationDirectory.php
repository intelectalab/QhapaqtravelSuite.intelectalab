<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Booking\Actions\ReservationChanges;
use App\Domain\Booking\Actions\ReservationLifecycle;
use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Support\NetSales;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReservationDirectory
{
    private const SORTS = [
        'travel_from' => 'r.travel_from',
        'code' => 'r.code',
        'created_at' => 'r.created_at',
        'total' => 'r.total_amount',
    ];

    private const PENDING = ['pendiente_pago', 'pendiente_proveedor'];

    public function __construct(private readonly TenantContext $context) {}

    public function list(User $viewer, Request $request): array
    {
        $filters = CursorPage::filters($request);
        $scoped = $this->byOwner($this->rows($viewer), $viewer, $filters['owner'] ?? null);
        $query = $this->filtered($this->withCounts(clone $scoped), $filters);
        $today = $this->today();

        return CursorPage::respond($request, $query, self::SORTS, 'travel_from,code', function (object $row) use ($viewer): array {
            $view = $this->view($viewer, $row->owner_id);

            return [
                ...$this->summary($row, $view),
                'passengers' => (int) $row->passengers_count,
                ...($view['price'] ? ['balance_pen' => (int) round((float) $row->balance_pen)] : []),
                'open_incidents' => (int) $row->open_incidents,
            ];
        }, [
            'kpis' => $this->kpis($scoped, $today),
            'can' => ['modify' => $viewer->can('reservations.modify'), 'cancel' => $viewer->can('reservations.cancel') || $viewer->can('reservations.create'), 'create' => $viewer->can('reservations.create')],
            'view' => $this->view($viewer, Portfolio::ownOnly($viewer) ? (string) $viewer->getKey() : null),
            'today' => $today,
        ]);
    }

    public function kpisFor(User $viewer, Request $request): array
    {
        $filters = CursorPage::filters($request);

        return $this->kpis($this->byOwner($this->rows($viewer), $viewer, $filters['owner'] ?? null), $this->today());
    }

    public function history(User $viewer, Request $request, string $code): ?array
    {
        $row = $this->rows($viewer)->where('r.code', $code)->first(['r.id', 'r.code']);

        if ($row === null) {
            return null;
        }

        $services = DB::table('booking_reservation_services')->where('reservation_id', $row->id)->pluck('code')->all();
        $receivables = DB::table('fin_receivables')->where('reservation_id', $row->id)->pluck('code')->all();
        $query = DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->where(fn (Builder $where): Builder => $where->where(fn (Builder $own): Builder => $own->where('e.entity', 'Reserva')->where('e.entity_id', $row->code))
                ->orWhere(fn (Builder $service): Builder => $service->where('e.entity', 'Servicio reserva')->whereIn('e.entity_id', $services ?: ['']))
                ->orWhere(fn (Builder $receivable): Builder => $receivable->where('e.entity', 'Cuenta por cobrar')->whereIn('e.entity_id', $receivables ?: [''])))
            ->select(['e.id', 'e.code', 'e.entity', 'e.entity_id', 'e.action', 'e.before_value', 'e.after_value', 'e.actor_type', 'e.occurred_at', 'u.name as actor_name']);

        return CursorPage::respond($request, $query, ['occurred_at' => 'e.occurred_at'], '-occurred_at', fn (object $event): array => [
            'id' => $event->id,
            'code' => $event->code,
            'entity' => $event->entity,
            'entity_id' => $event->entity_id,
            'action' => $event->action,
            'before' => $event->before_value,
            'after' => $event->after_value,
            'actor' => $event->actor_name ?? ($event->actor_type === 'system' ? 'Sistema' : null),
            'occurred_at' => $event->occurred_at,
        ]);
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->rows($viewer)->where('r.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $view = $this->view($viewer, $row->owner_id);
        $today = $this->today();
        $services = DB::table('booking_reservation_services as s')->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->where('s.reservation_id', $row->id)->orderBy('s.service_date')->orderBy('s.service_time')
            ->get(['s.code', 's.name', 's.service_date', 's.service_time', 's.service_kind', 's.status', 's.confirmation_code', 's.reject_reason', 's.replaced_by_id', 's.cost_amount', 's.price_amount', 's.currency', 's.fx_rate', 'p.name as provider_name', 'p.status as provider_status']);
        $price = $services->where('status', '<>', 'cancelado')->sum(fn (object $service) => (float) (string) NetSales::of($service->price_amount, $service->currency));
        $cost = $services->where('status', '<>', 'cancelado')->sum(fn (object $service) => (float) $service->cost_amount);
        $receivables = DB::table('fin_receivables')->where('reservation_id', $row->id)->whereNull('deleted_at')->orderBy('due_date')
            ->get(['code', 'kind', 'concept', 'amount', 'paid_amount', 'currency', 'due_date', 'status']);
        $order = DB::table('ops_orders')->where('reservation_id', $row->id)->whereNull('deleted_at')->value('code');
        $closed = ReservationStatus::from((string) $row->status)->isClosed();
        $modify = $viewer->can('reservations.modify') && ! $closed;

        return [
            ...$this->summary($row, $view),
            'lock_version' => (int) $row->lock_version,
            'view' => $view,
            'today' => $today,
            'notes' => $row->notes,
            'sede' => $row->sede_name,
            'quote' => $row->quote_id ? DB::table('quote_quotes')->where('id', $row->quote_id)->first(['code', 'title']) : null,
            'cancel_reason' => $row->cancel_reason,
            ...($view['margin'] ? ['margin_pct' => $price > 0 ? round(($price - $cost) / $price * 100, 1) : null, 'economics' => ['sale_net' => round($price, 2), 'cost' => round($cost, 2), 'profit' => round($price - $cost, 2)]] : []),
            'passengers' => DB::table('booking_passengers')->where('reservation_id', $row->id)->orderBy('seq')
                ->get(['id', 'full_name', 'doc_type', 'doc_number', 'pax_type', 'nationality', 'birth_date', 'age', 'phone', 'email', 'diet_notes', 'relationship', 'is_lead', 'is_placeholder']),
            'owner_id' => $row->owner_id,
            'order' => $order,
            'can' => [
                'modify' => $viewer->can('reservations.modify'),
                'cancel' => $viewer->can('reservations.cancel'),
                'request_cancel' => $viewer->can('reservations.create') && ! $viewer->can('reservations.cancel') && $row->owner_id === $viewer->getKey(),
                'reassign' => $viewer->can('crm.records.reassign') && ! $closed,
                'approve_changes' => $viewer->can('quotes.approve_internal'),
                'confirm' => $modify && in_array($row->status, ReservationLifecycle::CONFIRMABLE, true),
                'start_operation' => $modify && in_array($row->status, ReservationLifecycle::STARTABLE, true) && (string) $row->travel_from <= Carbon::parse($today)->addDay()->toDateString(),
                'complete' => $modify && $row->status === ReservationStatus::EnOperacion->value,
                'services' => $modify,
                'generate_receivables' => $viewer->can('finance.receivables') && $row->status !== ReservationStatus::Cancelada->value && $receivables->where('status', '<>', 'cancelada')->isEmpty(),
                'operation_order' => $viewer->can('operations.view') && $order === null && in_array($row->status, ReservationLifecycle::ORDERABLE, true),
            ],
            'reject_reasons' => $modify ? ProviderServiceResponse::REJECT_REASONS : [],
            'changes' => app(ReservationChanges::class)->pending($row->id),
            'cancel_request' => DB::table('booking_cancel_requests')->where('reservation_id', $row->id)->where('status', 'pendiente')->first(['id', 'reason', 'requested_at']),
            'cancellation' => DB::table('booking_cancellations')->where('reservation_id', $row->id)->first($view['price'] ? ['penalty_amount', 'refund_amount', 'owed_amount', 'cancelled_at'] : ['cancelled_at']),
            'services' => $services->map(fn (object $service) => [
                'code' => $service->code,
                'name' => $service->name,
                'date' => $service->service_date,
                'time' => $service->service_time ? substr($service->service_time, 0, 5) : null,
                'kind' => $service->service_kind,
                'status' => $service->status,
                'confirmation' => $service->confirmation_code,
                'reject_reason' => $service->reject_reason,
                'replaced' => $service->replaced_by_id !== null,
                'provider' => $service->provider_name ? ['name' => $service->provider_name, 'active' => $service->provider_status === 'activo'] : null,
                ...($view['price'] ? ['price' => $service->price_amount] : []),
                ...($view['cost'] ? ['cost' => $service->cost_amount] : []),
                'currency' => $service->currency,
            ]),
            ...($view['price'] ? ['receivables' => $receivables] : []),
            'incidents' => DB::table('ops_incidents')->where('reservation_id', $row->id)->orderByDesc('created_at')
                ->get(['code', 'title', 'type', 'severity', 'status', 'created_at']),
            'vouchers' => $viewer->can('operations.view')
                ? DB::table('ops_vouchers')->where('reservation_id', $row->id)->where('status', '<>', 'anulado')->orderBy('service_date')->get(['code', 'service_label as label', 'service_date as date', 'status', 'version'])
                : [],
            'history' => DB::table('audit_events')->where('entity', 'Reserva')->where('entity_id', $row->code)->orderByDesc('occurred_at')->limit(20)->get(['action', 'before_value', 'after_value', 'occurred_at']),
            ...app(ReservationSections::class)->extras($row, $view, $viewer),
        ];
    }

    public function section(User $viewer, string $code, string $section): ?array
    {
        $row = $this->rows($viewer)->where('r.code', $code)->first(['r.id', 'r.owner_id']);

        if ($row === null) {
            return null;
        }

        $sections = app(ReservationSections::class);

        return ['data' => match ($section) {
            'web-snapshot' => $sections->webSnapshot($row->id, $this->view($viewer, $row->owner_id)),
            'pax-feedback' => $sections->paxFeedback($row->id),
            'pax-messages' => $sections->paxMessages($row->id),
            default => null,
        }];
    }

    public function view(User $viewer, ?string $ownerId): array
    {
        $operations = $viewer->can('operations.view');
        $margin = $viewer->can('finance.profitability') || Portfolio::owns($viewer, $ownerId);
        $opsView = $operations && ! $margin;

        return [
            'mode' => $margin ? 'full' : ($opsView ? 'operations' : 'amounts'),
            'margin' => $margin,
            'cost' => $margin || $operations,
            'price' => $margin || ! $operations,
        ];
    }

    private function rows(User $viewer): Builder
    {
        return Portfolio::scope(DB::table('booking_reservations as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->join('iam_users as u', 'u.id', '=', 'r.owner_id')
            ->leftJoin('iam_sedes as s', 's.id', '=', 'r.sede_id')
            ->select(['r.*', 'c.code as client_code', 'c.name as client_name', 'u.name as owner_name', 'u.avatar_color as owner_color', 's.name as sede_name']);
    }

    private function withCounts(Builder $query): Builder
    {
        return $query
            ->selectSub(DB::table('booking_passengers as bp')->whereColumn('bp.reservation_id', 'r.id')->selectRaw('count(*)'), 'passengers_count')
            ->selectSub(DB::table('ops_incidents as oi')->whereColumn('oi.reservation_id', 'r.id')->whereNotIn('oi.status', ['resuelta', 'cerrada'])->selectRaw('count(*)'), 'open_incidents')
            ->selectSub(DB::table('fin_receivables as fr')->whereColumn('fr.reservation_id', 'r.id')->whereNull('fr.deleted_at')->whereNotIn('fr.status', ['pagada', 'cancelada'])
                ->selectRaw('coalesce(sum((fr.amount - fr.paid_amount) * coalesce(nullif(fr.fx_rate, 0), 1)), 0)'), 'balance_pen');
    }

    private function byOwner(Builder $query, User $viewer, ?string $owner): Builder
    {
        if ($owner === null || Portfolio::ownOnly($viewer)) {
            return $query;
        }

        $ownerId = $owner === 'me' ? (string) $viewer->getKey() : $owner;

        return Str::isUuid($ownerId) ? $query->where('r.owner_id', $ownerId) : $query->whereRaw('false');
    }

    private function filtered(Builder $query, array $filters): Builder
    {
        if (isset($filters['status'])) {
            $statuses = array_values(array_filter(array_map('trim', explode(',', $filters['status']))));
            $unknown = array_diff($statuses, ReservationStatus::values());

            if ($unknown !== []) {
                throw ApiException::unprocessable('FILTER_INVALID', 'filter[status] admite: '.implode(', ', ReservationStatus::values()).'.');
            }

            $query->whereIn('r.status', $statuses);
        }

        if (isset($filters['channel'])) {
            $query->whereIn('r.channel', array_map('trim', explode(',', $filters['channel'])));
        }

        if (isset($filters['q'])) {
            $term = '%'.mb_strtolower($filters['q']).'%';
            $query->where(fn (Builder $where): Builder => $where->whereRaw('lower(r.code) like ?', [$term])
                ->orWhereRaw('lower(r.title) like ?', [$term])
                ->orWhereRaw('lower(c.name) like ?', [$term]));
        }

        return $query;
    }

    private function kpis(Builder $scoped, string $today): array
    {
        $rows = (clone $scoped)->get(['r.id', 'r.status', 'r.travel_from', 'r.travel_to']);
        $traveling = $rows->filter(fn (object $row): bool => $row->status !== ReservationStatus::Cancelada->value && (string) $row->travel_from <= $today && (string) $row->travel_to >= $today);

        return [
            'confirmed' => $rows->where('status', ReservationStatus::Confirmada->value)->count(),
            'in_operation' => $rows->where('status', ReservationStatus::EnOperacion->value)->count(),
            'pending' => $rows->whereIn('status', self::PENDING)->count(),
            'traveling_pax' => $traveling->isEmpty() ? 0 : DB::table('booking_passengers')->whereIn('reservation_id', $traveling->pluck('id')->all())->count(),
            'total' => $rows->count(),
        ];
    }

    private function summary(object $row, array $view): array
    {
        return [
            'code' => $row->code,
            'title' => $row->title,
            'status' => $row->status,
            'channel' => $row->channel,
            'travel_from' => $row->travel_from,
            'travel_to' => $row->travel_to,
            ...($view['price'] ? ['total' => $row->total_amount, 'total_pen' => (int) round((float) $row->total_amount * (float) $row->fx_rate)] : []),
            'currency' => $row->currency,
            'client' => ['code' => $row->client_code, 'name' => $row->client_name],
            'owner' => ['name' => $row->owner_name, 'color' => $row->owner_color],
        ];
    }

    private function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }
}
