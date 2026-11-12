<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ReadOnlyWindow
{
    public const TRIAL_DAYS = 7;

    public const CANCELED_DAYS = 30;

    public const ALLOWED = ['subscription.', 'auth.', 'me', 'notifications.'];

    public static function until(string $tenantId, ?Carbon $today = null): ?string
    {
        return self::state($tenantId, $today)['until'] ?? null;
    }

    public static function state(string $tenantId, ?Carbon $today = null): ?array
    {
        $subscription = DB::connection('pgsql_platform')->table('subscriptions')->where('tenant_id', $tenantId)->orderByDesc('created_at')
            ->first(['status', 'trial_ends_at', 'current_period_end']);
        $until = $subscription === null ? null : self::end($subscription, $today ?? Carbon::today('America/Lima'));

        if ($until === null) {
            return null;
        }

        return ['until' => $until, 'reason' => $subscription->status === 'canceled' ? 'canceled' : 'trial'];
    }

    public static function end(object $subscription, Carbon $today): ?string
    {
        $end = match (true) {
            $subscription->status === 'suspended' && $subscription->trial_ends_at !== null => Carbon::parse($subscription->trial_ends_at)->addDays(self::TRIAL_DAYS),
            $subscription->status === 'canceled' => Carbon::parse($subscription->current_period_end)->addDays(self::CANCELED_DAYS),
            default => null,
        };

        return $end !== null && $today->lte($end) ? $end->toDateString() : null;
    }

    public static function expired(object $subscription, Carbon $today): bool
    {
        return in_array($subscription->status, ['suspended', 'canceled'], true) && self::end($subscription, $today) === null;
    }

    public static function allows(?string $routeName): bool
    {
        if ($routeName === null) {
            return false;
        }

        foreach (self::ALLOWED as $prefix) {
            if (str_ends_with($prefix, '.') ? str_starts_with($routeName, $prefix) : ($routeName === $prefix || str_starts_with($routeName, $prefix.'.'))) {
                return true;
            }
        }

        return str_contains($routeName, 'export');
    }
}
