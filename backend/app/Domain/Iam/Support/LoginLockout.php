<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Shared\Errors\ApiException;
use Closure;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

final class LoginLockout
{
    public static function agencyKey(string $tenantId, string $email): string
    {
        return 'lockout:t:'.$tenantId.':'.sha1(Str::lower(trim($email)));
    }

    public static function platformKey(string $email): string
    {
        return 'lockout:p:'.sha1(Str::lower(trim($email)));
    }

    public function ensureOpen(string $key): void
    {
        if (RateLimiter::tooManyAttempts($key, $this->attempts())) {
            throw $this->locked($key);
        }
    }

    public function fail(string $key, ?Closure $onLock = null): void
    {
        RateLimiter::hit($key, $this->minutes() * 60);

        if (RateLimiter::attempts($key) >= $this->attempts()) {
            if ($onLock !== null) {
                $onLock();
            }
            throw $this->locked($key);
        }
    }

    public function clear(string $key): void
    {
        RateLimiter::clear($key);
    }

    public function attempts(): int
    {
        return max(1, (int) config('access.lockout.attempts', 5));
    }

    public function minutes(): int
    {
        return max(1, (int) config('access.lockout.minutes', 15));
    }

    private function locked(string $key): ApiException
    {
        $minutes = max(1, (int) ceil(RateLimiter::availableIn($key) / 60));

        return new ApiException(429, 'RATE_LIMITED', 'ACCOUNT_LOCKED', "La cuenta quedó bloqueada por varios intentos fallidos. Vuelve a intentarlo en {$minutes} min.", [], ['retry_after_minutes' => $minutes]);
    }
}
