<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\ConversationWorkflow;
use App\Domain\Inbox\Support\ConversationDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ConversationCrm
{
    private const LEAD_CHANNEL = ['whatsapp' => 'whatsapp', 'email' => 'email', 'webchat' => 'web', 'form' => 'web', 'portal' => 'web'];

    private const LEAD_SOURCE = ['whatsapp' => 'whatsapp', 'email' => 'email', 'webchat' => 'formulario_web', 'form' => 'formulario_web', 'portal' => 'formulario_web'];

    public function __construct(
        private readonly ConversationDirectory $conversations,
        private readonly ConversationWorkflow $workflow,
        private readonly LeadWorkflow $leads,
        private readonly ActivityWorkflow $activities,
    ) {}

    private function defaults(object $conversation): array
    {
        return [
            'name' => $conversation->contact_name,
            'email' => $conversation->contact_email,
            'phone' => $conversation->contact_phone,
            'channel' => self::LEAD_CHANNEL[$conversation->channel] ?? 'web',
            'source' => self::LEAD_SOURCE[$conversation->channel] ?? 'formulario_web',
        ];
    }

    public function createLead(string $code, array $data, ?int $version, User $actor): array
    {
        $conversation = $this->conversations->find($code, $actor);

        if ($conversation->lead_id !== null) {
            throw ApiException::conflict('INB-BR-06', 'La conversación ya tiene un lead vinculado. Quítalo antes de crear otro.');
        }

        return DB::transaction(function () use ($conversation, $data, $version, $actor): array {
            $defaults = $this->defaults($conversation);
            $notes = trim((string) ($data['notes'] ?? ''));
            $lead = $this->leads->create([
                ...$data,
                'channel' => $data['channel'] ?? $defaults['channel'],
                'source' => $data['source'] ?? $defaults['source'],
                'notes' => trim("{$notes}\nDesde la conversación {$conversation->code}."),
            ], $actor);

            if (($data['duplicate_resolution'] ?? null) !== 'mark_duplicate') {
                $this->workflow->link($conversation->code, 'lead', $lead['code'], $version, $actor);
            }

            return $lead;
        });
    }

    public function createActivity(string $code, array $data, User $actor): array
    {
        $conversation = $this->conversations->find($code, $actor);
        $related = $this->relation($conversation, $data);

        if (! in_array($related['related_type'], ['lead', 'client'], true) && ! ($related['related_type'] === 'quote' && $conversation->client_id !== null)) {
            throw ApiException::unprocessable('INB-BR-07', 'Vincula la conversación a un lead o a un cliente antes de agendar la actividad.');
        }

        return DB::transaction(function () use ($conversation, $data, $related, $actor): array {
            $activity = $this->activities->create([...$data, ...$related], $actor);
            DB::table('collab_messages')->insert([
                'id' => (string) Str::uuid7(),
                'conversation_id' => $conversation->id,
                'channel' => $conversation->channel,
                'direction' => 'system',
                'author_user_id' => $actor->getKey(),
                'body' => "Actividad {$activity} agendada por {$actor->name}: {$data['subject']}.",
                'sent_at' => now(),
                'created_by' => $actor->getKey(),
            ]);

            return ['code' => $activity];
        });
    }

    private function relation(object $conversation, array $data): array
    {
        if (! empty($data['related_type'])) {
            return ['related_type' => $data['related_type'], 'related_code' => $data['related_code'] ?? null];
        }

        foreach (['lead_id' => ['lead', 'crm_leads'], 'client_id' => ['client', 'crm_clients'], 'quote_id' => ['quote', 'quote_quotes']] as $column => [$type, $table]) {
            if ($conversation->{$column} !== null) {
                return ['related_type' => $type, 'related_code' => DB::table($table)->where('id', $conversation->{$column})->value('code')];
            }
        }

        return ['related_type' => null, 'related_code' => null];
    }
}
