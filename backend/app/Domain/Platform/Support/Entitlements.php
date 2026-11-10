<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class Entitlements
{
    private const TTL = 600;

    private const VERSION_KEY = 'ent:version';

    private array $memo = [];

    public function for(string $tenantId): array
    {
        $key = 'ent:'.self::version().':'.$tenantId;

        return $this->memo[$key] ??= Cache::remember($key, self::TTL, fn (): array => $this->resolve($tenantId));
    }

    public function enabled(string $tenantId, string $feature): bool
    {
        return (bool) ($this->for($tenantId)[$feature]['enabled'] ?? false);
    }

    public function label(string $feature): string
    {
        return (string) ($this->db()->table('features')->where('key', $feature)->value('label') ?? $feature);
    }

    public static function flush(): void
    {
        Cache::forever(self::VERSION_KEY, self::version() + 1);
    }

    private static function version(): int
    {
        return (int) Cache::get(self::VERSION_KEY, 1);
    }

    private function resolve(string $tenantId): array
    {
        $db = $this->db();
        $today = Carbon::today()->toDateString();
        $planId = $db->table('tenants')->where('id', $tenantId)->value('plan_id');
        $plan = $planId === null ? collect() : $db->table('plan_features')->where('plan_id', $planId)->pluck('value', 'feature_key');
        $overrides = $db->table('feature_overrides')->where('tenant_id', $tenantId)
            ->where(fn ($query) => $query->whereNull('valid_until')->orWhere('valid_until', '>=', $today))
            ->orderBy('created_at')->get(['feature_key', 'value', 'valid_until'])->keyBy('feature_key');
        $addons = $db->table('subscription_items as i')->join('subscriptions as s', 's.id', '=', 'i.subscription_id')
            ->where('s.tenant_id', $tenantId)->whereNotIn('s.status', ['canceled'])
            ->where(fn ($query) => $query->whereNull('i.ends_at')->orWhere('i.ends_at', '>', now()))
            ->pluck('i.addon_code')->unique()->flip();

        return $db->table('features')->orderBy('key')->get(['key', 'label', 'module', 'addon_code'])
            ->mapWithKeys(function (object $feature) use ($plan, $overrides, $addons): array {
                $override = $overrides->get($feature->key);
                $inPlan = $plan->has($feature->key);
                [$enabled, $source] = match (true) {
                    $override !== null => [(bool) $override->value, 'override'],
                    $feature->addon_code !== null && $addons->has($feature->addon_code) => [true, 'addon'],
                    $inPlan => [true, 'plan'],
                    default => [false, 'none'],
                };

                return [$feature->key => [
                    'enabled' => $enabled,
                    'source' => $source,
                    'level' => $inPlan ? (string) $plan->get($feature->key) : null,
                    'label' => (string) $feature->label,
                    'module' => (string) $feature->module,
                    'valid_until' => $override?->valid_until,
                ]];
            })->all();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
