<?php

declare(strict_types=1);

namespace App\Domain\Landing\Actions;

use App\Domain\Landing\Support\LandingBlog;
use App\Domain\Landing\Support\Visitor;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LandingEngagement
{
    public function __construct(private readonly LandingBlog $blog) {}

    public function read(string $slug, Request $request): array
    {
        $post = $this->blog->post($slug);
        $counted = Cache::add('landing-read:'.$post->id.':'.Visitor::fingerprint($request), true, now()->endOfDay());

        if ($counted) {
            $this->db()->table('platform_blog_posts')->where('id', $post->id)->increment('reads');
        }

        return ['counted' => $counted, 'reads' => (int) $this->db()->table('platform_blog_posts')->where('id', $post->id)->value('reads')];
    }

    public function ratePost(string $slug, bool $useful, Request $request): array
    {
        $post = $this->blog->post($slug);
        $counted = $this->vote('post', (string) $post->id, $useful ? 1 : -1, $request);

        if ($counted) {
            $this->db()->table('platform_blog_posts')->where('id', $post->id)->increment($useful ? 'useful_yes' : 'useful_no');
        }

        $row = $this->db()->table('platform_blog_posts')->where('id', $post->id)->first(['useful_yes', 'useful_no']);

        return ['counted' => $counted, 'yes' => (int) $row?->useful_yes, 'no' => (int) $row?->useful_no, 'message' => $counted ? ($useful ? 'Gracias. Nos ayuda a escribir mejores guías.' : 'Gracias. Cuéntanos en los comentarios qué faltó.') : 'Ya nos diste tu opinión sobre este artículo.'];
    }

    public function markUseful(string $id, Request $request): array
    {
        $comment = Str::isUuid($id) ? $this->db()->table('platform_blog_comments')->where('id', $id)->where('status', 'aprobado')->first(['id']) : null;

        if ($comment === null) {
            throw ApiException::notFound('El comentario no existe o ya no está publicado.');
        }

        $counted = $this->vote('comment', (string) $comment->id, 1, $request);

        if ($counted) {
            $this->db()->table('platform_blog_comments')->where('id', $comment->id)->update(['useful' => DB::raw('useful + 1'), 'updated_at' => DB::raw('updated_at')]);
        }

        return ['counted' => $counted, 'useful' => (int) $this->db()->table('platform_blog_comments')->where('id', $comment->id)->value('useful'), 'message' => $counted ? 'Gracias por tu voto.' : 'Ya marcaste este comentario como útil.'];
    }

    private function vote(string $target, string $targetId, int $value, Request $request): bool
    {
        return $this->db()->table('platform_blog_votes')->insertOrIgnore([
            'id' => (string) Str::uuid7(),
            'target' => $target,
            'target_id' => $targetId,
            'visitor_hash' => Visitor::fingerprint($request),
            'value' => $value,
            'created_at' => now(),
        ]) === 1;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
