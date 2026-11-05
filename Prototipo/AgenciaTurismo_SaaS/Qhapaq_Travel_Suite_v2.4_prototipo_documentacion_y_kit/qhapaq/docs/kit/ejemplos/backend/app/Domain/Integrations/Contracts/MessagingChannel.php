<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\OutboundMessage;

/**
 * Canal de mensajería saliente (WhatsApp Business, SMS; spec 10 `SendOutboundMessage`, spec 00 §8.1; D-03).
 * El email usa el Mailer de Laravel con su propio transporte; este contrato cubre los canales con API externa.
 */
interface MessagingChannel extends HealthCheckable
{
    /** Envía; `externalId` = id del mensaje del proveedor (collab_messages.external_message_id). */
    public function send(OutboundMessage $message): AdapterResult;

    /** ¿Se puede enviar texto libre a este destinatario? (ventana de 24 h de WhatsApp, INB-BR-02). */
    public function canSendFreeText(string $to): bool;
}
