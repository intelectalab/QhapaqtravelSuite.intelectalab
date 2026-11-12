<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class EffectiveLimits
{
    public const ADDON_METRIC = ['extra_users' => ['users', 1]];

    public static function extras(string $tenantId): array
    {
        $db = DB::connection('pgsql_platform');
        $subscription = $db->table('subscriptions')->where('tenant_id', $tenantId)->whereNotIn('status', ['canceled'])->orderByDesc('created_at')->value('id');

        if ($subscription === null) {
            return [];
        }

        $today = Carbon::today('America/Lima')->toDateString();
        $items = $db->table('subscription_items as i')->join('addons as a', 'a.code', '=', 'i.addon_code')->where('i.subscription_id', $subscription)
            ->where(fn ($query) => $query->whereNull('i.ends_at')->orWhere('i.ends_at', '>=', $today))
            ->get(['i.addon_code', 'i.quantity', 'a.grants']);
        $extras = [];

        foreach ($items as $item) {
            [$metric, $per] = self::grant((string) $item->addon_code, $item->grants);

            if ($metric !== null) {
                $extras[$metric] = ($extras[$metric] ?? 0) + max(1, (int) $item->quantity) * $per;
            }
        }

        return $extras;
    }

    public static function grant(string $code, mixed $grants): array
    {
        $grants = is_string($grants) ? json_decode($grants, true) : (array) $grants;

        return self::ADDON_METRIC[$code] ?? (is_array($grants) && $grants !== [] && ! isset($grants['feature']) ? [(string) array_key_first($grants), (int) reset($grants)] : [null, 0]);
    }

    public static function limit(string $tenantId, string $planId, string $metric): ?int
    {
        $base = DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', $planId)->where('metric', $metric)->value('value');

        return $base === null ? null : (int) $base + (int) (self::extras($tenantId)[$metric] ?? 0);
    }
}
