<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Channels\Support\CmsDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageCmsContent
{
    private const MESSAGES = [
        'en_revision' => 'Enviado a revisión',
        'borrador' => 'Devuelto a borrador',
        'aprobado' => 'Aprobado',
        'publicado' => 'Publicado',
        'despublicado' => 'Despublicado',
    ];

    public function __construct(private readonly AuditLogger $audit, private readonly ChannelKit $kit) {}

    public function create(array $data, User $actor): string
    {
        $slug = $this->slug($data['slug'] ?? null, $data['title']);
        $code = $this->kit->nextCode('cms_contents', 'CMS-', 2);
        $id = (string) Str::uuid7();

        DB::table('cms_contents')->insert([
            ...$this->fields($data),
            'id' => $id,
            'code' => $code,
            'slug' => $slug,
            'status' => 'borrador',
            'author_id' => $actor->getKey(),
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $this->event($id, $actor, null, 'borrador', 'Contenido creado', null);
        $this->audit->log('Contenido CMS', $code, 'crear', null, $data['title']);

        return $code;
    }

    public function update(string $code, array $data, User $actor): void
    {
        $row = $this->kit->row('cms_contents', $code);
        $slug = $this->slug($data['slug'] ?? null, $data['title'], $row->id);

        if ($row->status === 'publicado' && blank($data['seo_title'] ?? null)) {
            throw ApiException::unprocessable('CMS-BR-04', 'Un contenido publicado necesita su título SEO.');
        }

        DB::table('cms_contents')->where('id', $row->id)->update([
            ...$this->fields($data),
            'slug' => $slug,
            'lock_version' => $row->lock_version + 1,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->event($row->id, $actor, null, null, 'Contenido editado', null);
        $this->audit->log('Contenido CMS', $code, 'editar', $row->title, $data['title']);
    }

    public function transition(string $code, string $to, ?string $reason, User $actor): void
    {
        $row = $this->kit->row('cms_contents', $code);

        if (! in_array($to, CmsDirectory::TRANSITIONS[$row->status] ?? [], true)) {
            throw ApiException::conflict('CMS-BR-06', 'Ese cambio de estado no está permitido desde el estado actual.');
        }

        if (in_array($to, ['borrador', 'despublicado'], true) && blank($reason)) {
            throw ApiException::unprocessable('CMS-BR-05', 'Indica el motivo.');
        }

        if ($to === 'publicado' && blank($row->seo_title)) {
            throw ApiException::unprocessable('CMS-BR-04', 'Completa el título SEO antes de publicar.');
        }

        DB::table('cms_contents')->where('id', $row->id)->update([
            'status' => $to,
            'published_at' => $to === 'publicado' ? now() : $row->published_at,
            'unpublished_at' => $to === 'despublicado' ? now() : $row->unpublished_at,
            'lock_version' => $row->lock_version + 1,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->event($row->id, $actor, $row->status, $to, self::MESSAGES[$to], $reason);
        $this->audit->log('Contenido CMS', $code, $to, $row->status, trim($to.($reason ? " · {$reason}" : '')));
    }

    public function archive(string $code, User $actor): void
    {
        $row = $this->kit->row('cms_contents', $code);

        if ($row->status === 'publicado') {
            throw ApiException::conflict('CMS-BR-07', 'Despublícalo antes de archivarlo.');
        }

        DB::table('cms_contents')->where('id', $row->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Contenido CMS', $code, 'archivar', $row->status, 'archivado');
    }

    private function fields(array $data): array
    {
        return [
            'title' => $data['title'],
            'type' => $data['type'],
            'channel' => $data['channel'],
            'body' => $data['body'],
            'seo_title' => $data['seo_title'] ?? null,
            'seo_description' => $data['seo_description'] ?? null,
            'placement' => $data['placement'] ?? null,
            'valid_from' => $data['valid_from'] ?? null,
            'valid_to' => $data['valid_to'] ?? null,
        ];
    }

    private function slug(?string $slug, string $title, ?string $except = null): string
    {
        $value = Str::limit(Str::slug(filled($slug) ? $slug : $title), 60, '');
        $taken = DB::table('cms_contents')->where('slug', $value)->whereNull('deleted_at')->when($except, fn ($query) => $query->where('id', '<>', $except))->exists();

        if ($taken) {
            throw ApiException::conflict('CMS-BR-03', "La URL /{$value} ya está en uso.");
        }

        return $value;
    }

    private function event(string $contentId, User $actor, ?string $from, ?string $to, string $message, ?string $reason): void
    {
        DB::table('cms_content_events')->insert([
            'content_id' => $contentId,
            'user_id' => $actor->getKey(),
            'from_status' => $from,
            'to_status' => $to,
            'message' => $reason ? "{$message} — {$reason}" : $message,
            'reason' => $reason,
            'created_by' => $actor->getKey(),
        ]);
    }
}
