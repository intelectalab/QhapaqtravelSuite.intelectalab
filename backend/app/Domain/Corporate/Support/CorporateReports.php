<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Collection;

final class CorporateReports
{
    public function __construct(private readonly CorporateLedger $ledger, private readonly CorporateDirectory $directory) {}

    public function summary(object $account, CorporatePeriod $period, CorporateScope $scope, ?int $topTravelers = 10): array
    {
        $purchases = $this->ledger->purchases($account, $scope);
        $inPeriod = $purchases->filter(fn (array $row): bool => $period->contains($row['date']))->values();
        $total = $this->sum($inPeriod, 'charge');
        $travelers = $this->byTraveler($inPeriod);
        $months = [];

        foreach (range(1, 12) as $month) {
            $prefix = sprintf('%d-%02d', $period->year, $month);
            $months[] = ['month' => $prefix, 'label' => CorporatePeriod::shortMonth($month), 'amount' => Decimal::toApi($this->sum($purchases->filter(fn (array $row): bool => str_starts_with($row['date'], $prefix)), 'charge')), 'count' => $purchases->filter(fn (array $row): bool => str_starts_with($row['date'], $prefix))->count()];
        }

        $centers = collect($this->directory->costCenters($account, $scope))->map(function (array $center) use ($inPeriod, $purchases, $period): array {
            $amountOf = fn (Collection $rows): BigDecimal => $rows->reduce(fn (BigDecimal $sum, array $row): BigDecimal => $sum->plus((string) (collect($row['allocations'])->firstWhere('cost_center', $center['code'])['amount'] ?? '0')), BigDecimal::zero());

            return [
                ...$center,
                'period_amount' => Decimal::toApi($amountOf($inPeriod)),
                'year_amount' => Decimal::toApi($amountOf($purchases->filter(fn (array $row): bool => str_starts_with($row['date'], (string) $period->year)))),
            ];
        })->values()->all();

        return [
            'period' => ['key' => $period->key, 'label' => $period->label, 'from' => $period->from, 'to' => $period->to],
            'currency' => (string) $account->currency,
            'scope' => $scope->label(),
            'kpis' => [
                'total' => Decimal::toApi($total),
                'purchases' => $inPeriod->count(),
                'balance' => Decimal::toApi($this->ledger->balance($account, $scope)),
                'travelers' => count($travelers),
                'average_ticket' => $inPeriod->isEmpty() ? null : Decimal::toApi($total->dividedBy($inPeriod->count(), 2, RoundingMode::HALF_UP)),
            ],
            'months' => $months,
            'cost_centers' => $centers,
            'travelers' => $topTravelers === null ? $travelers : array_slice($travelers, 0, $topTravelers),
        ];
    }

    public function purchases(object $account, CorporatePeriod $period, CorporateScope $scope): array
    {
        return $this->ledger->purchases($account, $scope)
            ->filter(fn (array $row): bool => $period->contains($row['date']))
            ->sortByDesc('date')
            ->map(fn (array $row): array => [
                'id' => $row['id'],
                'date' => $row['date'],
                'reservation' => $row['reservation'] ?? $row['document'],
                'title' => $row['detail'],
                'travel_from' => $row['travel_from'],
                'cost_center' => $row['cost_center'],
                'allocations' => $row['allocations'],
                'travelers' => $row['travelers'],
                'amount' => $row['charge'],
                'origin' => $row['origin'],
            ])->values()->all();
    }

    public function movements(object $account, CorporatePeriod $period, CorporateScope $scope): array
    {
        $entries = $this->ledger->entries($account, $scope);
        $opening = Decimal::toApi($this->ledger->balance($account, $scope, $period->from));
        $rows = $entries->filter(fn (array $row): bool => $period->contains($row['date']))->values();

        return [
            'period' => ['key' => $period->key, 'label' => $period->label, 'from' => $period->from, 'to' => $period->to],
            'currency' => (string) $account->currency,
            'opening_balance' => $opening,
            'totals' => [
                'charges' => Decimal::toApi($this->sum($rows, 'charge')),
                'payments' => Decimal::toApi($this->sum($rows->where('kind', 'pago'), 'credit')),
                'credits' => Decimal::toApi($this->sum($rows->where('kind', 'nota_credito'), 'credit')),
                'closing_balance' => $rows->isEmpty() ? $opening : (string) $rows->last()['balance'],
            ],
            'rows' => $rows->map(fn (array $row): array => [
                'id' => $row['id'],
                'date' => $row['date'],
                'kind' => $row['kind'],
                'kind_label' => $row['kind_label'],
                'document' => $row['document'],
                'reservation' => $row['reservation'],
                'detail' => $row['detail'],
                'cost_center' => $row['cost_center'],
                'charge' => $row['charge'],
                'credit' => $row['credit'],
                'balance' => $row['balance'],
            ])->reverse()->values()->all(),
        ];
    }

    private function byTraveler(Collection $purchases): array
    {
        $totals = [];

        foreach ($purchases as $row) {
            $names = $row['travelers'];
            if ($names === []) {
                continue;
            }
            $parts = Decimal::allocate((string) $row['charge'], array_fill(0, count($names), BigDecimal::one()));
            foreach ($names as $index => $name) {
                $totals[$name] ??= ['name' => $name, 'trips' => 0, 'amount' => BigDecimal::zero()];
                $totals[$name]['trips']++;
                $totals[$name]['amount'] = $totals[$name]['amount']->plus($parts[$index]);
            }
        }

        usort($totals, fn (array $a, array $b): int => $b['amount']->compareTo($a['amount']) ?: strcmp($a['name'], $b['name']));

        return array_map(fn (array $row): array => ['name' => $row['name'], 'trips' => $row['trips'], 'amount' => Decimal::toApi($row['amount'])], $totals);
    }

    private function sum(Collection $rows, string $field): BigDecimal
    {
        return $rows->reduce(fn (BigDecimal $sum, array $row): BigDecimal => $sum->plus((string) $row[$field]), BigDecimal::zero())->toScale(2);
    }
}
