<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Mail;

use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Integrations\Support\IntegrationCatalog;
use App\Domain\Integrations\Support\IntegrationReadiness;
use Throwable;

final class RoutedMessagingChannel implements MessagingChannel
{
    public function __construct(
        private readonly MessagingChannel $channels,
        private readonly AgencyMailbox $mailbox,
        private readonly AgencyMailer $mailer,
        private readonly SmtpConnector $smtp,
    ) {}

    public function send(OutboundMessage $message): AdapterResult
    {
        if (mb_strtolower($message->channel) !== 'email') {
            return $this->channels->send($message);
        }

        $connection = $this->mailbox->connection();

        if ($connection === null) {
            return IntegrationReadiness::enforced() ? AdapterResult::permanent(IntegrationCatalog::missing('email')) : $this->channels->send($message);
        }

        try {
            return AdapterResult::success('enviado', $this->mailer->deliver($connection, $message->to, null, (string) ($message->subject ?? ''), (string) ($message->body ?? ''), $message->html));
        } catch (Throwable $exception) {
            report($exception);

            return AdapterResult::transient($this->smtp->explain($exception, $connection));
        }
    }

    public function canSendFreeText(string $to): bool
    {
        return $this->channels->canSendFreeText($to);
    }

    public function healthcheck(): AdapterResult
    {
        return $this->channels->healthcheck();
    }
}
