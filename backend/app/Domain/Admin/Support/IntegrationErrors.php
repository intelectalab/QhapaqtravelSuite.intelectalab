<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Closure;
use Illuminate\Support\Facades\DB;
use Throwable;

final class IntegrationErrors
{
    public const BACKOFF = [60, 120, 240, 480, 960];

    public const AUTO_RESOLUTION = 'Se resolvió en el reintento automático.';

    public static function record(?string $tenantId, string $source, string $ref, string $target, string $error, int $attempt, int $max, bool $permanent = false): void
    {
        if ($tenantId === null) {
            return;
        }

        self::safely($tenantId, function () use ($source, $ref, $target, $error, $attempt, $max, $permanent): void {
            $final = $permanent || $attempt >= $max;
            $values = [
                'error' => mb_substr($error, 0, 1000),
                'error_class' => $permanent ? 'permanente' : 'transitorio',
                'attempt' => min(32767, max(1, $attempt)),
                'max_attempts' => max(1, $max),
                'status' => $final ? 'fallo_definitivo' : 'reintentando',
                'next_retry_at' => $final ? null : now()->addSeconds(self::BACKOFF[min(count(self::BACKOFF) - 1, max(0, $attempt - 1))]),
                'updated_at' => now(),
            ];
            $open = DB::table('integration_errors')->where('source', $source)->where('ref_code', mb_substr($ref, 0, 30))->where('target', mb_substr($target, 0, 150))
                ->where('status', 'reintentando')->lockForUpdate()->value('id');

            if ($open !== null) {
                DB::table('integration_errors')->where('id', $open)->update($values);

                return;
            }

            DB::table('integration_errors')->insert([...$values, 'code' => self::nextCode(), 'source' => $source, 'ref_code' => mb_substr($ref, 0, 30), 'target' => mb_substr($target, 0, 150), 'created_at' => now()]);
        });
    }

    public static function resolve(?string $tenantId, string $source, string $ref, ?string $target = null): void
    {
        if ($tenantId === null) {
            return;
        }

        self::safely($tenantId, fn () => DB::table('integration_errors')->where('source', $source)->where('ref_code', mb_substr($ref, 0, 30))
            ->when($target !== null, fn ($query) => $query->where('target', mb_substr((string) $target, 0, 150)))
            ->where('status', 'reintentando')
            ->update(['status' => 'resuelto', 'resolution' => self::AUTO_RESOLUTION, 'next_retry_at' => null, 'updated_at' => now()]));
    }

    public static function describe(Throwable $e): string
    {
        return class_basename($e).': '.mb_substr($e->getMessage(), 0, 500);
    }

    private static function nextCode(): string
    {
        $last = DB::table('integration_errors')->where('code', 'like', 'ERR-%')->pluck('code')->map(fn (string $code): int => (int) substr($code, 4))->max() ?? 0;

        return 'ERR-'.str_pad((string) ($last + 1), 4, '0', STR_PAD_LEFT);
    }

    private static function safely(string $tenantId, Closure $fn): void
    {
        $context = app(TenantContext::class);
        $previous = $context->id();

        try {
            app(TenantDatabase::class)->run($tenantId, $fn);
        } catch (Throwable $e) {
            report($e);
        } finally {
            $previous === null ? $context->clear() : $context->set($previous);
        }
    }
}
