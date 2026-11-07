<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Outbox\OutboxMessagePublished;
use Illuminate\Support\Facades\DB;
use Throwable;

final class RelayOutbox extends TenantJob
{
    public const QUEUE = 'integrations';

    public const BATCH = 200;

    public const MAX_ATTEMPTS = 5;

    public int $uniqueFor = 120;

    protected function run(): string
    {
        $rows = DB::table('sys_outbox')->where('status', 'pending')->where('available_at', '<=', now())
            ->orderBy('created_at')->limit(self::BATCH)->lock('for update skip locked')
            ->get(['id', 'aggregate_type', 'aggregate_id', 'event', 'payload', 'attempts']);

        $published = 0;
        $failed = 0;

        foreach ($rows as $row) {
            try {
                DB::transaction(fn () => event(new OutboxMessagePublished(
                    (string) $this->tenantId,
                    (string) $row->id,
                    (string) $row->aggregate_type,
                    (string) $row->aggregate_id,
                    (string) $row->event,
                    (array) json_decode((string) $row->payload, true),
                )));
                DB::table('sys_outbox')->where('id', $row->id)->update(['status' => 'dispatched', 'dispatched_at' => now(), 'attempts' => (int) $row->attempts + 1]);
                $published++;
            } catch (Throwable $e) {
                report($e);
                $attempts = (int) $row->attempts + 1;
                DB::table('sys_outbox')->where('id', $row->id)->update([
                    'attempts' => $attempts,
                    'status' => $attempts >= self::MAX_ATTEMPTS ? 'failed' : 'pending',
                    'available_at' => now()->addMinutes(2 ** $attempts),
                ]);
                $failed++;
            }
        }

        $result = $published === 0 && $failed === 0 ? 'Sin eventos pendientes' : self::plural($published, 'evento publicado', 'eventos publicados');

        return $failed > 0 ? $this->warn($result.' · '.self::plural($failed, 'con error, se reintenta', 'con error, se reintentan')) : $result;
    }
}
