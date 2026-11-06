<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

final class VoucherToken
{
    public static function make(string $code, string $reservation, int $version): string
    {
        return hash_hmac('sha256', "{$code}|{$reservation}|{$version}", (string) config('app.key'));
    }
}
