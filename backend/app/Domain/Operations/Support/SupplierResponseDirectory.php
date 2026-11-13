<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SupplierResponseDirectory
{
    public const REVIEW = ['pendiente', 'aceptada', 'rechazada', 'expirada'];

    private const REQUEST_SORTS = ['requested_at' => 'q.requested_at', 'responded_at' => 'q.responded_at', 'service_date' => 's.service_date', 'status' => 'q.status'];

    public function __construct(private readonly OpsCommon $common) {}

    public function requests(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = DB::table('ops_supplier_requests as q')
            ->join('booking_reservation_services as s', 's.id', '=', 'q.reservation_service_id')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->join('catalog_providers as p', 'p.id', '=', 'q.provider_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'q.requested_by')
            ->leftJoin('iam_users as ru', 'ru.id', '=', 'q.responded_by_user_id')
            ->whereNull('q.deleted_at')
            ->whereNull('r.deleted_at')
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->whereIn('q.status', explode(',', $status)))
            ->when($filters['provider'] ?? null, fn ($query, string $provider) => $query->where('p.ref', $provider))
            ->when($filters['reservation'] ?? null, fn ($query, string $code) => $query->where('r.code', $code))
            ->when($filters['service'] ?? null, fn ($query, string $code) => $query->where('s.code', $code))
            ->when($filters['channel'] ?? null, fn ($query, string $channel) => $query->where('q.channel', $channel))
            ->select([
                'q.id', 'q.reservation_service_id', 'q.provider_id', 'q.status', 'q.channel', 'q.requested_at', 'q.responded_at', 'q.response_source', 'q.confirmation_code', 'q.rejection_reason', 'q.note',
                's.code as service_code', 's.name as service_name', 's.service_date', 's.status as service_status', 'r.code as reservation_code', 'r.title as reservation_title',
                'p.ref as provider_ref', 'p.name as provider_name', 'u.name as requested_by', 'ru.name as responded_by',
            ]);

        return CursorPage::respond($request, $query, self::REQUEST_SORTS, '-requested_at', function (object $row): array {
            $responses = DB::table('supplier_request_responses as x')->leftJoin('iam_users as u', 'u.id', '=', 'x.responded_by_user_id')
                ->where('x.supplier_request_id', $row->id)->orderByDesc('x.responded_at')
                ->get(['x.id', 'x.type', 'x.responded_at', 'x.confirmation_code', 'x.rejection_reason', 'x.alt_kind', 'x.alt_date', 'x.alt_net_cost', 'x.currency', 'x.hold_until', 'x.note', 'x.review_status', 'u.name as responded_by']);

            return [
                'id' => $row->id,
                'reservation_service_id' => $row->reservation_service_id,
                'provider_id' => $row->provider_id,
                'status' => $row->status,
                'channel' => $row->channel,
                'requested_at' => $row->requested_at,
                'requested_by' => $row->requested_by,
                'responded_at' => $row->responded_at,
                'responded_by' => $row->responded_by,
                'response_source' => $row->response_source,
                'confirmation_code' => $row->confirmation_code,
                'rejection_reason' => $row->rejection_reason,
                'note' => $row->note,
                'service' => ['code' => $row->service_code, 'name' => $row->service_name, 'date' => $row->service_date, 'status' => $row->service_status],
                'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title],
                'provider' => ['ref' => $row->provider_ref, 'name' => $row->provider_name],
                'responses' => $responses->map(fn (object $response): array => [
                    'id' => $response->id,
                    'type' => $response->type,
                    'responded_at' => $response->responded_at,
                    'responded_by' => $response->responded_by,
                    'confirmation_code' => $response->confirmation_code,
                    'rejection_reason' => $response->rejection_reason,
                    'alternative' => $response->type === 'alternativa' ? ['kind' => $response->alt_kind, 'date' => $response->alt_date, 'net_cost' => $response->alt_net_cost === null ? null : (string) $response->alt_net_cost, 'currency' => $response->currency, 'hold_until' => $response->hold_until, 'review_status' => $response->review_status] : null,
                    'note' => $response->note,
                ])->values(),
            ];
        });
    }

    public function list(User $viewer, array $filters): array
    {
        $type = $filters['type'] ?? 'alternativa';
        $review = $filters['review_status'] ?? ($type === 'alternativa' ? 'pendiente' : null);

        $rows = DB::table('supplier_request_responses as x')
            ->join('booking_reservation_services as s', 's.id', '=', 'x.reservation_service_id')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->join('catalog_providers as p', 'p.id', '=', 'x.provider_id')
            ->leftJoin('catalog_services as c', 'c.id', '=', 'x.alt_service_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'x.responded_by_user_id')
            ->leftJoin('iam_users as ru', 'ru.id', '=', 'x.reviewed_by')
            ->leftJoin('ops_orders as o', fn ($join) => $join->on('o.reservation_id', '=', 'r.id')->whereNull('o.deleted_at')->where('o.status', '<>', 'cancelada'))
            ->whereNull('r.deleted_at')
            ->where('x.type', $type)
            ->when($review, fn ($query) => $query->where('x.review_status', $review))
            ->when($filters['reservation'] ?? null, fn ($query, $code) => $query->where('r.code', $code))
            ->orderByRaw('x.hold_until nulls last')->orderByDesc('x.responded_at')
            ->limit(200)
            ->get([
                'x.id', 'x.type', 'x.alt_kind', 'x.alt_date', 'x.alt_net_cost', 'x.currency', 'x.hold_until', 'x.note', 'x.review_status', 'x.review_note', 'x.responded_at', 'x.reviewed_at',
                's.code as service_code', 's.name as service_name', 's.service_date', 's.status as service_status', 's.cost_amount', 's.pax',
                'r.code as reservation_code', 'r.title as reservation_title', 'p.ref as provider_ref', 'p.name as provider_name', 'c.ref as alt_service_ref', 'c.name as alt_service_name',
                'u.name as responded_by', 'ru.name as reviewed_by', 'o.code as order_code',
            ]);

        $today = $this->common->today();

        return [
            'today' => $today,
            'can' => ['review' => $viewer->can('operations.assign')],
            'rows' => $rows->map(fn (object $row): array => [
                'id' => $row->id,
                'kind' => $row->alt_kind,
                'review_status' => $row->review_status,
                'review_note' => $row->review_note,
                'responded_at' => $row->responded_at,
                'reviewed_at' => $row->reviewed_at,
                'responded_by' => $row->responded_by,
                'reviewed_by' => $row->reviewed_by,
                'note' => $row->note,
                'hold_until' => $row->hold_until,
                'hold_expired' => $row->hold_until !== null && $row->hold_until < $today,
                'proposal' => [
                    'date' => $row->alt_date,
                    'service' => $row->alt_service_ref ? ['ref' => $row->alt_service_ref, 'name' => $row->alt_service_name] : null,
                    'net_cost' => $row->alt_net_cost === null ? null : (float) $row->alt_net_cost,
                    'currency' => $row->currency,
                ],
                'current' => ['date' => $row->service_date, 'name' => $row->service_name, 'net_cost' => (float) $row->cost_amount, 'pax' => (int) $row->pax],
                'service' => ['code' => $row->service_code, 'status' => $row->service_status, 'open' => in_array($row->service_status, ProviderServiceResponse::OPEN, true)],
                'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title],
                'order' => $row->order_code,
                'provider' => ['ref' => $row->provider_ref, 'name' => $row->provider_name],
            ])->values(),
        ];
    }
}
