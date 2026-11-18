<?php

declare(strict_types=1);

namespace App\Domain\Shared\Mail;

use App\Domain\Integrations\Mail\AgencyMailbox;
use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Jobs\SendPlainMail;
use Throwable;

final class QueuedMail
{
    public function send(string $to, ?string $name, string $subject, string $body): void
    {
        $this->dispatch(new SendPlainMail($to, $name, $subject, $body));
    }

    public function sendAsAgency(string $to, ?string $name, string $subject, string $body): bool
    {
        $sender = app(AgencyMailbox::class)->connection();

        if ($sender === null && IntegrationReadiness::enforced()) {
            return false;
        }

        $this->dispatch(new SendPlainMail($to, $name, $subject, $body, $sender));

        return true;
    }

    private function dispatch(SendPlainMail $job): void
    {
        try {
            dispatch($job)->afterCommit();
        } catch (Throwable $e) {
            report($e);
        }
    }
}
