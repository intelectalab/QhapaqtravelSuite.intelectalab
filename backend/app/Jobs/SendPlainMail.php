<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Mail;

final class SendPlainMail implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 5;

    public function __construct(
        public readonly string $to,
        public readonly ?string $name,
        public readonly string $subject,
        public readonly string $body,
    ) {
        $this->onQueue('notifications');
    }

    public function backoff(): array
    {
        return [60, 120, 240, 480, 960];
    }

    public function handle(): void
    {
        Mail::raw($this->body, fn ($message) => $message->to($this->to, $this->name)->subject($this->subject));
    }
}
