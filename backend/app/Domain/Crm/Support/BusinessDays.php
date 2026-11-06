<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class BusinessDays
{
    private ?array $holidays = null;

    public function add(Carbon $from, int $days): Carbon
    {
        $date = $from->copy()->startOfDay();
        $added = 0;

        while ($added < $days) {
            $date->addDay();
            if ($this->isWorking($date)) {
                $added++;
            }
        }

        return $date;
    }

    public function between(Carbon $from, Carbon $to): int
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->startOfDay();
        $sign = $end->gte($start) ? 1 : -1;
        [$low, $high] = $sign === 1 ? [$start, $end] : [$end, $start];
        $count = 0;

        while ($low->lt($high)) {
            $low->addDay();
            if ($this->isWorking($low)) {
                $count++;
            }
        }

        return $count * $sign;
    }

    private function isWorking(Carbon $date): bool
    {
        $this->holidays ??= array_flip(DB::table('sys_holidays')->pluck('date')->map(fn ($value): string => substr((string) $value, 0, 10))->all());

        return ! $date->isWeekend() && ! isset($this->holidays[$date->toDateString()]);
    }
}
