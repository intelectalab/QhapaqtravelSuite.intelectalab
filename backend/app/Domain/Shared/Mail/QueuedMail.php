<?php

declare(strict_types=1);

namespace App\Domain\Shared\Mail;

use App\Jobs\SendPlainMail;
use Throwable;

final class QueuedMail
{
    public function send(string $to, ?string $name, string $subject, string $body): void
    {
        try {
            dispatch(new SendPlainMail($to, $name, $subject, $body))->afterCommit();
        } catch (Throwable $e) {
            report($e);
        }
    }
}
