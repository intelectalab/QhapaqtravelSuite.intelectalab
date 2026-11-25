<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Landing\Support\LandingBlog;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageLandingPosts
{
    public const STATUSES = ['borrador' => 'Borrador', 'publicado' => 'Publicado', 'archivado' => 'Archivado'];

    public const TRANSITIONS = ['borrador' => ['publicado'], 'publicado' => ['archivado', 'borrador'], 'archivado' => ['borrador']];

    public const MIN_WORDS = 300;

    private const ENTITY = 'Blog KipuControl';

    public function __construct(private readonly PlatformSession $session) {}

    public function list(): array
    {
        $rows = $this->db()->table('platform_blog_posts')->where('site', LandingBlog::SITE)
            ->leftJoinSub($this->db()->table('platform_blog_comments')->selectRaw("post_id, count(*) filter (where status = 'aprobado') as approved, count(*) filter (where status = 'pendiente') as pending")->groupBy('post_id'), 'c', 'c.post_id', '=', 'platform_blog_posts.id')
            ->orderByRaw('published_at desc nulls first')->orderByDesc('created_at')
            ->get(['platform_blog_posts.*', 'c.approved', 'c.pending']);

        return [
            'items' => $rows->map(fn (object $row): array => $this->present($row))->values()->all(),
            'counts' => ['total' => $rows->count(), ...collect(array_keys(self::STATUSES))->mapWithKeys(fn (string $key): array => [$key => $rows->where('status', $key)->count()])->all(), 'reads' => (int) $rows->sum('reads')],
            'categories' => collect(LandingBlog::CATEGORIES[LandingBlog::SITE])->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'rules' => ['min_words' => self::MIN_WORDS],
        ];
    }

    public function create(array $data, PlatformUser $actor): array
    {
        $id = (string) Str::uuid7();
        $slug = $this->slug($data['slug'] ?? null, (string) $data['title']);
        $this->db()->transaction(function () use ($id, $slug, $data, $actor): void {
            $this->db()->table('platform_blog_posts')->insert([
                'id' => $id,
                'slug' => $slug,
                'site' => LandingBlog::SITE,
                ...$this->fields($data),
                'status' => 'borrador',
                'author_id' => $actor->getKey(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->featureOnly($id, (bool) ($data['featured'] ?? false));
        });
        $this->session->log(self::ENTITY, $slug, 'crear', null, (string) $data['title'], $actor);

        return $this->find($id);
    }

    public function update(string $id, array $data, PlatformUser $actor): array
    {
        return $this->db()->transaction(function () use ($id, $data, $actor): array {
            $post = $this->row($id);
            $merged = [...$this->editable($post), ...array_intersect_key($data, $this->editable($post))];
            $fields = $this->fields($merged);
            $slug = array_key_exists('slug', $data) && filled($data['slug']) ? $this->slug((string) $data['slug'], (string) $merged['title'], (string) $post->id) : (string) $post->slug;

            if ($post->status === 'publicado') {
                $this->assertPublishable($fields);
            }

            $this->db()->table('platform_blog_posts')->where('id', $post->id)->update([...$fields, 'slug' => $slug, 'updated_at' => now()]);
            $this->featureOnly((string) $post->id, (bool) $merged['featured']);
            $this->session->log(self::ENTITY, $slug, 'editar', (string) $post->title, (string) $fields['title'], $actor);

            return $this->find((string) $post->id);
        });
    }

    public function transition(string $id, string $status, PlatformUser $actor): array
    {
        return $this->db()->transaction(function () use ($id, $status, $actor): array {
            $post = $this->row($id);

            if (! in_array($status, self::TRANSITIONS[$post->status] ?? [], true)) {
                throw ApiException::unprocessable('LND-17', 'El artículo está '.mb_strtolower(self::STATUSES[$post->status] ?? $post->status).' y no puede pasar a '.mb_strtolower(self::STATUSES[$status] ?? $status).'.');
            }

            if ($status === 'publicado') {
                $this->assertPublishable($this->fields($this->editable($post)));
            }

            $this->db()->table('platform_blog_posts')->where('id', $post->id)->update([
                'status' => $status,
                'published_at' => $status === 'publicado' ? ($post->published_at ?? now()) : $post->published_at,
                'featured' => $status === 'publicado' && (bool) $post->featured,
                'updated_at' => now(),
            ]);
            $this->session->log(self::ENTITY, (string) $post->slug, $status === 'publicado' ? 'publicar' : ($status === 'archivado' ? 'archivar' : 'volver_a_borrador'), self::STATUSES[$post->status], self::STATUSES[$status], $actor);

            return $this->find((string) $post->id);
        });
    }

    public function delete(string $id, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($id, $actor): void {
            $post = $this->row($id);

            if ($post->status !== 'borrador' || $post->published_at !== null) {
                throw ApiException::conflict('LND-17', 'Solo se elimina un borrador que nunca se publicó. Archiva el artículo para retirarlo del blog.');
            }

            $this->db()->table('platform_blog_posts')->where('id', $post->id)->delete();
            $this->session->log(self::ENTITY, (string) $post->slug, 'eliminar', (string) $post->title, null, $actor);
        });
    }

    public function find(string $id): array
    {
        $row = $this->db()->table('platform_blog_posts')->where('site', LandingBlog::SITE)->where('platform_blog_posts.id', $id)
            ->leftJoinSub($this->db()->table('platform_blog_comments')->selectRaw("post_id, count(*) filter (where status = 'aprobado') as approved, count(*) filter (where status = 'pendiente') as pending")->groupBy('post_id'), 'c', 'c.post_id', '=', 'platform_blog_posts.id')
            ->first(['platform_blog_posts.*', 'c.approved', 'c.pending']);

        return $this->present($row ?? throw ApiException::notFound('El artículo no existe.'));
    }

    private function assertPublishable(array $fields): void
    {
        if ($fields['word_count'] < self::MIN_WORDS) {
            throw ApiException::unprocessable('LND-17', "El artículo tiene {$fields['word_count']} palabras. Para publicarlo necesita al menos ".self::MIN_WORDS.'.');
        }

        if ($fields['category'] === null) {
            throw ApiException::unprocessable('LND-18', 'Elige la categoría antes de publicar: cada categoría tiene su página en el blog.');
        }
    }

    private function featureOnly(string $id, bool $featured): void
    {
        if ($featured) {
            $this->db()->table('platform_blog_posts')->where('site', LandingBlog::SITE)->where('id', '<>', $id)->where('featured', true)->update(['featured' => false]);
        }
    }

    private function fields(array $data): array
    {
        $body = trim((string) ($data['body'] ?? ''));
        $category = (string) ($data['category'] ?? '');
        $faq = array_values(array_filter(array_map(fn ($item): ?array => is_array($item) && filled($item['q'] ?? null) && filled($item['a'] ?? null) ? ['q' => trim((string) $item['q']), 'a' => trim((string) $item['a'])] : null, (array) ($data['faq'] ?? []))));

        return [
            'title' => trim((string) $data['title']),
            'title_accent' => blank($data['title_accent'] ?? null) ? null : trim((string) $data['title_accent']),
            'excerpt' => trim((string) $data['excerpt']),
            'body' => $body === '' ? null : $body,
            'category' => isset(LandingBlog::CATEGORIES[LandingBlog::SITE][$category]) ? $category : null,
            'focus_keyword' => trim((string) $data['focus_keyword']),
            'author_name' => blank($data['author_name'] ?? null) ? null : trim((string) $data['author_name']),
            'author_role' => blank($data['author_role'] ?? null) ? null : trim((string) $data['author_role']),
            'featured' => (bool) ($data['featured'] ?? false),
            'allow_comments' => (bool) ($data['allow_comments'] ?? true),
            'faq' => json_encode($faq, JSON_UNESCAPED_UNICODE),
            'word_count' => LandingBlog::words($body),
        ];
    }

    private function editable(object $row): array
    {
        return [
            'title' => $row->title,
            'title_accent' => $row->title_accent,
            'excerpt' => $row->excerpt,
            'body' => $row->body,
            'category' => $row->category,
            'focus_keyword' => $row->focus_keyword,
            'author_name' => $row->author_name,
            'author_role' => $row->author_role,
            'featured' => (bool) $row->featured,
            'allow_comments' => (bool) $row->allow_comments,
            'faq' => (array) json_decode((string) $row->faq, true),
        ];
    }

    private function present(object $row): array
    {
        return [
            ...$this->editable($row),
            'id' => (string) $row->id,
            'slug' => (string) $row->slug,
            'status' => (string) $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'next' => array_map(fn (string $status): array => ['value' => $status, 'label' => ['publicado' => 'Publicar', 'archivado' => 'Archivar', 'borrador' => 'Volver a borrador'][$status]], self::TRANSITIONS[$row->status] ?? []),
            'category_label' => LandingBlog::CATEGORIES[LandingBlog::SITE][(string) $row->category] ?? null,
            'word_count' => (int) $row->word_count,
            'reads' => (int) $row->reads,
            'useful_yes' => (int) $row->useful_yes,
            'useful_no' => (int) $row->useful_no,
            'comments' => ['approved' => (int) ($row->approved ?? 0), 'pending' => (int) ($row->pending ?? 0)],
            'published_at' => $row->published_at ? Carbon::parse($row->published_at)->toIso8601String() : null,
            'updated_at' => Carbon::parse($row->updated_at)->toIso8601String(),
            'href' => '/software/blog/'.$row->slug,
            'deletable' => $row->status === 'borrador' && $row->published_at === null,
        ];
    }

    private function row(string $id): object
    {
        $row = Str::isUuid($id) ? $this->db()->table('platform_blog_posts')->where('id', $id)->where('site', LandingBlog::SITE)->lock('for no key update')->first() : null;

        return $row ?? throw ApiException::notFound('El artículo no existe.');
    }

    private function slug(?string $slug, string $title, ?string $ignore = null): string
    {
        $base = Str::limit(Str::slug($slug ?: $title), 150, '') ?: 'articulo';
        $candidate = $base;
        $n = 2;

        while ($this->db()->table('platform_blog_posts')->where('slug', $candidate)->when($ignore, fn ($q) => $q->where('id', '<>', $ignore))->exists()) {
            $candidate = $base.'-'.$n++;
        }

        return $candidate;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
