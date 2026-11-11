<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Str;

final class ClaimConsumer
{
    public const DOC_TYPES = ['DNI', 'CE', 'Pasaporte', 'RUC'];

    public const GUARDIAN_DOC_TYPES = ['DNI', 'CE', 'Pasaporte'];

    public const RELATIONS = ['Padre', 'Madre', 'Apoderado'];

    public static function docRule(mixed $type): array
    {
        return match ($type) {
            'DNI' => ['regex:/^\d{8}$/'],
            'CE' => ['regex:/^[A-Za-z0-9]{9,12}$/'],
            'RUC' => ['regex:/^(10|15|17|20)\d{9}$/'],
            default => ['regex:/^[A-Za-z0-9]{6,15}$/'],
        };
    }

    public static function guardianRules(mixed $docType): array
    {
        return [
            'is_minor' => ['boolean'],
            'guardian_name' => ['required_if:is_minor,true', 'nullable', 'string', 'min:5', 'max:150'],
            'guardian_doc_type' => ['required_if:is_minor,true', 'nullable', 'in:'.implode(',', self::GUARDIAN_DOC_TYPES)],
            'guardian_doc_number' => ['required_if:is_minor,true', 'nullable', 'string', ...self::docRule($docType)],
            'guardian_relation' => ['required_if:is_minor,true', 'nullable', 'in:'.implode(',', self::RELATIONS)],
        ];
    }

    public static function guardianMessages(): array
    {
        return [
            'guardian_name.*' => 'Escribe el nombre del padre, madre o apoderado.',
            'guardian_doc_type.*' => 'Elige el tipo de documento del apoderado.',
            'guardian_doc_number.*' => 'Revisa el documento del padre, madre o apoderado.',
            'guardian_relation.*' => 'Indica la relación con el menor.',
        ];
    }

    public static function build(array $base, array $data): array
    {
        $minor = (bool) ($data['is_minor'] ?? false);

        return [
            'name' => trim((string) $base['name']),
            'doc_type' => $base['doc_type'],
            'doc_number' => Str::upper(trim((string) $base['doc_number'])),
            'address' => $base['address'] ?? null,
            'email' => isset($base['email']) ? Str::lower(trim((string) $base['email'])) : null,
            'phone' => $base['phone'] ?? null,
            'is_minor' => $minor,
            'guardian' => $minor ? [
                'name' => trim((string) $data['guardian_name']),
                'doc_type' => $data['guardian_doc_type'],
                'doc_number' => Str::upper(trim((string) $data['guardian_doc_number'])),
                'relation' => $data['guardian_relation'],
            ] : null,
        ];
    }

    public static function read(array $stored): array
    {
        $guardian = is_array($stored['guardian'] ?? null) ? $stored['guardian'] : null;

        return [
            'name' => $stored['name'] ?? 'Consumidor',
            'doc_type' => $stored['doc_type'] ?? $stored['docType'] ?? null,
            'doc_number' => $stored['doc_number'] ?? $stored['docNumber'] ?? null,
            'email' => $stored['email'] ?? null,
            'phone' => $stored['phone'] ?? null,
            'address' => $stored['address'] ?? null,
            'is_minor' => (bool) ($stored['is_minor'] ?? $stored['minor'] ?? false),
            'guardian' => $guardian ? [
                'name' => $guardian['name'] ?? null,
                'doc_type' => $guardian['doc_type'] ?? $guardian['docType'] ?? null,
                'doc_number' => $guardian['doc_number'] ?? $guardian['docNumber'] ?? null,
                'relation' => $guardian['relation'] ?? null,
            ] : null,
        ];
    }
}
