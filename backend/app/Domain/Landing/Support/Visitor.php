<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use Illuminate\Http\Request;

final class Visitor
{
    public static function dailyHash(string $value): string
    {
        return hash_hmac('sha256', now('America/Lima')->toDateString().'|'.$value, (string) config('app.key'));
    }

    public static function stableHash(string $value): string
    {
        return hash_hmac('sha256', 'landing|'.mb_strtolower(trim($value)), (string) config('app.key'));
    }

    public static function ipHash(Request $request): string
    {
        return self::dailyHash('ip|'.(string) $request->ip());
    }

    public static function fingerprint(Request $request): string
    {
        return self::dailyHash('visitor|'.(string) $request->ip().'|'.mb_substr((string) $request->userAgent(), 0, 240));
    }
}
