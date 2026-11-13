<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ConversationDirectory;
use App\Domain\Inbox\Support\InboxNotices;
use App\Domain\Portal\Support\PassengerNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ConversationWorkflow
{
    public function __construct(
        private readonly ConversationDirectory $directory,
        private readonly Advisors $advisors,
        private readonly AuditLogger $audit,
        private readonly ConversationAttachments $attachments,
    ) {}

    public function reply(string $code, array $data, User $actor): void
    {
        $conversation = $this->directory->find($code, $actor);
        $internal = (bool) ($data['internal'] ?? false);
        $template = isset($data['template']) ? DB::table('collab_reply_templates')->whereNull('deleted_at')->where('code', $data['template'])->first(['id', 'is_whatsapp_approved']) : null;

        if (! $internal && $conversation->channel === 'whatsapp' && ! ($template->is_whatsapp_approved ?? false)) {
            $lastInbound = $conversation->last_inbound_at ? Carbon::parse($conversation->last_inbound_at) : null;
            if ($lastInbound === null || $lastInbound->lt(Carbon::now()->subDay())) {
                throw ApiException::unprocessable('INB-BR-02', 'Pasaron más de 24 horas desde el último mensaje del cliente: en WhatsApp solo puedes enviar una plantilla aprobada.');
            }
        }

        $files = $this->attachments->claim((array) ($data['attachments'] ?? []), $actor, $conversation->code);

        DB::transaction(function () use ($conversation, $data, $actor, $internal, $template, $files): void {
            $now = now();
            $messageId = (string) Str::uuid7();
            DB::table('collab_messages')->insert([
                'id' => $messageId,
                'conversation_id' => $conversation->id,
                'channel' => $conversation->channel,
                'direction' => $internal ? 'internal' : 'out',
                'author_user_id' => $actor->getKey(),
                'body' => (string) ($data['body'] ?? ''),
                'template_id' => $template->id ?? null,
                'delivery_status' => $internal ? null : 'enviado',
                'sent_at' => $now,
                'created_by' => $actor->getKey(),
            ]);

            foreach ($files as $file) {
                DB::table('collab_message_attachments')->insert([
                    'id' => (string) Str::uuid7(),
                    'message_id' => $messageId,
                    'file_name' => $file['file_name'],
                    'mime' => $file['mime'],
                    'size_bytes' => $file['size'],
                    'storage_path' => $file['path'],
                    'sha256' => $file['sha256'],
                    'scan_status' => 'limpio',
                    'created_by' => $actor->getKey(),
                ]);
            }

            $values = ['last_message_at' => $now, 'updated_by' => $actor->getKey(), 'updated_at' => $now];
            if (! $internal) {
                $resolve = (bool) ($data['resolve'] ?? false);
                $values += [
                    'status' => $resolve ? 'resuelta' : 'pendiente',
                    'unread_count' => 0,
                    'first_response_at' => $conversation->first_response_at ?? $now,
                    'assignee_id' => $conversation->assignee_id ?? $actor->getKey(),
                    'resolved_at' => $resolve ? $now : null,
                    'resolved_by' => $resolve ? $actor->getKey() : null,
                    'lock_version' => DB::raw('lock_version + 1'),
                ];
            }

            DB::table('collab_conversations')->where('id', $conversation->id)->update($values);

            if (! $internal && $conversation->assignee_id === null) {
                DB::table('collab_messages')->insert([
                    'id' => (string) Str::uuid7(),
                    'conversation_id' => $conversation->id,
                    'channel' => $conversation->channel,
                    'direction' => 'system',
                    'author_user_id' => $actor->getKey(),
                    'body' => "Asignada automáticamente a {$actor->name} al responder.",
                    'sent_at' => $now->copy()->subMillisecond(),
                    'created_by' => $actor->getKey(),
                ]);
                $this->audit->log('Conversación', $conversation->code, 'asignar', null, (string) $actor->getKey());
            }

            $reservationId = $conversation->reservation_id ?? null;

            if (! $internal && $conversation->channel === 'portal' && $reservationId && trim((string) ($data['body'] ?? '')) !== ''
                && DB::table('channel_trip_messages')->where('reservation_id', $reservationId)->where('sender_type', 'passenger')->exists()) {
                DB::table('channel_trip_messages')->insert(['reservation_id' => $reservationId, 'sender_type' => 'agency', 'sender_user_id' => $actor->getKey(), 'body' => (string) $data['body'], 'created_by' => $actor->getKey()]);
                app(PassengerNotices::class)->send((string) $reservationId, 'chat.respuesta', 'Te respondimos tu mensaje', mb_substr((string) $data['body'], 0, 180), 'collab_conversation', (string) $conversation->id);
            }

            $action = $internal ? 'nota_interna' : (($data['resolve'] ?? false) ? 'responder_y_resolver' : 'responder');
            $this->audit->log('Conversación', $conversation->code, $action, $conversation->status, $values['status'] ?? $conversation->status);

            if ($files !== []) {
                $this->audit->log('Conversación', $conversation->code, 'adjuntar', null, implode(', ', array_column($files, 'file_name')));
            }
        });

        $this->attachments->release($files);
    }

    public function assign(string $code, ?string $assigneeId, User $actor): void
    {
        $conversation = $this->directory->find($code, $actor);
        $target = $assigneeId ?? $actor->getKey();
        $canReassign = ConversationDirectory::canReassign($actor);

        if ($target !== $actor->getKey() && ! $canReassign) {
            throw ApiException::forbidden('INB-BR-04', 'Solo puedes tomar la conversación para ti.');
        }

        if ($target !== $actor->getKey() && ! $this->advisors->has($target, ['tenant_admin', 'manager', 'sales', 'operations'])) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige a una persona del equipo de atención.');
        }

        DB::table('collab_conversations')->where('id', $conversation->id)->update(['assignee_id' => $target, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Conversación', $conversation->code, 'asignar', $conversation->assignee_id, $target);

        if ($target !== $actor->getKey()) {
            app(InboxNotices::class)->assigned((string) $conversation->id, (string) $target, (string) $actor->getKey());
        }
    }

    public function status(string $code, string $status, User $actor): void
    {
        $conversation = $this->directory->find($code, $actor);

        if ($conversation->status === $status) {
            throw ApiException::conflict('INB-BR-STATE', $status === 'resuelta' ? 'La conversación ya está resuelta.' : 'La conversación ya está abierta.');
        }

        DB::transaction(function () use ($conversation, $status, $actor): void {
            $resolved = $status === 'resuelta';
            DB::table('collab_conversations')->where('id', $conversation->id)->update([
                'status' => $status,
                'resolved_at' => $resolved ? now() : null,
                'resolved_by' => $resolved ? $actor->getKey() : null,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            DB::table('collab_messages')->insert([
                'id' => (string) Str::uuid7(),
                'conversation_id' => $conversation->id,
                'channel' => $conversation->channel,
                'direction' => 'system',
                'author_user_id' => $actor->getKey(),
                'body' => $resolved ? "Conversación resuelta por {$actor->name}." : "Conversación reabierta por {$actor->name}.",
                'sent_at' => now(),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Conversación', $conversation->code, $resolved ? 'resolver' : 'reabrir', $conversation->status, $status);

            if ($resolved) {
                app(InboxNotices::class)->resolved((string) $conversation->id);
            }
        });
    }

    public function link(string $code, string $kind, string $recordCode, ?int $version, User $actor): void
    {
        $link = ConversationDirectory::LINKS[$kind];
        $this->assertLinkPermission($link, $actor);
        $conversation = $this->directory->find($code, $actor);
        $record = $this->directory->linkable($kind, $actor)->where('x.code', $recordCode)->first($kind === 'reservation' ? ['x.id', 'x.code', 'x.client_id'] : ['x.id', 'x.code'])
            ?? throw Portfolio::missing($actor, $link['table'], $recordCode, "{$link['entity']} no existe.", $link['entity']);

        if ($conversation->{$link['column']} === $record->id) {
            throw ApiException::conflict('INB-BR-06', "La conversación ya está vinculada a {$record->code}.");
        }

        $values = [$link['column'] => $record->id];
        if ($kind === 'reservation' && $conversation->client_id === null && ($record->client_id ?? null) !== null) {
            $values['client_id'] = $record->client_id;
        }

        $previous = $this->linkedCode($link, $conversation->{$link['column']});
        $this->saveLink($conversation, $values, $version, $actor, "Vinculada a {$link['label']} {$record->code} por {$actor->name}.", "vincular_{$link['label']}", $previous, $record->code);
    }

    public function unlink(string $code, string $kind, ?int $version, User $actor): void
    {
        $link = ConversationDirectory::LINKS[$kind];
        $this->assertLinkPermission($link, $actor);
        $conversation = $this->directory->find($code, $actor);
        $previous = $this->linkedCode($link, $conversation->{$link['column']});

        if ($previous === null) {
            throw ApiException::conflict('INB-BR-06', "La conversación no tiene {$link['label']} vinculado.");
        }

        $this->saveLink($conversation, [$link['column'] => null], $version, $actor, "Se quitó el vínculo con {$link['label']} {$previous} ({$actor->name}).", "desvincular_{$link['label']}", $previous, null);
    }

    public function classify(string $code, array $data, User $actor): void
    {
        $conversation = $this->directory->find($code, $actor);
        $tags = collect($data['tags'] ?? [])->map(fn (string $tag): string => trim(str_replace(['{', '}', '"', ','], '', $tag)))->filter()->unique()->take(8)->values();

        DB::table('collab_conversations')->where('id', $conversation->id)->update([
            'priority' => $data['priority'],
            'tags' => '{'.$tags->map(fn (string $tag): string => '"'.$tag.'"')->implode(',').'}',
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Conversación', $conversation->code, 'clasificar', $conversation->priority, "{$data['priority']} · ".$tags->implode(', '));
    }

    private function assertLinkPermission(array $link, User $actor): void
    {
        if (! $actor->can($link['permission'])) {
            throw ApiException::forbidden('INB-BR-06', "Tu rol no vincula conversaciones a un {$link['label']}.", [$link['permission']]);
        }
    }

    private function linkedCode(array $link, ?string $id): ?string
    {
        return $id === null ? null : DB::table($link['table'])->where('id', $id)->value('code');
    }

    private function saveLink(object $conversation, array $values, ?int $version, User $actor, string $note, string $action, ?string $before, ?string $after): void
    {
        DB::transaction(function () use ($conversation, $values, $version, $actor, $note, $action, $before, $after): void {
            $updated = DB::table('collab_conversations')->where('id', $conversation->id)->where('lock_version', $version ?? $conversation->lock_version)
                ->update([...$values, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($updated === 0) {
                throw ApiException::conflict('STALE_VERSION', 'Otra persona acaba de cambiar esta conversación. Actualiza la bandeja.');
            }

            DB::table('collab_messages')->insert([
                'id' => (string) Str::uuid7(),
                'conversation_id' => $conversation->id,
                'channel' => $conversation->channel,
                'direction' => 'system',
                'author_user_id' => $actor->getKey(),
                'body' => $note,
                'sent_at' => now(),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Conversación', $conversation->code, $action, $before, $after);
        });
    }
}
