<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Landing\Support\CommentCodes;
use App\Domain\Landing\Support\LandingBlog;
use App\Domain\Landing\Support\Visitor;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

final class SubmitBlogComment
{
    public const PER_HOUR = 3;

    public const SPAM_LINKS = 2;

    public function __construct(private readonly LandingBlog $blog) {}

    public function __invoke(string $slug, array $data, Request $request): array
    {
        $post = $this->blog->post($slug);

        if (! (bool) $post->allow_comments) {
            throw ApiException::conflict('COMMENTS_CLOSED', 'Este artículo no recibe comentarios.');
        }

        if (trim((string) ($data['website'] ?? '')) !== '') {
            return ['status' => 'recibido', 'message' => 'Comentario recibido.'];
        }

        $ipHash = Visitor::ipHash($request);
        $key = 'landing-comment:'.$ipHash;

        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            throw new ApiException(429, 'TOO_MANY_REQUESTS', 'LND-11', 'Ya enviaste varios comentarios. Inténtalo de nuevo en una hora.', [], ['retry_after' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key, 3600);
        $parent = $this->parent($data['parent_id'] ?? null, (string) $post->id);
        $body = trim((string) $data['body']);
        $email = mb_strtolower(trim((string) $data['email']));
        $emailHash = Visitor::stableHash($email);
        $status = $this->status($body, $emailHash);

        $code = DB::connection('pgsql_platform')->transaction(function () use ($post, $parent, $data, $body, $email, $emailHash, $status, $ipHash, $request): string {
            $code = CommentCodes::next();
            DB::connection('pgsql_platform')->table('platform_blog_comments')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'post_id' => $post->id,
                'parent_id' => $parent,
                'name' => trim((string) $data['name']),
                'email' => Crypt::encryptString($email),
                'email_hash' => $emailHash,
                'body' => $body,
                'status' => $status,
                'ip_hash' => $ipHash,
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 240),
                'consent_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $code;
        });

        return [
            'code' => $code,
            'status' => $status === 'aprobado' ? 'aprobado' : 'pendiente',
            'message' => $status === 'aprobado' ? 'Gracias. Tu comentario ya está publicado.' : 'Gracias. Tu comentario se publicará cuando lo revisemos.',
        ];
    }

    public static function links(string $body): int
    {
        return preg_match_all('~(https?://|www\.)\S+~i', $body);
    }

    private function status(string $body, string $emailHash): string
    {
        if (self::links($body) >= self::SPAM_LINKS) {
            return 'spam';
        }

        $trusted = DB::connection('pgsql_platform')->table('platform_blog_comments')->where('email_hash', $emailHash)->where('status', 'aprobado')->exists();

        return $trusted ? 'aprobado' : 'pendiente';
    }

    private function parent(mixed $parentId, string $postId): ?string
    {
        if ($parentId === null || $parentId === '') {
            return null;
        }

        $parent = Str::isUuid((string) $parentId) ? DB::connection('pgsql_platform')->table('platform_blog_comments')->where('id', $parentId)->where('post_id', $postId)->where('status', 'aprobado')->first(['id', 'parent_id']) : null;

        if ($parent === null) {
            throw ApiException::unprocessable('LND-12', 'El comentario que quieres responder ya no está disponible.');
        }

        if ($parent->parent_id !== null) {
            throw ApiException::unprocessable('LND-12', 'Solo se puede responder al comentario principal, no a otra respuesta.');
        }

        return (string) $parent->id;
    }
}
