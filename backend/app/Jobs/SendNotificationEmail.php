<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

final class SendNotificationEmail implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = 5;

    public function __construct(public readonly string $messageId)
    {
        $this->onQueue('notifications');
    }

    public function backoff(): array
    {
        return [60, 120, 240, 480, 960];
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(): void
    {
        $message = DB::table('notif_messages')->where('id', $this->messageId)->lockForUpdate()->first(['id', 'status', 'recipient_address', 'subject', 'body_rendered']);

        if ($message === null || $message->status !== 'pendiente' || ! str_contains((string) $message->recipient_address, '@')) {
            return;
        }

        try {
            Mail::raw((string) $message->body_rendered, fn ($mail) => $mail->to((string) $message->recipient_address)->subject((string) $message->subject));
        } catch (Throwable $e) {
            DB::table('notif_messages')->where('id', $message->id)->update(['retries' => DB::raw('retries + 1'), 'last_error' => mb_substr($e->getMessage(), 0, 500)]);

            throw $e;
        }

        DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'enviado', 'sent_at' => now(), 'last_error' => null]);
    }

    public function failed(Throwable $e): void
    {
        if ($this->tenantId === null) {
            return;
        }

        app(TenantDatabase::class)->run($this->tenantId, fn () => DB::table('notif_messages')->where('id', $this->messageId)->where('status', 'pendiente')
            ->update(['status' => 'fallido', 'last_error' => mb_substr($e->getMessage(), 0, 500)]));
    }
}
