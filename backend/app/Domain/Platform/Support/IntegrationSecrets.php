<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class IntegrationSecrets
{
    public static function seal(array $values): string
    {
        $clean = array_filter(array_map(fn (mixed $value): string => trim((string) $value), $values), fn (string $value): bool => $value !== '');

        return $clean === [] ? '' : Crypt::encryptString((string) json_encode($clean, JSON_UNESCAPED_UNICODE));
    }

    public static function open(?string $sealed): array
    {
        if ($sealed === null || $sealed === '') {
            return [];
        }

        try {
            return (array) json_decode(Crypt::decryptString($sealed), true);
        } catch (DecryptException) {
            return [];
        }
    }

    public static function missing(array $fields, array $values): array
    {
        return array_values(array_filter(array_keys($fields), fn (string $field): bool => trim((string) ($values[$field] ?? '')) === ''));
    }

    public static function mask(array $fields, array $values): array
    {
        return collect($fields)->map(fn (string $label, string $field): array => [
            'field' => $field,
            'label' => $label,
            'set' => trim((string) ($values[$field] ?? '')) !== '',
            'hint' => self::hint((string) ($values[$field] ?? '')),
        ])->values()->all();
    }

    public static function merge(array $current, array $incoming, array $fields): array
    {
        $merged = $current;

        foreach (array_keys($fields) as $field) {
            $value = trim((string) ($incoming[$field] ?? ''));

            if ($value !== '') {
                $merged[$field] = $value;
            }
        }

        return array_intersect_key($merged, $fields);
    }

    private static function hint(string $value): ?string
    {
        $value = trim($value);

        return $value === '' ? null : '••••'.mb_substr($value, -min(4, max(1, intdiv(mb_strlen($value), 3))));
    }
}
