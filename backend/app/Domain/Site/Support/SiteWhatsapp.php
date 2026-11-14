<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use Illuminate\Support\Facades\DB;

final class SiteWhatsapp
{
    public function connected(): ?array
    {
        $account = DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->where('status', 'activo')->orderBy('created_at')->first(['display_phone', 'phone_number_id']);
        $number = self::digits($account->display_phone ?? null) ?? self::digits($account->phone_number_id ?? null);

        return $number === null ? null : ['number' => '+'.$number, 'url' => 'https://wa.me/'.$number, 'source' => 'inbox'];
    }

    public function link(?string $fallback): ?array
    {
        $fallback = trim((string) $fallback);

        return $this->connected() ?? ($fallback === '' ? null : ['number' => null, 'url' => $fallback, 'source' => 'site']);
    }

    public static function digits(?string $value): ?string
    {
        $value = trim((string) $value);

        if (! str_starts_with($value, '+')) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value) ?? '';

        return strlen($digits) >= 8 && strlen($digits) <= 15 ? $digits : null;
    }
}
