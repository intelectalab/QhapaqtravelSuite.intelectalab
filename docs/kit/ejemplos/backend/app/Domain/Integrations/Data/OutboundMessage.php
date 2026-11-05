<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

/**
 * Mensaje saliente por canal (spec 10 inbox, spec 17 mensajes al pasajero, spec 00 §8.1 Notify).
 * WhatsApp fuera de la ventana de 24 h solo con plantilla aprobada por Meta (INB-BR-02): `templateCode` obligatorio.
 */
final readonly class OutboundMessage
{
    /** @param array<string, string> $variables */
    public function __construct(
        public string $channel,        // whatsapp | email | sms
        public string $to,             // teléfono E.164 o email
        public ?string $subject = null,
        public ?string $body = null,
        public ?string $templateCode = null,
        public array $variables = [],
        public ?string $locale = 'es',
    ) {
    }
}
