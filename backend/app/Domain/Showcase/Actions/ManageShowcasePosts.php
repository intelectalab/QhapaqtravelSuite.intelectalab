<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Showcase\Support\PgArray;
use App\Domain\Showcase\Support\ShowcaseRules;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageShowcasePosts
{
    public const STATUSES = ['borrador', 'en_revision', 'publicado', 'archivado'];

    public function __construct(private readonly PlatformSession $session) {}

    public function create(array $data, PlatformUser $actor): array
    {
        $id = (string) Str::uuid7();
        $slug = $this->slug($data['slug'] ?? null, (string) $data['title']);
        $this->db()->table('platform_blog_posts')->insert([
            'id' => $id,
            'slug' => $slug,
            ...$this->fields($data),
            'status' => 'borrador',
            'author_id' => $actor->getKey(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->session->log('Blog vitrina', $slug, 'crear', null, (string) $data['title'], $actor);

        return ['id' => $id, 'slug' => $slug, 'status' => 'borrador'];
    }

    public function update(string $id, array $data, PlatformUser $actor): array
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('El artículo no existe.');
        }

        return $this->db()->transaction(function () use ($id, $data, $actor): array {
            $post = $this->db()->table('platform_blog_posts')->where('id', $id)->lock('for no key update')->first(['*', DB::raw('array_to_json(linked_listing_ids) as linked')]) ?? throw ApiException::notFound('El artículo no existe.');
            $merged = [
                'title' => $data['title'] ?? $post->title,
                'excerpt' => $data['excerpt'] ?? $post->excerpt,
                'body' => array_key_exists('body', $data) ? $data['body'] : $post->body,
                'city' => array_key_exists('city', $data) ? $data['city'] : $post->city,
                'focus_keyword' => $data['focus_keyword'] ?? $post->focus_keyword,
                'linked_listings' => $data['linked_listings'] ?? PgArray::parse($post->linked),
                'seo_score' => $data['seo_score'] ?? $post->seo_score,
                'word_count' => $post->word_count,
            ];
            $status = $data['status'] ?? $post->status;
            $fields = $this->fields($merged);

            if ($status === 'publicado') {
                $this->assertPublishable($fields, $merged);
            }

            $slug = isset($data['slug']) ? $this->slug($data['slug'], (string) $merged['title'], $id) : $post->slug;
            $this->db()->table('platform_blog_posts')->where('id', $id)->update([
                ...$fields,
                'slug' => $slug,
                'status' => $status,
                'published_at' => $status === 'publicado' ? ($post->published_at ?? now()) : ($status === 'archivado' ? $post->published_at : null),
                'updated_at' => now(),
            ]);
            $this->session->log('Blog vitrina', $slug, $status !== $post->status ? $status : 'editar', $post->status, $status, $actor);

            return ['id' => $id, 'slug' => $slug, 'status' => $status];
        });
    }

    private function assertPublishable(array $fields, array $merged): void
    {
        if ($fields['word_count'] < ShowcaseRules::BLOG_MIN_WORDS) {
            throw ApiException::unprocessable('VT-13', "El artículo tiene {$fields['word_count']} palabras. Para publicarlo necesita al menos ".ShowcaseRules::BLOG_MIN_WORDS.'.');
        }

        if (blank($merged['focus_keyword'])) {
            throw ApiException::unprocessable('VT-13', 'Define la palabra clave antes de publicar.');
        }

        $ids = $merged['linked_listings'];
        $count = $ids === [] ? 0 : $this->db()->table('platform_showcase_listings')->whereIn('id', $ids)->where('status', 'publicado')
            ->when(! blank($merged['city']), fn ($q) => $q->where('city', Str::lower((string) $merged['city'])))->count();

        if ($count < ShowcaseRules::BLOG_MIN_LISTINGS) {
            throw ApiException::unprocessable('VT-13', 'Enlaza al menos '.ShowcaseRules::BLOG_MIN_LISTINGS.' tours publicados de la ciudad del artículo.');
        }
    }

    private function fields(array $data): array
    {
        $ids = array_values(array_filter($data['linked_listings'] ?? [], fn ($v) => is_string($v) && Str::isUuid($v)));
        $body = (string) ($data['body'] ?? '');

        return [
            'title' => trim((string) $data['title']),
            'excerpt' => trim((string) $data['excerpt']),
            'body' => $body === '' ? null : $body,
            'city' => blank($data['city'] ?? null) ? null : Str::lower(trim((string) $data['city'])),
            'focus_keyword' => trim((string) $data['focus_keyword']),
            'word_count' => $body === '' ? (int) ($data['word_count'] ?? 0) : count(preg_split('/\s+/u', trim(strip_tags($body)), -1, PREG_SPLIT_NO_EMPTY) ?: []),
            'seo_score' => isset($data['seo_score']) ? (int) $data['seo_score'] : null,
            'linked_listing_ids' => PgArray::literal($ids),
        ];
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
