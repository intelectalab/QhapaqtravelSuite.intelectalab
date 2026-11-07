<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Support\Facades\DB;

final class PurgeWebhookDeliveries extends PlatformJob
{
    public const QUEUE = 'low';

    public const KEEP_DAYS = 30;

    protected function run(): string
    {
        $deleted = DB::connection('pgsql_platform')->table('integration_webhook_deliveries')
            ->whereIn('status', ['delivered', 'failed'])
            ->where('created_at', '<', now()->subDays(self::KEEP_DAYS))
            ->delete();

        return $deleted === 0 ? 'Sin entregas antiguas por depurar' : self::plural($deleted, 'entrega depurada', 'entregas depuradas').' (más de '.self::KEEP_DAYS.' días)';
    }
}
