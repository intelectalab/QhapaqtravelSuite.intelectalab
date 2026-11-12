<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Integrations\Contracts\PushSender;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class SendPushNotification implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = 5;

    public function __construct(public readonly array $userIds, public readonly string $title, public readonly string $body, public readonly array $data = [])
    {
        $this->onQueue('notifications');
    }

    public function backoff(): array
    {
        return [30, 60, 120, 240, 480];
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(PushSender $push): void
    {
        $tokens = DB::table('ops_mobile_devices')->whereIn('user_id', $this->userIds)->whereNull('revoked_at')->whereNotNull('expo_push_token')
            ->pluck('expo_push_token')->unique()->values()->all();

        if ($tokens === []) {
            return;
        }

        $result = $push->send($tokens, $this->title, $this->body, $this->data);

        if (! $result->ok && $result->errorClass === 'transitorio') {
            throw new RuntimeException((string) $result->message);
        }
    }
}
