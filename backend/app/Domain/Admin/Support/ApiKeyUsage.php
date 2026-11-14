<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

final class ApiKeyUsage
{
    public const DAYS = 30;

    public function call(string $keyId): void
    {
        $this->bump("apikey:{$keyId}:calls:".Carbon::now('UTC')->format('Ymd'), now()->addDays(self::DAYS + 1));
    }

    public function rejected(string $keyId): void
    {
        $this->bump("apikey:{$keyId}:429:".Carbon::now('UTC')->format('YmdH'), now()->addHours(25));
    }

    public function summary(string $keyId): array
    {
        $now = Carbon::now('UTC');
        $calls = 0;
        $rejected = 0;

        for ($day = 0; $day < self::DAYS; $day++) {
            $calls += (int) Cache::get("apikey:{$keyId}:calls:".$now->copy()->subDays($day)->format('Ymd'), 0);
        }

        for ($hour = 0; $hour < 24; $hour++) {
            $rejected += (int) Cache::get("apikey:{$keyId}:429:".$now->copy()->subHours($hour)->format('YmdH'), 0);
        }

        return ['calls_30d' => $calls, 'rejected_24h' => $rejected];
    }

    private function bump(string $key, Carbon $ttl): void
    {
        Cache::add($key, 0, $ttl);
        Cache::increment($key);
    }
}
