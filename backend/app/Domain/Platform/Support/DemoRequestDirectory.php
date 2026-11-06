<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class DemoRequestDirectory
{
    private const CONNECTION = 'pgsql_platform';

    public const STATUSES = ['nueva', 'contactada', 'convertida', 'descartada'];

    public function list(): array
    {
        $rows = DB::connection(self::CONNECTION)->table('platform_demo_requests as r')
            ->leftJoin('plans as p', 'p.id', '=', 'r.plan_id')
            ->orderByDesc('r.created_at')
            ->get(['r.code', 'r.kind', 'r.full_name', 'r.email', 'r.phone', 'r.company', 'r.business_type', 'r.city', 'r.team_size', 'r.message', 'r.status', 'r.source', 'r.billing_cycle', 'r.created_at', 'p.code as plan_code', 'p.name as plan_name']);

        return [
            'kpis' => [
                'total' => $rows->count(),
                'new' => $rows->where('status', 'nueva')->count(),
                'trials' => $rows->where('kind', 'trial')->count(),
                'demos' => $rows->where('kind', 'demo')->count(),
                'last_7_days' => $rows->filter(fn (object $row) => now()->subDays(7)->lte($row->created_at))->count(),
            ],
            'items' => $rows->map(fn (object $row) => [
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
                'source' => $row->source,
                'plan' => $row->plan_code ? ['code' => $row->plan_code, 'name' => $row->plan_name, 'billing_cycle' => $row->billing_cycle] : null,
                'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
            ])->values()->all(),
        ];
    }
}
