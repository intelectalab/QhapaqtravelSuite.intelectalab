<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Mail;

use App\Domain\Platform\Support\OutgoingMail;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class AgencyMailer
{
    public function __construct(private readonly SmtpConnector $smtp, private readonly OutgoingMail $platform) {}

    public function deliver(array $connection, string $to, ?string $name, string $subject, string $body, ?string $html = null): ?string
    {
        $redirect = $this->platform->redirect();
        $fromName = (string) ($connection['from_name'] ?? '');

        if ($redirect !== null && $redirect['to'] === null) {
            Mail::raw($body, fn ($message) => $message->from($connection['from_address'], $fromName === '' ? null : $fromName)->to($to, $name)->subject($subject));

            return null;
        }

        $email = (new Email)
            ->from(new Address($connection['from_address'], $fromName))
            ->to(new Address($redirect === null ? $to : (string) $redirect['to'], $name ?? ''))
            ->subject($redirect === null ? $subject : "[Para {$to}] {$subject}")
            ->text($body);

        if ($html !== null) {
            $email->html($html);
        }

        if ($redirect !== null) {
            $email->getHeaders()->addTextHeader('X-Original-To', $to);
        }

        return $this->smtp->make($connection)->send($email)?->getMessageId();
    }
}
