<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class InboxSeeder
{
    use SeedsTenant;

    private const CHANNELS = ['Portal' => 'portal', 'Web chat' => 'webchat', 'WhatsApp' => 'whatsapp', 'Email' => 'email', 'Formulario' => 'form'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('inboxTemplates') as $seed) {
            $whatsapp = (bool) ($seed['wa'] ?? false);
            $this->upsert('collab_reply_templates', ['code' => $seed['id']], [
                'name' => $seed['name'],
                'body' => $seed['text'],
                'channels' => $whatsapp ? '{whatsapp}' : '{whatsapp,email,webchat,form,portal}',
                'is_whatsapp_approved' => $whatsapp,
                'whatsapp_template_name' => $whatsapp ? 'seguimiento_consulta' : null,
                'whatsapp_language' => $whatsapp ? 'es' : null,
                'is_active' => true,
            ]);
        }

        foreach (KitSeeds::read('conversations') as $seed) {
            $this->seedConversation($seed);
        }
    }

    private function seedConversation(array $seed): void
    {
        $channel = self::CHANNELS[$seed['channel']] ?? 'webchat';
        $messages = $seed['messages'];
        $inbound = array_values(array_filter($messages, fn (array $message): bool => $message['from'] === 'contact'));
        $last = end($messages) ?: ['ts' => $seed['createdAt']];
        $resolved = $seed['status'] === 'resuelta';

        $id = $this->upsert('collab_conversations', ['code' => $seed['id']], [
            'channel' => $channel,
            'contact_name' => $seed['contact']['name'],
            'contact_email' => $seed['contact']['email'] ?? null,
            'contact_phone' => $seed['contact']['phone'] ?? null,
            'subject' => $seed['subject'],
            'status' => $seed['status'],
            'priority' => $seed['priority'] ?? 'media',
            'tags' => '{'.implode(',', array_map(fn (string $tag): string => '"'.str_replace('"', '', $tag).'"', $seed['tags'] ?? [])).'}',
            'assignee_id' => $seed['assignee'] ? $this->userId($seed['assignee']) : null,
            'client_id' => $this->idByCode('crm_clients', $seed['clientId'] ?? null),
            'lead_id' => $this->idByCode('crm_leads', $seed['leadId'] ?? null),
            'reservation_id' => $this->idByCode('booking_reservations', $seed['resId'] ?? null),
            'quote_id' => $this->idByCode('quote_quotes', $seed['quoteId'] ?? null),
            'first_response_due_at' => $this->moment($seed['slaDueAt'] ?? $seed['createdAt']),
            'first_response_at' => $this->moment($seed['firstResponseAt'] ?? null),
            'last_inbound_at' => $inbound === [] ? null : $this->moment(end($inbound)['ts']),
            'last_message_at' => $this->moment($last['ts']),
            'unread_count' => $seed['unread'] ?? 0,
            'resolved_at' => $resolved ? $this->moment($seed['resolvedAt'] ?? $last['ts']) : null,
            'resolved_by' => $resolved ? $this->userId($seed['resolvedBy'] ?? $seed['assignee']) : null,
            'created_at' => $this->moment($seed['createdAt']),
            'updated_at' => $this->moment($last['ts']),
        ]);

        if (DB::table('collab_messages')->where('conversation_id', $id)->exists()) {
            return;
        }

        foreach ($messages as $message) {
            $from = $message['from'];
            $direction = match (true) {
                $from === 'contact' => 'in',
                $from === 'system' || ($message['type'] ?? '') === 'event' => 'system',
                ($message['type'] ?? '') === 'note' => 'internal',
                default => 'out',
            };
            $messageId = (string) Str::uuid7();

            DB::table('collab_messages')->insert([
                'id' => $messageId,
                'tenant_id' => $this->tenant->getKey(),
                'conversation_id' => $id,
                'channel' => $channel,
                'direction' => $direction,
                'author_user_id' => in_array($direction, ['out', 'internal'], true) ? $this->userId($from) : null,
                'body' => $message['text'],
                'delivery_status' => $direction === 'out' ? 'entregado' : null,
                'sent_at' => $this->moment($message['ts']),
                'created_at' => $this->moment($message['ts']),
            ]);

            foreach ($message['attachments'] ?? [] as $file) {
                DB::table('collab_message_attachments')->insert([
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => $this->tenant->getKey(),
                    'message_id' => $messageId,
                    'file_name' => $file,
                    'mime' => str_ends_with($file, '.pdf') ? 'application/pdf' : 'application/octet-stream',
                    'size_bytes' => 248000,
                    'storage_path' => "tenants/{$this->tenant->getKey()}/inbox/{$messageId}-{$file}",
                    'sha256' => hash('sha256', $file),
                    'scan_status' => 'limpio',
                    'created_at' => $this->moment($message['ts']),
                ]);
            }
        }
    }
}
