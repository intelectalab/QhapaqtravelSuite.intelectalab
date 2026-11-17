<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class NoShowDirectory
{
    private const SORTS = ['recorded_at' => 'n.recorded_at', 'service_date' => 's.service_date'];

    private const COLUMNS = [
        'n.id', 'n.lock_version', 'n.source', 'n.recorded_at', 'n.note', 'n.advisor_notified_at', 'n.voided_at', 'n.void_reason',
        's.code as service_code', 's.name as service_name', 's.service_date', 'r.code as reservation_code', 'p.id as passenger_id', 'p.full_name as passenger', 'p.pax_type',
        'u.name as recorded_by', 'i.code as incident_code',
    ];

    public function forReservation(string $reservationId): Collection
    {
        return $this->query()->where('n.reservation_id', $reservationId)->whereNull('n.voided_at')->orderBy('s.service_date')->orderBy('p.full_name')->get(self::COLUMNS)->map(fn (object $row): array => $this->row($row))->values();
    }

    public function forService(string $serviceId): Collection
    {
        return $this->query()->where('n.reservation_service_id', $serviceId)->orderByDesc('n.recorded_at')->get(self::COLUMNS)->map(fn (object $row): array => $this->row($row))->values();
    }

    public function page(Request $request): array
    {
        $filters = (array) $request->query('filter', []);
        $query = $this->query()
            ->when(! filter_var($filters['voided'] ?? false, FILTER_VALIDATE_BOOLEAN), fn (Builder $query) => $query->whereNull('n.voided_at'))
            ->when($filters['reservation'] ?? null, fn (Builder $query, string $code) => $query->where('r.code', $code))
            ->when($filters['source'] ?? null, fn (Builder $query, string $source) => $query->where('n.source', $source))
            ->when($filters['from'] ?? null, fn (Builder $query, string $date) => $query->where('s.service_date', '>=', $date))
            ->when($filters['to'] ?? null, fn (Builder $query, string $date) => $query->where('s.service_date', '<=', $date))
            ->select(self::COLUMNS);

        return CursorPage::respond($request, $query, self::SORTS, '-recorded_at', fn (object $row): array => $this->row($row));
    }

    private function query(): Builder
    {
        return DB::table('ops_no_shows as n')
            ->join('booking_reservation_services as s', 's.id', '=', 'n.reservation_service_id')
            ->join('booking_reservations as r', 'r.id', '=', 'n.reservation_id')
            ->join('booking_passengers as p', 'p.id', '=', 'n.passenger_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'n.created_by')
            ->leftJoin('ops_incidents as i', 'i.id', '=', 'n.incident_id')
            ->whereNull('r.deleted_at');
    }

    private function row(object $row): array
    {
        return [
            'id' => $row->id,
            'lock_version' => (int) $row->lock_version,
            'passenger' => ['id' => $row->passenger_id, 'name' => $row->passenger, 'type' => $row->pax_type],
            'service' => ['code' => $row->service_code, 'name' => $row->service_name, 'date' => $row->service_date],
            'reservation' => $row->reservation_code,
            'source' => $row->source,
            'recorded_at' => $row->recorded_at,
            'recorded_by' => $row->recorded_by,
            'note' => $row->note,
            'advisor_notified' => $row->advisor_notified_at !== null,
            'incident' => $row->incident_code,
            'voided_at' => $row->voided_at,
            'void_reason' => $row->void_reason,
        ];
    }
}
