<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LandingBlog
{
    public const SITE = 'kipucontrol';

    public const SITES = ['kipucontrol' => 'KipuControl', 'rutaslibres' => 'Rutas Libres'];

    public const CATEGORIES = [
        'kipucontrol' => ['ventas' => 'Ventas', 'marketing-seo' => 'Marketing y SEO', 'operaciones' => 'Operaciones', 'finanzas' => 'Finanzas', 'ia' => 'IA para turismo'],
        'rutaslibres' => ['guias-de-barrio' => 'Guías de barrio', 'gastronomia' => 'Gastronomía', 'itinerarios' => 'Itinerarios', 'consejos' => 'Consejos prácticos'],
    ];

    public const ORDERS = ['recientes' => 'Más recientes', 'leidos' => 'Más leídos'];

    public const WORDS_PER_MINUTE = 200;

    public function list(array $filters): array
    {
        $site = array_key_exists((string) ($filters['site'] ?? ''), self::SITES) ? (string) $filters['site'] : null;
        $category = (string) ($filters['category'] ?? '');
        $search = trim((string) ($filters['q'] ?? ''));
        $order = array_key_exists((string) ($filters['order'] ?? ''), self::ORDERS) ? (string) $filters['order'] : 'recientes';

        $published = $this->published()->when($site !== null, fn (Builder $q) => $q->where('p.site', $site))->get();
        $rows = $published
            ->when($category !== '', fn (Collection $rows) => $rows->where('category', $category))
            ->when($search !== '', fn (Collection $rows) => $rows->filter(fn (object $row): bool => $this->matches($row, $search)))
            ->sortByDesc(fn (object $row) => $order === 'leidos' ? (int) $row->reads : (string) $row->published_at)
            ->values();
        $featured = $published->where('site', self::SITE)->firstWhere('featured', true);

        return [
            'items' => $rows->map(fn (object $row): array => $this->card($row))->all(),
            'featured' => $featured !== null && $category === '' && $search === '' && $site !== 'rutaslibres' ? $this->card($featured) : null,
            'popular' => $published->sortByDesc('reads')->take(3)->map(fn (object $row): array => $this->card($row))->values()->all(),
            'categories' => $this->categories($published, $site),
            'sites' => collect(self::SITES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label, 'count' => $published->where('site', $value)->count()])->values()->all(),
            'orders' => collect(self::ORDERS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'filters' => ['site' => $site, 'category' => $category === '' ? null : $category, 'q' => $search === '' ? null : $search, 'order' => $order],
            'total' => $rows->count(),
        ];
    }

    public function show(string $slug): array
    {
        $row = $this->published()->where('p.site', self::SITE)->where('p.slug', $slug)->first() ?? throw ApiException::notFound('El artículo no existe o ya no está publicado.');
        $others = $this->published()->where('p.site', self::SITE)->where('p.id', '<>', $row->id)->get();
        $related = $others->sortBy(fn (object $other): string => ($other->category === $row->category ? '0' : '1').(9999999999 - Carbon::parse($other->published_at)->timestamp))->take(3);
        $comments = $this->comments((string) $row->id);

        return [
            ...$this->card($row),
            'body' => (string) $row->body,
            'faq' => array_values(array_filter((array) json_decode((string) $row->faq, true), fn ($item): bool => is_array($item) && isset($item['q'], $item['a']))),
            'allow_comments' => (bool) $row->allow_comments,
            'useful' => ['yes' => (int) $row->useful_yes, 'no' => (int) $row->useful_no],
            'comments' => $comments,
            'comment_count' => collect($comments)->sum(fn (array $comment): int => 1 + count($comment['replies'])),
            'related' => $related->map(fn (object $other): array => $this->card($other))->values()->all(),
            'updated_at' => Carbon::parse($row->updated_at)->toIso8601String(),
        ];
    }

    public function post(string $slug): object
    {
        return $this->published()->where('p.site', self::SITE)->where('p.slug', $slug)->first() ?? throw ApiException::notFound('El artículo no existe o ya no está publicado.');
    }

    public function card(object $row): array
    {
        $site = (string) $row->site;

        return [
            'id' => (string) $row->id,
            'slug' => (string) $row->slug,
            'site' => $site,
            'site_label' => self::SITES[$site] ?? $site,
            'title' => (string) $row->title,
            'title_accent' => $row->title_accent,
            'excerpt' => (string) $row->excerpt,
            'category' => $row->category,
            'category_label' => self::CATEGORIES[$site][(string) $row->category] ?? null,
            'keyword' => (string) $row->focus_keyword,
            'author' => $row->author_name ?? $row->platform_author ?? 'Equipo KipuControl',
            'author_role' => $row->author_role,
            'published_at' => Carbon::parse($row->published_at)->toIso8601String(),
            'reading_minutes' => max(1, (int) ceil(((int) $row->word_count ?: str_word_count(strip_tags((string) $row->body))) / self::WORDS_PER_MINUTE)),
            'reads' => (int) $row->reads,
            'featured' => (bool) $row->featured,
            'href' => $site === self::SITE ? '/software/blog/'.$row->slug : '/vitrina/blog/'.$row->slug,
        ];
    }

    public static function words(string $body): int
    {
        return count(preg_split('/\s+/u', trim(preg_replace('/[#>|*\-\[\]]/u', ' ', strip_tags($body)) ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: []);
    }

    private function comments(string $postId): array
    {
        $rows = $this->db()->table('platform_blog_comments')->where('post_id', $postId)->where('status', 'aprobado')->orderBy('created_at')->get(['id', 'code', 'parent_id', 'name', 'body', 'useful', 'staff', 'created_at']);
        $present = fn (object $row): array => ['id' => (string) $row->id, 'code' => (string) $row->code, 'name' => (string) $row->name, 'body' => (string) $row->body, 'useful' => (int) $row->useful, 'staff' => (bool) $row->staff, 'created_at' => Carbon::parse($row->created_at)->toIso8601String()];

        return $rows->whereNull('parent_id')->map(fn (object $root): array => [
            ...$present($root),
            'replies' => $rows->where('parent_id', $root->id)->map($present)->values()->all(),
        ])->values()->all();
    }

    private function categories(Collection $published, ?string $site): array
    {
        $out = [];

        foreach (self::CATEGORIES as $siteCode => $categories) {
            if ($site !== null && $site !== $siteCode) {
                continue;
            }

            foreach ($categories as $value => $label) {
                $count = $published->where('site', $siteCode)->where('category', $value)->count();

                if ($count > 0) {
                    $out[] = ['value' => $value, 'label' => $label, 'site' => $siteCode, 'count' => $count];
                }
            }
        }

        return $out;
    }

    private function matches(object $row, string $search): bool
    {
        $needle = Str::lower(Str::ascii($search));
        $haystack = Str::lower(Str::ascii(implode(' ', [$row->title, $row->excerpt, $row->focus_keyword, self::CATEGORIES[$row->site][(string) $row->category] ?? ''])));

        return collect(preg_split('/\s+/', $needle) ?: [])->every(fn (string $word): bool => $word === '' || str_contains($haystack, $word));
    }

    private function published(): Builder
    {
        return $this->db()->table('platform_blog_posts as p')->leftJoin('platform_users as u', 'u.id', '=', 'p.author_id')
            ->where('p.status', 'publicado')->whereNotNull('p.published_at')->where('p.published_at', '<=', now())
            ->select(['p.id', 'p.slug', 'p.site', 'p.title', 'p.title_accent', 'p.excerpt', 'p.body', 'p.category', 'p.focus_keyword', 'p.author_name', 'p.author_role', 'p.published_at', 'p.updated_at', 'p.word_count', 'p.reads', 'p.featured', 'p.allow_comments', 'p.faq', 'p.useful_yes', 'p.useful_no', 'u.name as platform_author']);
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
