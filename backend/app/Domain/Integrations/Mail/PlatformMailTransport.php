<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Mail;

use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Platform\Support\OutgoingMail;
use Illuminate\Mail\MailManager;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
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
        $redirect = $this->settings->redirect();

        if ($connection === null && IntegrationReadiness::enforced()) {
            throw new TransportException('El correo de KipuControl no está configurado en la consola (Integraciones › Correo de salida): el mensaje no se envió.');
        }

        if ($connection === null || ($redirect !== null && ($redirect['to'] === null || ! $message instanceof Email))) {
            return $this->mail->mailer($this->fallback)->getSymfonyTransport()->send($message, $envelope);
        }

        if ($message instanceof Email) {
            $message->from(new Address($connection['from_address'], $connection['from_name']));

            if ($redirect !== null) {
                $this->redirectTo($message, (string) $redirect['to']);
            }

            $envelope = Envelope::create($message);
        }

        return $this->smtp->make($connection)->send($message, $envelope);
    }

    private function redirectTo(Email $message, string $to): void
    {
        $original = implode(', ', array_map(fn (Address $address): string => $address->getAddress(), [...$message->getTo(), ...$message->getCc(), ...$message->getBcc()]));
        $headers = $message->getHeaders();
        $headers->remove('Cc');
        $headers->remove('Bcc');
        $headers->remove('X-Original-To');
        $headers->addTextHeader('X-Original-To', $original);
        $message->to($to)->subject("[Para {$original}] ".(string) $message->getSubject());
    }

    public function __toString(): string
    {
        return 'platform';
    }
}
