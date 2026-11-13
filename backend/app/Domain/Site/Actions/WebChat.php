<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Inbox\Support\InboxNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class WebChat
{
    private const AUTO_REPLY = 'Hola, gracias por escribirnos. Un asesor te responderá en breve por este chat; si ya cerraste la ventana, te contestaremos por correo o WhatsApp.';

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
    ) {}

    public function open(array $data): array
    {
        $now = Carbon::now($this->context->timezone());
        $email = isset($data['email']) ? Str::lower(trim((string) $data['email'])) : null;
        $client = $email ? DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id') : null;
        $code = $this->codes->next('collab_conversations', 'CNV-');
        $id = (string) Str::uuid7();

        DB::table('collab_conversations')->insert([
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'channel' => 'webchat',
            'contact_name' => trim((string) $data['name']),
            'contact_email' => $email,
            'contact_phone' => $data['whatsapp'] ?? null,
            'subject' => Str::limit('Chat web: '.trim((string) $data['message']), 195),
            'status' => 'abierta',
            'priority' => 'media',
            'tags' => '{Web,Chat}',
            'client_id' => $client,
            'first_response_due_at' => $now->copy()->addMinutes(30),
            'last_inbound_at' => $now,
            'last_message_at' => $now,
            'unread_count' => 1,
        ]);
        $this->message($id, 'in', trim((string) $data['message']), $now);
        $this->message($id, 'system', self::AUTO_REPLY, $now->copy()->addSecond());
        $this->audit->log('Conversación', $code, 'crear', after: 'webchat');

        app(InboxNotices::class)->created($id);

        return ['session' => $code, 'token' => self::token($id), 'messages' => $this->visible($id)];
    }

    public function send(string $session, ?string $token, string $body): array
    {
        $conversation = $this->authorize($session, $token);
        $now = Carbon::now($this->context->timezone());
        $last = DB::table('collab_messages')->where('conversation_id', $conversation->id)->max('sent_at');
        $now = $last !== null && Carbon::parse($last)->greaterThanOrEqualTo($now) ? Carbon::parse($last)->addSecond() : $now;
        $this->message((string) $conversation->id, 'in', trim($body), $now);
        DB::table('collab_conversations')->where('id', $conversation->id)->update([
            'status' => 'abierta',
            'last_inbound_at' => $now,
            'last_message_at' => $now,
            'unread_count' => DB::raw('unread_count + 1'),
            'updated_at' => $now,
        ]);
        app(InboxNotices::class)->inbound((string) $conversation->id);

        return ['session' => $conversation->code, 'messages' => $this->visible((string) $conversation->id)];
    }

    public function show(string $session, ?string $token): array
    {
        $conversation = $this->authorize($session, $token);

        return ['session' => $conversation->code, 'messages' => $this->visible((string) $conversation->id)];
    }

    public static function token(string $conversationId): string
    {
        return hash_hmac('sha256', 'webchat|'.$conversationId, (string) config('app.key'));
    }

    private function authorize(string $session, ?string $token): stdClass
    {
        $conversation = DB::table('collab_conversations')->where('code', $session)->where('channel', 'webchat')->first(['id', 'code']);

        if ($conversation === null || $token === null || ! hash_equals(self::token((string) $conversation->id), $token)) {
            throw ApiException::notFound('No encontramos esa conversación. Abre un chat nuevo.');
        }

        return $conversation;
    }

    private function message(string $conversationId, string $direction, string $body, Carbon $at): void
    {
        DB::table('collab_messages')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'conversation_id' => $conversationId,
            'channel' => 'webchat',
            'direction' => $direction,
            'body' => $body,
            'sent_at' => $at,
        ]);
    }

    private function visible(string $conversationId): array
    {
        $items = [];

        foreach (DB::table('collab_messages as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.author_user_id')->where('m.conversation_id', $conversationId)->whereIn('m.direction', ['in', 'out', 'system'])->orderBy('m.sent_at')->get(['m.direction', 'm.body', 'm.sent_at', 'u.name']) as $row) {
            $items[] = ['from' => ['in' => 'contacto', 'out' => 'asesor', 'system' => 'sistema'][$row->direction], 'author' => $row->direction === 'out' ? $row->name : null, 'body' => $row->body, 'at' => Carbon::parse($row->sent_at)->toIso8601String()];
        }

        return $items;
    }
}
