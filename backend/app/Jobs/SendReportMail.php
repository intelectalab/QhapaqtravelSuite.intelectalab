<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Mail\Message;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

final class SendReportMail implements ShouldQueue
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
        public readonly array $files,
    ) {
        $this->onQueue('notifications');
    }

    public function backoff(): array
    {
        return [60, 120, 240, 480, 960];
    }

    public function handle(): void
    {
        Mail::raw($this->body, function (Message $message): void {
            $message->to($this->to, $this->name)->subject($this->subject);

            foreach ($this->files as $file) {
                $message->attachData((string) Storage::disk($file['disk'])->get($file['path']), $file['name'], ['mime' => $file['mime']]);
            }
        });
    }
}
