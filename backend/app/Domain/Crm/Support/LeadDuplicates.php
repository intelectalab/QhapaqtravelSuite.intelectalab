<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Facades\DB;

final class LeadDuplicates
{
    public const OPEN = ['nuevo', 'contactado', 'calificado'];

    public function find(?string $email, ?string $phone, ?string $excludeId = null): array
    {
        $email = $email ? mb_strtolower(trim($email)) : null;
        $phone = self::phoneNorm($phone);

        if ($email === null && $phone === null) {
            return [];
        }

        $match = fn ($query) => $query->where(function ($where) use ($email, $phone): void {
            if ($email) {
                $where->orWhere('email_norm', $email);
            }
            if ($phone) {
                $where->orWhere('phone_norm', $phone);
            }
        });

        $leads = $match(DB::table('crm_leads')->whereNull('deleted_at')->whereNotIn('status', ['duplicado'])->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId)))
            ->orderBy('created_at')->get(['id', 'code', 'full_name as name', 'status', 'email_norm', 'phone_norm'])
            ->map(fn (object $row) => ['type' => 'lead', 'id' => $row->id, 'code' => $row->code, 'name' => $row->name, 'status' => $row->status, 'by' => $this->by($row, $email, $phone)]);
        $clients = $match(DB::table('crm_clients')->whereNull('deleted_at'))->get(['id', 'code', 'name', 'segment_code', 'email_norm', 'phone_norm'])
            ->map(fn (object $row) => ['type' => 'client', 'id' => $row->id, 'code' => $row->code, 'name' => $row->name, 'status' => $row->segment_code, 'by' => $this->by($row, $email, $phone)]);

        return $clients->concat($leads)->values()->all();
    }

    public static function phoneNorm(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        return $digits === '' ? null : substr($digits, -9);
    }

    private function by(object $row, ?string $email, ?string $phone): array
    {
        return array_values(array_filter([
            $email && $row->email_norm === $email ? 'email' : null,
            $phone && $row->phone_norm === $phone ? 'phone' : null,
        ]));
    }
}
