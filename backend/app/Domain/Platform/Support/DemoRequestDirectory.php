<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Actions\AttendDemoRequest;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class DemoRequestDirectory
{
    private const CONNECTION = 'pgsql_platform';

    public const STATUSES = ['nueva', 'contactada', 'convertida', 'descartada'];

    public function list(): array
    {
        $rows = $this->query()->orderByDesc('r.created_at')->get();

        return [
            'kpis' => [
                'total' => $rows->count(),
                'new' => $rows->where('status', 'nueva')->count(),
                'contacted' => $rows->where('status', 'contactada')->count(),
                'converted' => $rows->where('status', 'convertida')->count(),
                'trials' => $rows->where('kind', 'trial')->count(),
                'demos' => $rows->where('kind', 'demo')->count(),
                'last_7_days' => $rows->filter(fn (object $row) => now()->subDays(7)->lte($row->created_at))->count(),
            ],
            'items' => $rows->map(fn (object $row) => $this->present($row))->values()->all(),
        ];
    }

    public function find(string $code): array
    {
        $row = $this->query()->where('r.code', $code)->first() ?? throw ApiException::notFound('La solicitud no existe.');

        return $this->present($row);
    }

    private function query(): Builder
    {
        return DB::connection(self::CONNECTION)->table('platform_demo_requests as r')
            ->leftJoin('plans as p', 'p.id', '=', 'r.plan_id')
            ->leftJoin('platform_users as u', 'u.id', '=', 'r.handled_by')
            ->select(['r.code', 'r.kind', 'r.full_name', 'r.email', 'r.phone', 'r.company', 'r.business_type', 'r.city', 'r.team_size', 'r.message', 'r.status', 'r.source', 'r.billing_cycle', 'r.notes', 'r.handled_at', 'r.created_at', 'p.code as plan_code', 'p.name as plan_name', 'u.name as handled_by_name']);
    }

    private function present(object $row): array
    {
        return [
            'code' => $row->code,
            'kind' => $row->kind,
            'full_name' => $row->full_name,
            'email' => $row->email,
            'phone' => $row->phone,
            'company' => $row->company,
            'business_type' => $row->business_type,
            'city' => $row->city,
            'team_size' => $row->team_size,
            'message' => $row->message,
            'status' => $row->status,
            'next_statuses' => AttendDemoRequest::TRANSITIONS[$row->status] ?? [],
            'source' => $row->source,
            'plan' => $row->plan_code ? ['code' => $row->plan_code, 'name' => $row->plan_name, 'billing_cycle' => $row->billing_cycle] : null,
            'notes' => $row->notes,
            'handled_by' => $row->handled_by_name,
            'handled_at' => $row->handled_at ? Carbon::parse($row->handled_at)->toIso8601String() : null,
            'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
        ];
    }
}
