<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ReconciliationCandidates
{
    public const TOLERANCE = 0.5;

    public function __construct(private readonly Consolidation $money, private readonly PaymentMethods $methods) {}

    public function for(object $line): Collection
    {
        $references = preg_match_all('/\d{5,}/', (string) $line->description, $found) ? $found[0] : [];
        $hit = fn (?string $text): bool => $text !== null && collect($references)->contains(fn (string $number): bool => str_contains($text, $number));
        $target = abs((float) $line->amount);

        $rows = (float) $line->amount > 0 ? $this->payments($line->id, $hit) : $this->payables($line->id, $hit);

        return $rows
            ->map(fn (array $row): array => [...$row, 'difference' => round($target - $row['pen'], 2)])
            ->sortBy(fn (array $row): array => [abs($row['difference']) >= self::TOLERANCE ? 1 : 0, $row['reference_hit'] ? 0 : 1, abs($row['difference'])])
            ->values();
    }

    public function best(object $line): ?array
    {
        $match = $this->for($line)->first(fn (array $row): bool => abs($row['difference']) < self::TOLERANCE);

        return $match ?: null;
    }

    private function payments(string $lineId, callable $hit): Collection
    {
        $labels = $this->methods->labels();

        return DB::table('fin_payments as p')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'p.reservation_id')
            ->where('p.kind', 'cobro')
            ->whereNotIn('p.status', ['revertido', 'rechazado'])
            ->whereNotIn('p.id', $this->taken('matched_payment_id', $lineId))
            ->orderByDesc('p.paid_on')
            ->limit(400)
            ->get(['p.id', 'p.code', 'p.method', 'p.amount', 'p.currency', 'p.fx_rate', 'p.reference', 'p.status', 'b.code as reservation_code'])
            ->map(fn (object $row): array => [
                'kind' => 'payment',
                'id' => $row->id,
                'code' => $row->code,
                'label' => trim(implode(' · ', array_filter([$row->reservation_code, $labels[$row->method] ?? $row->method, $row->reference]))),
                'amount' => (float) $row->amount,
                'currency' => $row->currency,
                'pen' => $this->money->pen($row->amount, $row->currency, $row->fx_rate),
                'status' => $row->status,
                'reference_hit' => $hit($row->reference),
            ]);
    }

    private function payables(string $lineId, callable $hit): Collection
    {
        return DB::table('fin_payables as x')
            ->leftJoin('catalog_providers as v', 'v.id', '=', 'x.provider_id')
            ->whereNull('x.deleted_at')
            ->where('x.status', '<>', 'cancelada')
            ->where(fn ($query) => $query->whereNotNull('x.approved_at')->orWhere('x.status', 'pagada'))
            ->whereNotIn('x.id', $this->taken('matched_payable_id', $lineId))
            ->orderBy('x.due_date')
            ->limit(400)
            ->get(['x.id', 'x.code', 'x.concept', 'x.amount', 'x.paid_amount', 'x.currency', 'x.fx_rate', 'x.status', 'v.name as provider', 'v.ruc'])
            ->map(function (object $row) use ($hit): array {
                $balance = ReceivableLedger::balance($row);
                $base = $balance->isPositive() ? $balance : $row->amount;

                return [
                    'kind' => 'payable',
                    'id' => $row->id,
                    'code' => $row->code,
                    'label' => trim(implode(' · ', array_filter([$row->provider, $row->concept]))),
                    'amount' => (float) (string) $base,
                    'currency' => $row->currency,
                    'pen' => $this->money->pen((string) $base, $row->currency, $row->fx_rate),
                    'status' => $row->status,
                    'reference_hit' => $hit($row->ruc),
                ];
            });
    }

    private function taken(string $column, string $lineId): array
    {
        return DB::table('fin_bank_lines')
            ->whereNotNull($column)
            ->where('id', '<>', $lineId)
            ->where('status', '<>', 'excepcion')
            ->pluck($column)
            ->all();
    }
}
