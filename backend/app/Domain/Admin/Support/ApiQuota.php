<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Platform\Support\EffectiveLimits;
use App\Domain\Platform\Support\UsageMeter;
use App\Http\Middleware\AssignCorrelationId;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class ApiQuota
{
    public const METRIC = 'api_calls_month';

    public const CODE = 'QUOTA_EXCEEDED';

    private const ZONE = 'America/Lima';

    private const UNLIMITED = -1;

    public function limit(string $tenantId): ?int
    {
        $limit = (int) Cache::remember("api-quota:limit:{$tenantId}", now()->addMinutes(5), function () use ($tenantId): int {
            $db = DB::connection('pgsql_platform');
            $plan = $db->table('tenants')->where('id', $tenantId)->value('plan_id');

            if ($plan === null) {
                return self::UNLIMITED;
            }

            $hard = $db->table('plan_limits')->where('plan_id', $plan)->where('metric', self::METRIC)->value('hard');
            $limit = EffectiveLimits::limit($tenantId, (string) $plan, self::METRIC);

            return $limit === null || $hard === false ? self::UNLIMITED : $limit;
        });

        return $limit === self::UNLIMITED ? null : $limit;
    }

    public function used(string $tenantId): int
    {
        $key = $this->key($tenantId);
        $value = Cache::get($key);

        if ($value === null) {
            Cache::add($key, $this->measured($tenantId), $this->resetsAt()->addDays(2));
            $value = Cache::get($key, 0);
        }

        return (int) $value;
    }

    public function exceeded(string $tenantId): ?JsonResponse
    {
        $limit = $this->limit($tenantId);

        if ($limit === null) {
            return null;
        }

        $used = $this->used($tenantId);

        if ($used < $limit) {
            return null;
        }

        $resets = $this->resetsAt();
        $retry = max(1, (int) Carbon::now()->diffInSeconds($resets, true));

        return new JsonResponse([
            'error' => self::CODE,
            'code' => self::CODE,
            'message' => 'Tu agencia ya usó las '.number_format($limit, 0, '.', ' ').' llamadas a la API que incluye su plan este mes. Se renuevan el '.$resets->format('d/m/Y').' o al mejorar el plan.',
            'correlation_id' => AssignCorrelationId::current(),
            'details' => ['limit' => $limit, 'used' => $used, 'resets_at' => $resets->toIso8601String()],
        ], 429, $this->headers($limit, $used) + ['Retry-After' => (string) $retry]);
    }

    public function hit(string $tenantId): void
    {
        $this->used($tenantId);
        Cache::increment($this->key($tenantId));
        UsageMeter::record($tenantId, self::METRIC);
    }

    public function headers(?int $limit, int $used): array
    {
        return $limit === null ? [] : [
            'X-Quota-Limit' => (string) $limit,
            'X-Quota-Remaining' => (string) max(0, $limit - $used),
        ];
    }

    public function forget(string $tenantId): void
    {
        Cache::forget("api-quota:limit:{$tenantId}");
        Cache::forget($this->key($tenantId));
    }

    private function measured(string $tenantId): int
    {
        $consolidated = (int) DB::connection('pgsql_platform')->table('usage_monthly')->where('tenant_id', $tenantId)->where('metric', self::METRIC)
            ->where('month', Carbon::now(self::ZONE)->startOfMonth()->toDateString())->value('value');

        return max($consolidated, UsageMeter::used($tenantId, self::METRIC));
    }

    private function key(string $tenantId): string
    {
        return "usage:{$tenantId}:api_calls:".Carbon::now(self::ZONE)->format('Ym');
    }

    private function resetsAt(): Carbon
    {
        return Carbon::now(self::ZONE)->startOfMonth()->addMonth();
    }
}
