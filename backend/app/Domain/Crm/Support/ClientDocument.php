<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Shared\Errors\ApiException;

final class ClientDocument
{
    public const TYPES = ['DNI', 'RUC', 'PASAPORTE', 'CE'];

    public static function normalize(string $kind, string $type, string $number, string $country): string
    {
        $number = preg_replace('/\s+/', '', $number) ?? '';

        if ($number === '') {
            throw ApiException::unprocessable('CRM-BR-15', 'Escribe el número de documento.');
        }

        if ($type === 'DNI' && ! preg_match('/^\d{8}$/', $number)) {
            throw ApiException::unprocessable('CRM-BR-15', 'El DNI tiene 8 dígitos.');
        }

        if ($type === 'RUC' && ! preg_match('/^(10|15|17|20)\d{9}$/', $number)) {
            throw ApiException::unprocessable('CRM-BR-15', 'El RUC tiene 11 dígitos y empieza con 10, 15, 17 o 20.');
        }

        if ($kind === 'empresa' && $country === 'Perú' && $type !== 'RUC') {
            throw ApiException::unprocessable('CRM-BR-15', 'Una empresa en Perú se registra con RUC.');
        }

        return strtoupper($number);
    }

    public static function phoneNorm(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        return $digits === '' ? null : substr($digits, -9);
    }
}
