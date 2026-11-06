<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Actions\ReservationChanges;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ReservationDirectory
{
    public function __construct(private readonly TenantContext $context) {}

    public function list(User $viewer): array
    {
        $rows = $this->rows($viewer)->orderBy('r.travel_from')->get();
        $ids = $rows->pluck('id');
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $ids)->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
        $balances = $this->balances($ids);
        $incidents = DB::table('ops_incidents')->whereIn('reservation_id', $ids)->whereNotIn('status', ['resuelta', 'cerrada'])->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');

        return [
            'today' => $this->today(),
            'can' => ['modify' => $viewer->can('reservations.modify'), 'cancel' => $viewer->can('reservations.cancel') || $viewer->can('reservations.create')],
            'view' => $this->view($viewer, Portfolio::ownOnly($viewer) ? (string) $viewer->getKey() : null),
            'items' => $rows->map(function (object $row) use ($viewer, $passengers, $balances, $incidents): array {
                $view = $this->view($viewer, $row->owner_id);

                return [
                    ...$this->summary($row, $view),
                    'passengers' => (int) ($passengers[$row->id] ?? 0),
                    ...($view['price'] ? ['balance_pen' => (int) round($balances[$row->id] ?? 0)] : []),
                    'open_incidents' => (int) ($incidents[$row->id] ?? 0),
                ];
            })->values(),
        ];
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->rows($viewer)->where('r.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $view = $this->view($viewer, $row->owner_id);
        $services = DB::table('booking_reservation_services')->where('reservation_id', $row->id)->orderBy('service_date')->orderBy('service_time')
            ->get(['code', 'name', 'service_date', 'service_time', 'service_kind', 'status', 'confirmation_code', 'cost_amount', 'price_amount', 'currency', 'fx_rate']);
        $price = $services->where('status', '<>', 'cancelado')->sum(fn (object $service) => (float) $service->price_amount);
        $cost = $services->where('status', '<>', 'cancelado')->sum(fn (object $service) => (float) $service->cost_amount);

        return [
            ...$this->summary($row, $view),
            'view' => $view,
            'today' => $this->today(),
            'notes' => $row->notes,
            'sede' => $row->sede_name,
            'quote' => $row->quote_id ? DB::table('quote_quotes')->where('id', $row->quote_id)->first(['code', 'title']) : null,
            'cancel_reason' => $row->cancel_reason,
            ...($view['margin'] ? ['margin_pct' => $price > 0 ? round(($price - $cost) / $price * 100, 1) : null] : []),
            'passengers' => DB::table('booking_passengers')->where('reservation_id', $row->id)->orderBy('seq')
                ->get(['id', 'full_name', 'doc_type', 'doc_number', 'pax_type', 'nationality', 'birth_date', 'age', 'phone', 'email', 'diet_notes', 'relationship', 'is_lead', 'is_placeholder']),
            'owner_id' => $row->owner_id,
            'can' => [
                'modify' => $viewer->can('reservations.modify'),
                'cancel' => $viewer->can('reservations.cancel'),
                'request_cancel' => $viewer->can('reservations.create') && ! $viewer->can('reservations.cancel') && $row->owner_id === $viewer->getKey(),
                'reassign' => $viewer->can('crm.records.reassign'),
                'approve_changes' => $viewer->can('quotes.approve_internal'),
            ],
            'changes' => app(ReservationChanges::class)->pending($row->id),
            'cancel_request' => DB::table('booking_cancel_requests')->where('reservation_id', $row->id)->where('status', 'pendiente')->first(['reason', 'requested_at']),
            'cancellation' => DB::table('booking_cancellations')->where('reservation_id', $row->id)->first($view['price'] ? ['penalty_amount', 'refund_amount', 'owed_amount', 'cancelled_at'] : ['cancelled_at']),
            'services' => $services->map(fn (object $service) => [
                'code' => $service->code,
                'name' => $service->name,
                'date' => $service->service_date,
                'time' => $service->service_time ? substr($service->service_time, 0, 5) : null,
                'kind' => $service->service_kind,
                'status' => $service->status,
                'confirmation' => $service->confirmation_code,
                ...($view['price'] ? ['price' => $service->price_amount] : []),
                ...($view['cost'] ? ['cost' => $service->cost_amount] : []),
                'currency' => $service->currency,
            ]),
            ...($view['price'] ? ['receivables' => DB::table('fin_receivables')->where('reservation_id', $row->id)->whereNull('deleted_at')->orderBy('due_date')
                ->get(['code', 'concept', 'amount', 'paid_amount', 'currency', 'due_date', 'status'])] : []),
            'incidents' => DB::table('ops_incidents')->where('reservation_id', $row->id)->orderByDesc('created_at')
                ->get(['code', 'title', 'type', 'severity', 'status', 'created_at']),
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

    private function balances(Collection $ids): Collection
    {
        return DB::table('fin_receivables')->whereIn('reservation_id', $ids)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])
            ->get(['reservation_id', 'amount', 'paid_amount', 'fx_rate'])
            ->groupBy('reservation_id')
            ->map(fn (Collection $items) => $items->sum(fn (object $item) => ((float) $item->amount - (float) $item->paid_amount) * (float) ($item->fx_rate ?: 1)));
    }

    private function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }
}
