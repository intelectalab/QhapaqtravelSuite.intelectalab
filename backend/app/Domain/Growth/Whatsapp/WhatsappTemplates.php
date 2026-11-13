<?php

declare(strict_types=1);

namespace App\Domain\Growth\Whatsapp;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ConversationDirectory;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Marketing\Support\SandboxTemplateReviewer;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class WhatsappTemplates
{
    public const CATEGORIES = ['utility' => 'Transaccional', 'marketing' => 'Comercial', 'authentication' => 'Verificación'];

    public const PURPOSES = ['cotizacion' => 'Cotización', 'link_pago' => 'Link de pago', 'voucher' => 'Voucher', 'recordatorio' => 'Recordatorio', 'recuperacion' => 'Recuperación', 'resena' => 'Reseña', 'otro' => 'Otro'];

    public const STATUSES = ['borrador' => 'Borrador', 'enviada' => 'En revisión de Meta', 'aprobada' => 'Aprobada', 'rechazada' => 'Rechazada', 'pausada' => 'Pausada'];

    public const LANGS = ['es' => 'Español', 'en' => 'Inglés', 'pt' => 'Portugués'];

    public const PERMISSION = 'inbox.whatsapp.manage';

    public function __construct(
        private readonly GrowthRules $rules,
        private readonly SandboxTemplateReviewer $reviewer,
        private readonly AuditLogger $audit,
        private readonly ConversationDirectory $conversations,
        private readonly MessagingChannel $messaging,
    ) {}

    public function overview(): array
    {
        $account = DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->orderBy('created_at')->first(['id', 'name', 'phone_number_id', 'status']);
        $templates = DB::table('collab_whatsapp_templates as t')->leftJoin('iam_users as u', 'u.id', '=', 't.updated_by')
            ->orderBy('t.name')->orderBy('t.lang')
            ->get(['t.*', 'u.name as updated_by_name'])
            ->map(fn (object $row): array => $this->present($row))
            ->values();

        return [
            'enabled' => $this->rules->enabled('R-WHATSAPP-OFFICIAL'),
            'account' => $account === null ? null : [
                'name' => $account->name,
                'phone' => $account->phone_number_id,
                'status' => $account->status,
                'mode' => $account->status === 'sandbox' ? 'Modo de prueba: los envíos se simulan.' : 'Conectado con Meta.',
            ],
            'kpis' => [
                'total' => $templates->count(),
                'approved' => $templates->where('status', 'aprobada')->count(),
                'in_review' => $templates->where('status', 'enviada')->count(),
                'rejected' => $templates->where('status', 'rechazada')->count(),
            ],
            'templates' => $templates->all(),
            'catalogs' => ['categories' => self::CATEGORIES, 'purposes' => self::PURPOSES, 'statuses' => self::STATUSES, 'langs' => self::LANGS],
        ];
    }

