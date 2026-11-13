<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class BlogSync
{
    private const STATUS = ['draft' => 'borrador', 'scheduled' => 'en_revision', 'published' => 'publicado', 'archived' => 'archivado'];

    private const LAST_KEY = 'payload-webhook:last';

    public function __construct(private readonly AuditLogger $audit) {}

    public function verify(Request $request): void
    {
        $secret = (string) config('seguimiento.payload.webhook_secret');
        $timestamp = (string) $request->header('X-Kipu-Timestamp', '');
        $signature = (string) $request->header('X-Kipu-Signature', '');
        $expected = 'sha256='.hash_hmac('sha256', $timestamp.'.'.$request->getContent(), $secret);
        $fresh = ctype_digit($timestamp) && abs(time() - (int) $timestamp) <= (int) config('seguimiento.payload.tolerance_seconds', 300);

        if ($secret === '' || ! $fresh || ! hash_equals($expected, $signature)) {
            $this->remember(false, 'Firma inválida o vencida');

            throw ApiException::unauthorized('WEBHOOK_SIGNATURE', 'La firma del webhook de Payload no es válida o venció.');
        }
    }

    public function handle(Request $request): array
    {
        $key = (string) $request->header('Idempotency-Key', '');

        if ($key !== '' && ($previous = Cache::get('payload-webhook:'.hash('sha256', $key))) !== null) {
            return [...$previous, 'replayed' => true];
        }

        $data = Validator::make($request->all(), [
            'event' => ['required', 'in:created,updated,published,unpublished,slug_changed,deleted'],
            'post.id' => ['required', 'string', 'max:40'],
            'post.slug' => ['required', 'string', 'max:160', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/'],
            'post.title' => ['required', 'string', 'max:200'],
            'post.excerpt' => ['nullable', 'string', 'max:320'],
            'post.focus_keyword' => ['nullable', 'string', 'max:120'],
            'post.status' => ['nullable', 'in:draft,scheduled,published,archived'],
            'post.word_count' => ['nullable', 'integer', 'min:0'],
            'post.seo_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'post.published_at' => ['nullable', 'date'],
            'post.canonical_url' => ['nullable', 'string', 'max:300', 'starts_with:https://'],
            'post.noindex' => ['nullable', 'boolean'],
            'post.city' => ['nullable', 'string', 'max:40'],
        ], ['post.slug.regex' => 'El slug debe tener solo minúsculas, números y guiones.'])->validate();
        $post = $data['post'];
        $status = match ($data['event']) {
            'published' => 'publicado',
            'unpublished' => 'borrador',
            'deleted' => 'archivado',
            default => self::STATUS[$post['status'] ?? 'draft'],
        };
        $values = [
            'slug' => $post['slug'],
            'title' => $post['title'],
            'excerpt' => mb_substr((string) ($post['excerpt'] ?? $post['title']), 0, 320),
            'focus_keyword' => (string) ($post['focus_keyword'] ?? ''),
            'status' => $status,
            'word_count' => (int) ($post['word_count'] ?? 0),
            'seo_score' => $post['seo_score'] ?? null,
            'published_at' => $status === 'publicado' ? Carbon::parse($post['published_at'] ?? now())->utc() : ($post['published_at'] ?? null),
            'canonical_url' => $post['canonical_url'] ?? null,
            'noindex' => (bool) ($post['noindex'] ?? false),
            'city' => $post['city'] ?? null,
            'synced_at' => now(),
            'updated_at' => now(),
        ];

        try {
            $result = $this->db()->transaction(function () use ($post, $values, $data): array {
                $current = $this->db()->table('platform_blog_posts')->where('payload_id', $post['id'])->lock('for no key update')->first();
                $sameSlug = $this->db()->table('platform_blog_posts')->where('slug', $values['slug'])->when($current !== null, fn ($query) => $query->where('id', '<>', $current->id))->lock('for no key update')->first();

                if ($sameSlug !== null && ($current !== null || $sameSlug->payload_id !== null)) {
                    throw ApiException::conflict('SLUG_TAKEN', "Ya hay otro artículo con el slug {$values['slug']}. Cámbialo en Payload.");
                }

                if ($current === null && $sameSlug !== null) {
                    $this->db()->table('platform_blog_posts')->where('id', $sameSlug->id)->update(['payload_id' => $post['id'], ...$values]);
                } elseif ($current === null) {
                    $this->db()->table('platform_blog_posts')->insert(['id' => (string) Str::uuid7(), 'payload_id' => $post['id'], ...$values, 'created_at' => now()]);
                } else {
                    $this->db()->table('platform_blog_posts')->where('id', $current->id)->update($values);
                }

                $this->audit->log('Blog Payload', $post['id'], 'sincronizar_'.$data['event'], $current?->status, "{$values['status']} · /blog/{$values['slug']}", connection: 'pgsql_platform');

                return ['payload_id' => $post['id'], 'slug' => $values['slug'], 'status' => $values['status'], 'created' => $current === null];
            });
        } catch (QueryException $e) {
            if ((string) $e->getCode() === '23514') {
                $this->remember(false, "VT-13: {$post['slug']} tiene menos de 800 palabras");

                throw ApiException::unprocessable('VT-13', 'Un artículo publicado necesita 800 palabras o más. El índice no cambió.');
            }

            throw $e;
        }

        $this->remember(true, "{$data['event']} · {$post['slug']}");

        if ($key !== '') {
            Cache::put('payload-webhook:'.hash('sha256', $key), $result, now()->addDay());
        }

        return $result;
    }

    public function status(): array
    {
        $posts = $this->db()->table('platform_blog_posts')->orderByDesc('updated_at')->limit(200)
            ->get(['payload_id', 'slug', 'title', 'status', 'word_count', 'seo_score', 'focus_keyword', 'published_at', 'synced_at', 'noindex', 'canonical_url']);
        $last = Cache::get(self::LAST_KEY);

        return [
            'kpis' => [
                'synced' => $posts->whereNotNull('payload_id')->count(),
                'pending' => $posts->whereNull('payload_id')->count(),
                'published' => $posts->where('status', 'publicado')->count(),
                'below_minimum' => $posts->where('status', '<>', 'publicado')->where('word_count', '<', 800)->count(),
            ],
            'last_webhook' => $last,
            'admin_url' => config('seguimiento.payload.admin_url'),
            'configured' => (string) config('seguimiento.payload.webhook_secret') !== '',
            'posts' => $posts->map(fn (object $post) => [
                'payload_id' => $post->payload_id,
                'slug' => $post->slug,
                'title' => $post->title,
                'status' => $post->status,
                'word_count' => (int) $post->word_count,
                'seo_score' => $post->seo_score === null ? null : (int) $post->seo_score,
                'focus_keyword' => $post->focus_keyword,
                'published_at' => $post->published_at ? Carbon::parse($post->published_at)->toIso8601String() : null,
                'synced_at' => $post->synced_at ? Carbon::parse($post->synced_at)->toIso8601String() : null,
                'noindex' => (bool) $post->noindex,
                'source' => $post->payload_id ? 'payload' : 'nativo',
            ])->values(),
        ];
    }

    private function remember(bool $ok, string $note): void
    {
        Cache::forever(self::LAST_KEY, ['at' => now()->toIso8601String(), 'ok' => $ok, 'note' => $note]);
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
