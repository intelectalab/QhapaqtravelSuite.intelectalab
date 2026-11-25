<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class WebAnalyticsRollup
{
    public const METRICS = ['visits', 'visitors', 'pageviews', 'bounces', 'engaged_seconds', 'conversions', 'revenue'];

    public const NIGHTLY_HOUR = 3;

    public function run(AnalyticsScope $scope, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now(WebAnalyticsReport::TIMEZONE);
        $today = $now->toDateString();
        $days = [$today => $this->aggregate($scope, $today)];

        if ($now->hour === self::NIGHTLY_HOUR) {
            $yesterday = $now->subDay()->toDateString();
            $days[$yesterday] = $this->aggregate($scope, $yesterday);
            $this->purge($scope, $yesterday);
        }

        return $days;
    }

    public static function summary(array $days): string
    {
        return collect($days)
            ->map(fn (int $rows, string $day): string => CarbonImmutable::parse($day)->format('d/m').': '.match ($rows) {
                0 => 'sin visitas nuevas',
                1 => '1 fila',
                default => "{$rows} filas",
            })
            ->implode(' · ');
    }

    public function aggregate(AnalyticsScope $scope, string $day): int
    {
        $db = DB::connection($scope->connection);

        return (int) $db->transaction(function () use ($db, $scope, $day): int {
            if (! $this->scoped($db, $scope, $scope->hits)->where('day', $day)->exists()) {
                return 0;
            }

            $dims = $scope->dimensions();
            $sums = implode(', ', array_map(fn (string $column): string => "sum({$column})", self::METRICS));
            $list = implode(', ', [...$dims, ...self::METRICS]);
            $groups = implode(', ', $dims);
            $tenant = $scope->isPlatform() ? '' : ' and tenant_id = ?';

            $this->scoped($db, $scope, $scope->table)->where('day', $day)->delete();

            return $db->affectingStatement(
                "insert into {$scope->table} ({$list}, computed_at) select {$groups}, {$sums}, now() from {$scope->hits} where day = ?{$tenant} group by {$groups}",
                $scope->isPlatform() ? [$day] : [$day, $scope->tenantId],
            );
        });
    }

    public function ledgerFromDaily(AnalyticsScope $scope, string $from): void
    {
        $db = DB::connection($scope->connection);
        $columns = implode(', ', [...($scope->isPlatform() ? [] : ['tenant_id']), ...$scope->dimensions(), ...self::METRICS]);
        $tenant = $scope->isPlatform() ? '' : ' and tenant_id = ?';
        $bindings = $scope->isPlatform() ? [$from] : [$from, $scope->tenantId];

        $this->scoped($db, $scope, $scope->hits)->where('day', '>=', $from)->delete();
        $db->statement("insert into {$scope->hits} ({$columns}, occurred_at) select {$columns}, day + interval '12 hours' from {$scope->table} where day >= ?{$tenant}", $bindings);
    }

    public function purge(AnalyticsScope $scope, string $before): int
    {
        return $this->scoped(DB::connection($scope->connection), $scope, $scope->hits)->where('day', '<', $before)->delete();
    }

    public function computedAt(AnalyticsScope $scope): ?string
    {
        $value = $this->scoped(DB::connection($scope->connection), $scope, $scope->table)->max('computed_at');

        return $value === null ? null : CarbonImmutable::parse((string) $value)->toIso8601String();
    }

    private function scoped(ConnectionInterface $db, AnalyticsScope $scope, string $table): Builder
    {
        return $db->table($table)->when(! $scope->isPlatform(), fn (Builder $query) => $query->where('tenant_id', $scope->tenantId));
    }
}
