<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReplyTemplates
{
    public const CHANNELS = ['whatsapp' => 'WhatsApp', 'email' => 'Correo', 'webchat' => 'Chat web', 'form' => 'Formulario', 'portal' => 'Portal'];

    private const COLUMNS = ['id', 'code', 'name', 'body', 'channels', 'is_whatsapp_approved', 'whatsapp_template_name', 'whatsapp_language', 'is_active', 'updated_at'];

    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function list(bool $withInactive): Collection
    {
        return DB::table('collab_reply_templates')->whereNull('deleted_at')->when(! $withInactive, fn ($query) => $query->where('is_active', true))
            ->orderBy('code')->get(self::COLUMNS)->map(fn (object $row): array => $this->present($row))->values();
    }

    public function create(array $data, User $actor): array
    {
        return DB::transaction(function () use ($data, $actor): array {
            $values = $this->values($data, null);
            $code = $this->codes->next('collab_reply_templates', 'PL-', 2);
            $id = (string) Str::uuid7();
            DB::table('collab_reply_templates')->insert([...$values, 'id' => $id, 'code' => $code, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Plantilla de respuesta', $code, 'crear', null, $values['name']);

            return $this->present(DB::table('collab_reply_templates')->where('id', $id)->first(self::COLUMNS));
        });
    }

    public function update(string $key, array $data, User $actor): array
    {
        return DB::transaction(function () use ($key, $data, $actor): array {
            $row = DB::table('collab_reply_templates')->whereNull('deleted_at')->where(Str::isUuid($key) ? 'id' : 'code', $key)->lock('for update')->first()
                ?? throw ApiException::notFound('La plantilla no existe.');
            $values = $this->values($data, $row);
            $changed = collect($values)->filter(fn (mixed $value, string $field): bool => $field === 'channels' ? PgArray::parse((string) $value) !== PgArray::parse((string) $row->channels) : trim((string) $value) !== trim((string) $row->{$field}))->keys()->all();

            if ($changed === []) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('collab_reply_templates')->where('id', $row->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Plantilla de respuesta', (string) $row->code, isset($values['is_active']) && in_array('is_active', $changed, true) && count($changed) === 1 ? ($values['is_active'] ? 'activar' : 'desactivar') : 'editar', null, implode(', ', $changed));

            return $this->present(DB::table('collab_reply_templates')->where('id', $row->id)->first(self::COLUMNS));
        });
    }

    private function values(array $data, ?object $current): array
    {
        $channels = array_key_exists('channels', $data) ? array_values(array_unique($data['channels'])) : ($current ? PgArray::parse($current->channels) : array_keys(self::CHANNELS));
        $approved = (bool) ($data['is_whatsapp_approved'] ?? ($current->is_whatsapp_approved ?? false));
        $templateName = array_key_exists('whatsapp_template_name', $data) ? (trim((string) $data['whatsapp_template_name']) ?: null) : ($current->whatsapp_template_name ?? null);

        if ($approved && (! in_array('whatsapp', $channels, true) || $templateName === null)) {
            throw ApiException::unprocessable('INB-BR-02', 'Una plantilla aprobada por WhatsApp debe usar el canal WhatsApp y llevar el nombre con el que Meta la aprobó.');
        }

        $values = [
            'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : (string) $current?->name,
            'body' => array_key_exists('body', $data) ? trim((string) $data['body']) : (string) $current?->body,
            'channels' => PgArray::from($channels),
            'is_whatsapp_approved' => $approved,
            'whatsapp_template_name' => $templateName,
            'whatsapp_language' => array_key_exists('whatsapp_language', $data) ? ($data['whatsapp_language'] ?: null) : ($current->whatsapp_language ?? null),
            'is_active' => (bool) ($data['is_active'] ?? ($current->is_active ?? true)),
        ];

        if ($values['name'] === '' || $values['body'] === '') {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La plantilla necesita nombre y texto.');
        }

        $twin = DB::table('collab_reply_templates')->whereNull('deleted_at')->whereRaw('lower(name) = ?', [mb_strtolower($values['name'])])
            ->when($current, fn ($query) => $query->where('id', '<>', $current->id))->value('code');

        if ($twin !== null) {
            throw ApiException::conflict('INB-TPL-DUP', "Ya existe una plantilla con ese nombre ({$twin}).");
        }

        return $values;
    }

    private function present(object $row): array
    {
        $channels = PgArray::parse($row->channels);

        return [
            'id' => $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'body' => $row->body,
            'channels' => $channels,
            'channel_labels' => array_values(array_map(fn (string $channel): string => self::CHANNELS[$channel] ?? $channel, $channels)),
            'is_whatsapp_approved' => (bool) $row->is_whatsapp_approved,
            'whatsapp_template_name' => $row->whatsapp_template_name,
            'whatsapp_language' => $row->whatsapp_language === null ? null : trim((string) $row->whatsapp_language),
            'is_active' => (bool) $row->is_active,
            'updated_at' => $row->updated_at,
        ];
    }
}
