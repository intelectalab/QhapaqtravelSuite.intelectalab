<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Landing\Support\CommentCodes;
use App\Domain\Landing\Support\LandingBlog;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ModerateBlogComments
{
    public const STATUSES = ['pendiente' => 'Por revisar', 'aprobado' => 'Publicado', 'rechazado' => 'Rechazado', 'spam' => 'Spam'];

    public const TRANSITIONS = [
        'pendiente' => ['aprobado', 'rechazado', 'spam'],
        'aprobado' => ['rechazado'],
        'rechazado' => ['aprobado'],
        'spam' => ['pendiente', 'aprobado'],
    ];

    public const ACTIONS = ['aprobado' => 'Aprobar', 'rechazado' => 'Rechazar', 'spam' => 'Marcar spam', 'pendiente' => 'No es spam'];

    public const STAFF_NAME = 'Equipo KipuControl';

    private const ENTITY = 'Comentario blog';

    public function __construct(private readonly PlatformSession $session) {}

    public function list(?string $status, ?string $search): array
    {
        $rows = $this->db()->table('platform_blog_comments as c')->join('platform_blog_posts as p', 'p.id', '=', 'c.post_id')
            ->leftJoin('platform_blog_comments as parent', 'parent.id', '=', 'c.parent_id')
            ->leftJoin('platform_users as m', 'm.id', '=', 'c.moderated_by')
            ->where('p.site', LandingBlog::SITE)
            ->orderByRaw("case when c.status = 'pendiente' then 0 else 1 end")->orderByDesc('c.created_at')
            ->get(['c.id', 'c.code', 'c.parent_id', 'c.name', 'c.email', 'c.body', 'c.status', 'c.useful', 'c.staff', 'c.created_at', 'c.moderated_at', 'c.previous_status', 'p.slug as post_slug', 'p.title as post_title', 'parent.name as parent_name', 'parent.code as parent_code', 'm.name as moderator']);
        $needle = Str::lower(Str::ascii(trim((string) $search)));
        $filtered = $rows
            ->when($status !== null && isset(self::STATUSES[$status]), fn ($all) => $all->where('status', $status))
            ->when($needle !== '', fn ($all) => $all->filter(fn (object $row): bool => str_contains(Str::lower(Str::ascii($row->name.' '.$row->body.' '.$row->post_title.' '.$row->code)), $needle)));

        return [
            'items' => $filtered->take(300)->map(fn (object $row): array => $this->present($row))->values()->all(),
            'counts' => ['total' => $rows->count(), ...collect(array_keys(self::STATUSES))->mapWithKeys(fn (string $key): array => [$key => $rows->where('status', $key)->count()])->all(), 'replies' => $rows->where('staff', true)->count()],
            'statuses' => collect(self::STATUSES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
        ];
    }

    public function moderate(string $id, string $status, PlatformUser $actor): array
    {
        return $this->db()->transaction(function () use ($id, $status, $actor): array {
            $row = $this->row($id);

            if (! in_array($status, self::TRANSITIONS[$row->status] ?? [], true)) {
                throw ApiException::unprocessable('LND-11', 'El comentario está '.mb_strtolower(self::STATUSES[$row->status]).' y no puede pasar a '.mb_strtolower(self::STATUSES[$status] ?? $status).'.');
            }

            $this->apply($row, $status, $actor);

            return $this->find((string) $row->id);
        });
    }

    public function reply(string $id, string $body, PlatformUser $actor): array
    {
        return $this->db()->transaction(function () use ($id, $body, $actor): array {
            $parent = $this->row($id);

            if ($parent->parent_id !== null) {
                throw ApiException::unprocessable('LND-12', 'Responde al comentario principal: las respuestas tienen un solo nivel.');
            }

            if (! in_array($parent->status, ['pendiente', 'aprobado'], true)) {
                throw ApiException::unprocessable('LND-12', 'Solo se responden comentarios publicados o por revisar.');
            }

            if ($parent->status === 'pendiente') {
                $this->apply($parent, 'aprobado', $actor);
            }

            $replyId = (string) Str::uuid7();
            $code = CommentCodes::next();
            $this->db()->table('platform_blog_comments')->insert([
                'id' => $replyId,
                'code' => $code,
                'post_id' => $parent->post_id,
                'parent_id' => $parent->id,
                'name' => self::STAFF_NAME,
                'body' => trim($body),
                'status' => 'aprobado',
                'staff' => true,
                'staff_user_id' => $actor->getKey(),
                'moderated_by' => $actor->getKey(),
                'moderated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->session->log(self::ENTITY, $code, 'responder', (string) $parent->code, mb_substr(trim($body), 0, 160), $actor);

            return $this->find($replyId);
        });
    }

    public function delete(string $id, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($id, $actor): void {
            $row = $this->row($id);

            if (! $row->staff && $row->status === 'aprobado') {
                throw ApiException::conflict('LND-11', 'Rechaza el comentario antes de eliminarlo; así queda constancia de la moderación.');
            }

            $this->db()->table('platform_blog_comments')->where('id', $row->id)->delete();
            $this->session->log(self::ENTITY, (string) $row->code, 'eliminar', self::STATUSES[$row->status] ?? $row->status, null, $actor);
        });
    }

    public function find(string $id): array
    {
        $row = $this->db()->table('platform_blog_comments as c')->join('platform_blog_posts as p', 'p.id', '=', 'c.post_id')
            ->leftJoin('platform_blog_comments as parent', 'parent.id', '=', 'c.parent_id')
            ->leftJoin('platform_users as m', 'm.id', '=', 'c.moderated_by')
            ->where('c.id', $id)
            ->first(['c.id', 'c.code', 'c.parent_id', 'c.name', 'c.email', 'c.body', 'c.status', 'c.useful', 'c.staff', 'c.created_at', 'c.moderated_at', 'c.previous_status', 'p.slug as post_slug', 'p.title as post_title', 'parent.name as parent_name', 'parent.code as parent_code', 'm.name as moderator']);

        return $this->present($row ?? throw ApiException::notFound('El comentario no existe.'));
    }

    private function apply(object $row, string $status, PlatformUser $actor): void
    {
        $this->db()->table('platform_blog_comments')->where('id', $row->id)->update(['status' => $status, 'previous_status' => $row->status, 'moderated_by' => $actor->getKey(), 'moderated_at' => now(), 'updated_at' => now()]);
        $this->session->log(self::ENTITY, (string) $row->code, 'moderar', self::STATUSES[$row->status] ?? $row->status, self::STATUSES[$status] ?? $status, $actor);
    }

    private function present(object $row): array
    {
        return [
            'id' => (string) $row->id,
            'code' => (string) $row->code,
            'name' => (string) $row->name,
            'email' => $row->email === null ? null : $this->decrypt((string) $row->email),
            'body' => (string) $row->body,
            'status' => (string) $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'actions' => array_map(fn (string $next): array => ['value' => $next, 'label' => self::ACTIONS[$next]], self::TRANSITIONS[$row->status] ?? []),
            'can_reply' => $row->parent_id === null && in_array($row->status, ['pendiente', 'aprobado'], true),
            'staff' => (bool) $row->staff,
            'useful' => (int) $row->useful,
            'reply_to' => $row->parent_id === null ? null : ['code' => $row->parent_code, 'name' => $row->parent_name],
            'post' => ['slug' => (string) $row->post_slug, 'title' => (string) $row->post_title, 'href' => '/software/blog/'.$row->post_slug],
            'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
            'moderated_at' => $row->moderated_at ? Carbon::parse($row->moderated_at)->toIso8601String() : null,
            'moderator' => $row->moderator,
        ];
    }

    private function row(string $id): object
    {
        $row = Str::isUuid($id) ? $this->db()->table('platform_blog_comments')->where('id', $id)->lock('for no key update')->first() : null;

        return $row ?? throw ApiException::notFound('El comentario no existe.');
    }

    private function decrypt(string $value): string
    {
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return '—';
        }
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
