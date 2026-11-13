<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class AdapterRetryPolicy
{
    public const BASE_SECONDS = 60;

    public const TRIES = 5;

    public const TIMEOUT_SECONDS = 30;

    public const JITTER = 0.2;

    public static function for(string $kind): array
    {
        $adapter = app(TenantContext::class)->has()
            ? DB::table('integration_adapters')->where('kind', $kind)->orderBy('code')->first(['max_retries', 'backoff_base_s', 'timeout_s'])
            : null;
        $tries = max(1, (int) ($adapter->max_retries ?? self::TRIES));
        $base = max(1, (int) ($adapter->backoff_base_s ?? self::BASE_SECONDS));

        return [
            'tries' => $tries,
            'backoff' => self::delays($base, $tries),
            'timeout' => max(1, (int) ($adapter->timeout_s ?? self::TIMEOUT_SECONDS)),
        ];
    }

    public static function delays(int $base = self::BASE_SECONDS, int $tries = self::TRIES): array
    {
        return array_map(fn (int $seconds): int => self::jitter($seconds), self::schedule($base, $tries));
    }

    public static function schedule(int $base = self::BASE_SECONDS, int $tries = self::TRIES): array
    {
        return array_map(fn (int $attempt): int => $base * (2 ** $attempt), range(0, max(0, $tries - 1)));
    }

    public static function jitter(int $seconds): int
    {
        $spread = (int) round($seconds * self::JITTER);

        return max(1, $seconds + random_int(-$spread, $spread));
    }
}
