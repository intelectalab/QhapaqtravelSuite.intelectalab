<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TravelItinerary
{
    public function days(Collection $entries, string $start): array
    {
        $plans = $this->plans($entries->pluck('product_id')->filter()->unique()->values());
        $rows = [];

        foreach ($entries as $entry) {
            $plan = $entry['product_id'] !== null ? ($plans[$entry['product_id']] ?? []) : [];

            if (count($plan) < 2) {
                $rows[] = [...$entry, 'steps' => []];

                continue;
            }

            foreach ($plan as $day) {
                $rows[] = [
                    ...$entry,
                    'date' => CarbonImmutable::parse($entry['date'])->addDays($day['number'] - 1)->toDateString(),
                    'time' => $day['number'] === 1 ? $entry['time'] : null,
                    'title' => $day['title'],
                    'detail' => "Día {$day['number']} de {$entry['title']}",
                    'steps' => $day['steps'],
                ];
            }
        }

        $first = CarbonImmutable::parse($start);

        return collect($rows)
            ->groupBy('date')
            ->sortKeys()
            ->map(fn (Collection $items, string $date): array => [
                'date' => $date,
                'number' => (int) $first->diffInDays(CarbonImmutable::parse($date)) + 1,
                'title' => DocumentFormat::dayTitle($date),
                'entries' => $items->sortBy(fn (array $item): string => $item['time'] ?? '99:99')->values()->all(),
            ])
            ->values()
            ->all();
    }

    public function inclusions(Collection $productIds): array
    {
        if ($productIds->isEmpty()) {
            return [];
        }

        $names = DB::table('catalog_products')->whereIn('id', $productIds)->pluck('name', 'id');
        $rows = DB::table('catalog_product_inclusions')->whereIn('product_id', $productIds)->orderBy('sort_order')->orderBy('text')
            ->get(['product_id', 'kind', 'text'])
            ->groupBy('product_id');

        return $productIds->filter(fn (string $id): bool => $rows->has($id))
            ->map(fn (string $id): array => [
                'product' => (string) ($names[$id] ?? ''),
                'include' => $rows[$id]->where('kind', 'include')->pluck('text')->values()->all(),
                'exclude' => $rows[$id]->where('kind', 'exclude')->pluck('text')->values()->all(),
            ])
            ->values()
            ->all();
    }

    private function plans(Collection $productIds): array
    {
        if ($productIds->isEmpty()) {
            return [];
        }

        $days = DB::table('catalog_itineraries as i')
            ->join('catalog_itinerary_days as d', 'd.itinerary_id', '=', 'i.id')
            ->whereIn('i.product_id', $productIds)
            ->where('i.is_default', true)
            ->orderBy('d.day_number')
            ->get(['i.product_id', 'd.id', 'd.day_number', 'd.title']);
        $steps = [];

        foreach (DB::table('catalog_itinerary_items')->whereIn('day_id', $days->pluck('id'))->orderByRaw('start_time nulls last')->orderBy('activity')->get(['day_id', 'start_time', 'activity', 'location']) as $step) {
            $steps[(string) $step->day_id][] = ['time' => DocumentFormat::time($step->start_time), 'text' => (string) $step->activity, 'location' => $step->location];
        }

        $plans = [];

        foreach ($days as $day) {
            $plans[(string) $day->product_id][] = ['number' => (int) $day->day_number, 'title' => (string) $day->title, 'steps' => $steps[(string) $day->id] ?? []];
        }

        return $plans;
    }
}
