<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RateRequestDirectory
{
    private const SORTS = ['requested_at' => 'q.requested_at', 'effective_from' => 'q.effective_from', 'code' => 'q.code', 'status' => 'q.status'];

    public function page(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->query()
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->whereIn('q.status', explode(',', $status)))
            ->when($filters['provider'] ?? null, fn ($query, string $provider) => $query->where('p.ref', $provider))
            ->when($filters['service'] ?? null, fn ($query, string $service) => $query->where('s.ref', $service));
        $pending = DB::table('supplier_rate_requests')->where('status', 'pendiente')->count();

        return CursorPage::respond($request, $query, self::SORTS, '-requested_at', fn (object $row): array => $this->row($row), ['pending' => $pending]);
    }

    public function find(string $reference): array
    {
        $row = $this->query()->where(Str::isUuid($reference) ? 'q.id' : 'q.code', $reference)->first() ?? throw ApiException::notFound('La solicitud de tarifa no existe.');

        return $this->row($row);
    }

    public function code(string $reference): string
    {
        return (string) (DB::table('supplier_rate_requests')->where(Str::isUuid($reference) ? 'id' : 'code', $reference)->value('code') ?? throw ApiException::notFound('La solicitud de tarifa no existe.'));
    }

    private function query(): Builder
    {
        return DB::table('supplier_rate_requests as q')
            ->join('catalog_services as s', 's.id', '=', 'q.service_id')
            ->join('catalog_providers as p', 'p.id', '=', 'q.provider_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'q.requested_by')
            ->leftJoin('iam_users as ru', 'ru.id', '=', 'q.reviewed_by')
            ->select(['q.*', 's.ref as service_ref', 's.name as service_name', 's.unit as service_unit', 'p.ref as provider_ref', 'p.name as provider_name', 'u.name as requested_by_name', 'ru.name as reviewed_by_name']);
    }

    private function row(object $row): array
    {
        $current = (float) $row->current_cost;
        $proposed = (float) $row->proposed_cost;

        return [
            'id' => $row->id,
            'code' => $row->code,
            'provider_id' => $row->provider_id,
            'service_id' => $row->service_id,
            'provider' => ['ref' => $row->provider_ref, 'name' => $row->provider_name],
            'service' => ['ref' => $row->service_ref, 'name' => $row->service_name, 'unit' => $row->service_unit],
            'current_cost' => (string) $row->current_cost,
            'proposed_cost' => (string) $row->proposed_cost,
            'change_pct' => $current > 0 ? round(($proposed - $current) / $current * 100, 1) : null,
            'currency' => trim((string) $row->currency),
            'effective_from' => $row->effective_from,
            'reason_type' => $row->reason_type,
            'reason_detail' => $row->reason_detail,
            'status' => $row->status,
            'requested_by' => $row->requested_by_name,
            'requested_at' => $row->requested_at,
            'reviewed_by' => $row->reviewed_by_name,
            'reviewed_at' => $row->reviewed_at,
            'review_note' => $row->review_note,
            'resulting_rate_id' => $row->resulting_rate_id,
        ];
    }
}
