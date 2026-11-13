<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Facades\DB;

final class ClientDuplicates
{
    public function hard(?string $docType, ?string $docNumber, ?string $excludeId = null): ?object
    {
        $number = strtoupper((string) preg_replace('/\s+/', '', (string) $docNumber));

        if ($docType === null || $docType === '' || $number === '') {
            return null;
        }

        return DB::table('crm_clients')->where('doc_type', $docType)->where('doc_number', $number)->whereNull('deleted_at')
            ->when($excludeId, fn ($query) => $query->where('id', '<>', $excludeId))->orderBy('code')->first(['code', 'name']);
    }

    public function soft(?string $email, ?string $phone, ?string $excludeId = null): array
    {
        $email = mb_strtolower(trim((string) $email)) ?: null;
        $phoneNorm = ClientDocument::phoneNorm($phone);

        if ($email === null && $phoneNorm === null) {
            return [];
        }

        return DB::table('crm_clients')->whereNull('deleted_at')
            ->when($excludeId, fn ($query) => $query->where('id', '<>', $excludeId))
            ->where(function ($query) use ($email, $phoneNorm): void {
                if ($email) {
                    $query->orWhere('email_norm', $email);
                }
                if ($phoneNorm) {
                    $query->orWhere('phone_norm', $phoneNorm);
                }
            })->orderBy('code')->get(['code', 'name', 'email_norm', 'phone_norm'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'by' => array_values(array_filter([$email !== null && $row->email_norm === $email ? 'email' : null, $phoneNorm !== null && $row->phone_norm === $phoneNorm ? 'phone' : null])),
            ])->all();
    }
}
