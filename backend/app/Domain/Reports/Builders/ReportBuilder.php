<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\KpiReport;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

abstract class ReportBuilder
{
    abstract public function build(User $viewer, ReportFilters $filters): array;

    protected function reservations(User $viewer, ReportFilters $filters, bool $soldOnly = true): Builder
    {
        $query = Portfolio::scope(DB::table('booking_reservations as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id');
        $query = $filters->sede($filters->between($query, 'r.created_at'), 'r.sede_id');

        return $soldOnly ? $query->whereIn('r.status', KpiReport::SOLD) : $query;
    }

    protected function owned(string $table, string $alias, User $viewer, ReportFilters $filters, string $dateColumn = 'created_at'): Builder
    {
        $query = Portfolio::scope(DB::table("{$table} as {$alias}")->whereNull("{$alias}.deleted_at"), $viewer, "{$alias}.owner_id");

        return $filters->ownerSede($filters->between($query, "{$alias}.{$dateColumn}"), "{$alias}.owner_id");
    }

    protected function sales(): string
    {
        return ReportShape::pen('r.total_amount', 'r.fx_rate');
    }

    protected function own(User $viewer): bool
    {
        return Portfolio::ownOnly($viewer);
    }
}
