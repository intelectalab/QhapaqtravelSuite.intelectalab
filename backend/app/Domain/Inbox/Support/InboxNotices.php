<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Facades\DB;

final class InboxNotices
{
    private const CHANNELS = ['whatsapp' => 'WhatsApp', 'email' => 'correo', 'webchat' => 'chat del sitio', 'form' => 'formulario web', 'portal' => 'portal'];

    public function __construct(private readonly StaffNotices $notices) {}

    public function created(string $conversationId): void
    {
        $conversation = $this->conversation($conversationId);

        if ($conversation === null) {
            return;
        }

        $subject = "Nueva conversación de {$conversation->contact_name}";
        $body = 'Llegó por '.(self::CHANNELS[$conversation->channel] ?? $conversation->channel).'. Responde dentro del plazo de primera respuesta.';

        $conversation->assignee_id
            ? $this->notices->toUser((string) $conversation->assignee_id, 'inbox.nueva', $subject, $body, 'collab_conversation', $conversationId)
            : $this->notices->toRoles(['sales', 'manager'], 'inbox.nueva', $subject, $body, 'collab_conversation', $conversationId);
    }

    public function inbound(string $conversationId): void
    {
        $conversation = $this->conversation($conversationId);

        if ($conversation?->assignee_id === null) {
            return;
        }

        $this->notices->toUser((string) $conversation->assignee_id, 'inbox.mensaje', "Nuevo mensaje de {$conversation->contact_name}", 'Te escribió por '.(self::CHANNELS[$conversation->channel] ?? $conversation->channel).'.', 'collab_conversation', $conversationId);
    }

    public function assigned(string $conversationId, string $userId, string $actorId): void
    {
        $conversation = $this->conversation($conversationId);
        $this->notices->toUser($userId, 'inbox.asignada', 'Conversación asignada a ti'.($conversation ? ": {$conversation->contact_name}" : ''), null, 'collab_conversation', $conversationId, null, $actorId);
    }

    public function resolved(string $conversationId): ?string
    {
        $conversation = $this->conversation($conversationId);

        if ($conversation === null || $conversation->channel !== 'portal') {
            return null;
        }

        $agency = $this->notices->agency();

        return $this->notices->email($conversation->contact_email, 'soporte.resuelto', "Resolvimos tu consulta · {$agency}", "Hola, {$conversation->contact_name}:\n\nMarcamos tu consulta como resuelta. Si necesitas algo más, escríbenos desde tu portal y la reabrimos.\n\n{$agency}", 'collab_conversation', $conversationId, 'client', ['client_id' => $conversation->client_id]);
    }

    private function conversation(string $id): ?object
    {
        return DB::table('collab_conversations')->where('id', $id)->first(['id', 'channel', 'contact_name', 'contact_email', 'assignee_id', 'client_id']);
    }
}
