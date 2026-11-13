<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use Closure;

final class IpRange
{
    public static function valid(string $value): bool
    {
        [$address, $prefix] = array_pad(explode('/', trim($value), 2), 2, null);
        $binary = filter_var($address, FILTER_VALIDATE_IP) !== false ? inet_pton((string) $address) : false;

        if ($binary === false) {
            return false;
        }

        if ($prefix === null) {
            return true;
        }

        $bits = strlen($binary) * 8;

        if (! ctype_digit($prefix) || (int) $prefix > $bits) {
            return false;
        }

        $host = $bits - (int) $prefix;

        for ($bit = 0; $bit < $host; $bit++) {
            $byte = strlen($binary) - 1 - intdiv($bit, 8);

            if ((ord($binary[$byte]) >> ($bit % 8)) & 1) {
                return false;
            }
        }

        return true;
    }

    public static function rule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || ! self::valid($value)) {
                $fail('Escribe direcciones IP o rangos CIDR válidos, como 203.0.113.10 o 203.0.113.0/24.');
            }
        };
    }
}
