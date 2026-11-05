<?php

declare(strict_types=1);

namespace App\Domain\Shared\Http\Controllers;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class HealthController
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->probe(fn () => DB::select('select 1')),
            'redis' => $this->probe(fn () => Redis::connection()->ping()),
            'storage' => $this->probe(fn () => Storage::disk('s3')->directoryExists('/')),
        ];

        $healthy = ! in_array(false, $checks, true);

        return response()->json([
            'status' => $healthy ? 'ok' : 'degraded',
            'checks' => array_map(fn (bool $ok) => $ok ? 'ok' : 'error', $checks),
        ], $healthy ? 200 : 503);
    }

    private function probe(Closure $check): bool
    {
        try {
            $check();

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }
}
