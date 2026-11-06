<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class NotificationLog
{
    public function record(array $values): object
    {
        $id = (string) Str::uuid7();
        $next = (int) DB::table('notif_messages')->whereNotNull('code')->selectRaw("coalesce(max(nullif(substring(code from '(\\d+)$'), '')::bigint), 9000) as last")->value('last') + 1;

        DB::table('notif_messages')->insert([
            'id' => $id,
            'code' => "NTF-{$next}",
            'audience' => 'internal',
            'status' => 'enviado',
            'retries' => 0,
            'is_fallback' => false,
            'sent_at' => ($values['status'] ?? 'enviado') === 'enviado' ? now() : null,
            'created_at' => now(),
            ...$values,
        ]);

        return DB::table('notif_messages')->where('id', $id)->first();
    }
}