    public function create(array $data, User $actor): array
    {
        $this->rules->ensure('R-WHATSAPP-OFFICIAL', self::PERMISSION);
        $account = $this->account($actor);

        if (DB::table('collab_whatsapp_templates')->where('channel_account_id', $account)->where('name', $data['name'])->where('lang', $data['lang'])->exists()) {
            throw ApiException::conflict('WA-DUPLICATE', 'Ya hay una plantilla con ese nombre e idioma en el número de WhatsApp.');
        }

        $review = $this->reviewer->submit($data['name'], $data['category'], $data['body'], null);
        $id = (string) Str::uuid7();

        DB::transaction(function () use ($id, $data, $account, $review, $actor): void {
            DB::table('collab_whatsapp_templates')->insert([
                'id' => $id,
                'channel_account_id' => $account,
                'name' => $data['name'],
                'lang' => $data['lang'],
                'category' => $data['category'],
                'purpose' => $data['purpose'],
                'body' => $data['body'],
                'variables' => $this->pgArray($this->variables($data['body'])),
                'meta_template_id' => $review->externalId,
                'status' => 'enviada',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Plantilla WhatsApp', $data['name'], 'crear', null, "{$data['lang']} · enviada a revisión de Meta");
        });

        return $this->find($id);
    }

    public function update(string $id, array $data, User $actor): array
    {
        $this->rules->ensure('R-WHATSAPP-OFFICIAL', self::PERMISSION);
        $template = $this->row($id);

        [$values, $action, $after] = match (true) {
            isset($data['meta_status']) => $this->metaResponse($template, $data),
            isset($data['action']) => $this->toggle($template, (string) $data['action']),
            default => $this->content($template, $data),
        };

        DB::transaction(function () use ($template, $values, $action, $after, $actor): void {
            DB::table('collab_whatsapp_templates')->where('id', $template->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Plantilla WhatsApp', (string) $template->name, $action, (string) $template->status, $after);
        });

        return $this->find($id);
    }

    public function send(string $conversationCode, array $data, User $actor): array
    {
        $this->rules->ensure('R-WHATSAPP-OFFICIAL', 'inbox.manage');
        $conversation = $this->conversations->find($conversationCode, $actor);

        if ($conversation->channel !== 'whatsapp') {
            throw ApiException::unprocessable('SC-05', 'Las plantillas de WhatsApp solo se envían en conversaciones de WhatsApp.');
        }

        $template = DB::table('collab_whatsapp_templates')->where(Str::isUuid($data['template']) ? 'id' : 'name', $data['template'])->orderBy('lang')->first()
            ?? throw ApiException::notFound('La plantilla no existe.');

        if ($template->status !== 'aprobada') {
            throw ApiException::unprocessable('SC-05', 'Solo se envían plantillas aprobadas por Meta.');
        }

        if (! $this->hasOptIn($conversation)) {
            throw ApiException::unprocessable('SC-05', 'El contacto no autorizó recibir mensajes por WhatsApp. Registra su consentimiento antes del primer mensaje.');
        }

        if (trim((string) $conversation->contact_phone) === '') {
            throw ApiException::unprocessable('SC-05', 'La conversación no tiene un celular de destino.');
        }

        $variables = array_map('strval', (array) ($data['variables'] ?? []));
        $missing = array_values(array_diff($this->variables((string) $template->body), array_keys(array_filter($variables, fn (string $value): bool => trim($value) !== ''))));

        if ($missing !== []) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Completa la variable {{'.$missing[0].'}} de la plantilla.');
        }

        $body = (string) preg_replace_callback('/\{\{\s*([a-z0-9_]+)\s*\}\}/', fn (array $match): string => $variables[$match[1]] ?? $match[0], (string) $template->body);
        $result = $this->messaging->send(new OutboundMessage('whatsapp', (string) $conversation->contact_phone, null, $body, (string) $template->name, $variables, (string) $template->lang));
        $messageId = (string) Str::uuid7();

        DB::transaction(function () use ($conversation, $template, $body, $result, $messageId, $actor): void {
            DB::table('collab_messages')->insert([
                'id' => $messageId,
                'conversation_id' => $conversation->id,
                'channel' => 'whatsapp',
                'direction' => 'out',
                'author_user_id' => $actor->getKey(),
                'body' => $body,
                'external_message_id' => $result->externalId,
                'delivery_status' => $result->ok ? 'enviado' : 'fallido',
                'failure_reason' => $result->ok ? null : $result->message,
                'sent_at' => now(),
                'created_by' => $actor->getKey(),
            ]);
            DB::table('collab_conversations')->where('id', $conversation->id)->update([
                'last_message_at' => now(),
                'status' => 'pendiente',
                'first_response_at' => $conversation->first_response_at ?? now(),
                'assignee_id' => $conversation->assignee_id ?? $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
                'lock_version' => DB::raw('lock_version + 1'),
            ]);
            $this->audit->log('Conversación', (string) $conversation->code, 'enviar_plantilla', null, "{$template->name} · ".($result->ok ? 'enviada' : 'fallida'));
        });

        return ['code' => $conversation->code, 'message' => ['id' => $messageId, 'body' => $body, 'delivery_status' => $result->ok ? 'enviado' : 'fallido', 'error' => $result->ok ? null : $result->message]];
    }

    public function variables(string $body): array
    {
        preg_match_all('/\{\{\s*([a-z0-9_]+)\s*\}\}/', $body, $found);

        return array_values(array_unique($found[1]));
    }

    public function providerReview(string $accountId, ?string $metaTemplateId, ?string $name, ?string $lang, string $status, ?string $reason): ?array
    {
        $template = DB::table('collab_whatsapp_templates')->where('channel_account_id', $accountId)
            ->where(fn ($query) => $query->when(filled($metaTemplateId), fn ($match) => $match->where('meta_template_id', $metaTemplateId))
                ->when(filled($name), fn ($match) => $match->orWhere(fn ($named) => $named->where('name', $name)->where('lang', Str::lower((string) ($lang ?: 'es'))))))
            ->when(blank($metaTemplateId) && blank($name), fn ($query) => $query->whereRaw('false'))
            ->first();

        if ($template === null || $template->status === 'borrador') {
            return null;
        }

        if ($template->status === $status) {
            return ['result' => 'duplicado', 'template' => $template->name, 'status' => $status];
        }

        $rejected = $status === 'rechazada';

        DB::table('collab_whatsapp_templates')->where('id', $template->id)->update([
            'status' => $status,
            'rejected_reason' => $rejected ? (trim((string) $reason) ?: 'Meta no indicó el motivo.') : null,
            'updated_at' => now(),
        ]);
        $this->audit->log('Plantilla WhatsApp', (string) $template->name, 'respuesta_meta', (string) $template->status, $status);

        return ['result' => 'actualizado', 'template' => $template->name, 'status' => $status];
    }

    private function metaResponse(object $template, array $data): array
    {
        if ($template->status !== 'enviada') {
            throw ApiException::conflict('WA-REVIEW', 'Solo se registra la respuesta de Meta de una plantilla en revisión.');
        }

        $result = $this->reviewer->respond((string) $template->meta_template_id, (string) $data['meta_status']);

        if (! $result->ok) {
            throw ApiException::unprocessable('WA-REVIEW', (string) $result->message);
        }

        $rejected = $result->status === 'rechazada';

        return [['status' => $result->status, 'rejected_reason' => $rejected ? trim((string) ($data['rejected_reason'] ?? '')) ?: 'Meta no indicó el motivo.' : null], 'respuesta_meta', $result->status];
    }

    private function toggle(object $template, string $action): array
    {
        $next = match ([$action, $template->status]) {
            ['pausar', 'aprobada'] => 'pausada',
            ['reanudar', 'pausada'] => 'aprobada',
            default => throw ApiException::conflict('WA-STATUS', $action === 'pausar' ? 'Solo se pausa una plantilla aprobada.' : 'Solo se reanuda una plantilla pausada.'),
        };

        return [['status' => $next], $action, $next];
    }

    private function content(object $template, array $data): array
    {
        $body = $data['body'] ?? $template->body;
        $category = $data['category'] ?? $template->category;
        $purpose = $data['purpose'] ?? $template->purpose;
        $changed = $body !== $template->body || $category !== $template->category;
        $review = $changed ? $this->reviewer->submit((string) $template->name, $category, $body, $template->meta_template_id) : null;
        $status = $changed ? 'enviada' : $template->status;

        return [[
            'body' => $body,
            'category' => $category,
            'purpose' => $purpose,
            'variables' => $this->pgArray($this->variables($body)),
            'meta_template_id' => $review->externalId ?? $template->meta_template_id,
            'status' => $status,
            'rejected_reason' => $changed ? null : $template->rejected_reason,
        ], 'editar', $changed ? 'enviada · vuelve a revisión de Meta' : $status];
    }

    private function hasOptIn(object $conversation): bool
    {
        $subjects = array_filter(['client' => $conversation->client_id, 'lead' => $conversation->lead_id]);

        foreach ($subjects as $type => $id) {
            if (DB::table('mkt_consents')->where('subject_type', $type)->where('subject_id', $id)->where('channel', 'whatsapp')->where('status', 'otorgado')->exists()) {
                return true;
            }
        }

        return false;
    }

    private function account(User $actor): string
    {
        $existing = DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->orderBy('created_at')->value('id');

        if ($existing !== null) {
            return (string) $existing;
        }

        $id = (string) Str::uuid7();
        DB::table('collab_channel_accounts')->insert(['id' => $id, 'channel' => 'whatsapp', 'name' => 'WhatsApp Business', 'status' => 'sandbox', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
        $this->audit->log('Cuenta de canal', 'whatsapp', 'crear', null, 'WhatsApp Business en modo de prueba');

        return $id;
    }

    private function find(string $id): array
    {
        $row = DB::table('collab_whatsapp_templates as t')->leftJoin('iam_users as u', 'u.id', '=', 't.updated_by')->where('t.id', $id)->first(['t.*', 'u.name as updated_by_name']);

        return $this->present($row ?? throw ApiException::notFound('La plantilla no existe.'));
    }

    private function row(string $id): object
    {
        return (Str::isUuid($id) ? DB::table('collab_whatsapp_templates')->where('id', $id)->first() : null) ?? throw ApiException::notFound('La plantilla no existe.');
    }

    private function pgArray(array $values): string
    {
        return '{'.implode(',', array_map(fn (string $value): string => '"'.str_replace('"', '', $value).'"', $values)).'}';
    }

    private function present(object $row): array
    {
        return [
            'id' => (string) $row->id,
            'name' => $row->name,
            'lang' => $row->lang,
            'category' => $row->category,
            'category_label' => self::CATEGORIES[$row->category] ?? $row->category,
            'purpose' => $row->purpose,
            'purpose_label' => self::PURPOSES[$row->purpose] ?? $row->purpose,
            'body' => $row->body,
            'variables' => $this->variables((string) $row->body),
            'meta_template_id' => $row->meta_template_id,
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'rejected_reason' => $row->rejected_reason,
            'updated_at' => $row->updated_at,
            'updated_by' => $row->updated_by_name ?? null,
        ];
    }
}
