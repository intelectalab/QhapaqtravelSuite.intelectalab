<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Mail;

use App\Domain\Platform\Support\OutgoingMail;
use Illuminate\Mail\MailManager;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;

final class PlatformMailTransport implements TransportInterface
{
    public function __construct(
        private readonly OutgoingMail $settings,
        private readonly SmtpConnector $smtp,
        private readonly MailManager $mail,
        private readonly string $fallback,
    ) {}

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        $connection = $this->settings->connection();

        if ($connection === null) {
            return $this->mail->mailer($this->fallback)->getSymfonyTransport()->send($message, $envelope);
        }

        if ($message instanceof Email) {
            $message->from(new Address($connection['from_address'], $connection['from_name']));
            $envelope = Envelope::create($message);
        }

        return $this->smtp->make($connection)->send($message, $envelope);
    }

    public function __toString(): string
    {
        return 'platform';
    }
}
