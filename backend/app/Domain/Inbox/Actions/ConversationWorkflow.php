<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ConversationDirectory;
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

        DB::transaction(function () use ($conversation, $data, $actor, $internal, $template): void {
            $now = now();
            DB::table('collab_messages')->insert([
                'id' => (string) Str::uuid7(),
                'conversation_id' => $conversation->id,
                'channel' => $conversation->channel,
                'direction' => $internal ? 'internal' : 'out',
                'author_user_id' => $actor->getKey(),
                'body' => $data['body'],
                'template_id' => $template->id ?? null,
                'delivery_status' => $internal ? null : 'enviado',
                'sent_at' => $now,
                'created_by' => $actor->getKey(),
            ]);

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
            $action = $internal ? 'nota_interna' : (($data['resolve'] ?? false) ? 'responder_y_resolver' : 'responder');
            $this->audit->log('Conversación', $conversation->code, $action, $conversation->status, $values['status'] ?? $conversation->status);
        });
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
        });
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
}
