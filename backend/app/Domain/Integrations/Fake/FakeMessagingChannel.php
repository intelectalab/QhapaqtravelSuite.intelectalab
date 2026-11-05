<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\OutboundMessage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

final class FakeMessagingChannel implements MessagingChannel
{
    public array $sent = [];

    public function send(OutboundMessage $message): AdapterResult
    {
        if ($message->channel === 'whatsapp' && $message->templateCode === null && ! $this->canSendFreeText($message->to)) {
            return AdapterResult::permanent('Fuera de la ventana de 24 h: use una plantilla aprobada (INB-BR-02).');
        }

        $this->sent[] = $message;
        Log::channel('stack')->info('fake-messaging', ['channel' => $message->channel, 'to' => '***'.substr($message->to, -4)]);

        return AdapterResult::success('enviado', 'FAKE-MSG-'.Str::lower(Str::random(12)), ['simulated' => true]);
    }

    public function canSendFreeText(string $to): bool
    {
        return ! str_starts_with($to, '+00');
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
