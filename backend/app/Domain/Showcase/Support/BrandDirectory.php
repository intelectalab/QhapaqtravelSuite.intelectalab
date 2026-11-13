<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Showcase\Actions\ManageSiteBrand;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class BrandDirectory
{
    public function __construct(private readonly TenantContext $context) {}

    public function domains(): array
    {
        $rows = DB::table('cms_site_domains')->orderByRaw("case status when 'verificado' then 0 when 'pendiente_dns' then 1 when 'error' then 2 else 3 end")->orderBy('host')->get();
        $live = $rows->where('status', '<>', 'retirado');

        return [
            'items' => $rows->map(fn (object $row) => [
                'id' => $row->id,
                'host' => $row->host,
                'purpose' => $row->purpose,
                'status' => $row->status,
                'ssl_status' => $row->ssl_status,
                'ssl_expires_at' => $row->ssl_expires_at ? Carbon::parse($row->ssl_expires_at)->toIso8601String() : null,
                'ssl_renews_on' => $row->ssl_expires_at ? Carbon::parse($row->ssl_expires_at)->subDays(30)->toDateString() : null,
                'verified_at' => $row->verified_at ? Carbon::parse($row->verified_at)->toIso8601String() : null,
                'last_check_at' => $row->last_check_at ? Carbon::parse($row->last_check_at)->toIso8601String() : null,
                'last_error' => $row->last_error,
                'dns' => ManageSiteBrand::dns((string) $row->host, (string) $row->verify_token),
            ])->values()->all(),
            'kpis' => ['total' => $live->count(), 'verified' => $live->where('status', 'verificado')->count(), 'pending' => $live->whereIn('status', ['pendiente_dns', 'error'])->count()],
            'purposes' => ManageSiteBrand::PURPOSES,
            'fallback_host' => $this->fallbackHost(),
        ];
    }

    public function pages(): array
    {
        $rows = DB::table('cms_seo_pages')->orderBy('path')->get(['*', DB::raw('array_to_json(schema_types) as schema_json')]);
        $scored = $rows->whereNotNull('score');

        return [
            'items' => $rows->map(fn (object $row) => [
                'id' => $row->id,
                'path' => $row->path,
                'title' => $row->title,
                'meta_description' => $row->meta_description,
                'focus_keyword' => $row->focus_keyword,
                'schema_types' => PgArray::parse($row->schema_json),
                'canonical_url' => $row->canonical_url,
                'indexable' => (bool) $row->indexable,
                'h1_count' => (int) $row->h1_count,
                'word_count' => (int) $row->word_count,
                'images' => (int) $row->images,
                'images_with_alt' => (int) $row->images_with_alt,
                'speed_mobile' => $row->speed_mobile === null ? null : (int) $row->speed_mobile,
                'score' => $row->score === null ? null : (int) $row->score,
                'issues' => json_decode((string) $row->issues, true) ?: [],
                'clicks_28d' => (int) $row->clicks_28d,
                'avg_position' => $row->avg_position === null ? null : (float) $row->avg_position,
                'audited_at' => $row->audited_at ? Carbon::parse($row->audited_at)->toIso8601String() : null,
            ])->values()->all(),
            'kpis' => [
                'pages' => $rows->count(),
                'average' => $scored->isEmpty() ? null : (int) round($scored->avg('score')),
                'clicks_28d' => (int) $rows->sum('clicks_28d'),
                'with_issues' => $rows->filter(fn (object $row) => (json_decode((string) $row->issues, true) ?: []) !== [])->count(),
            ],
            'checks' => SeoAuditor::CHECKS,
            'sitemap' => $this->sitemap($rows->pluck('path')->all()),
        ];
    }

    public function redirects(): array
    {
        $rows = DB::table('cms_redirects')->orderByDesc('active')->orderByDesc('hits')->get();

        return [
            'items' => $rows->map(fn (object $row) => ['id' => $row->id, 'from_path' => $row->from_path, 'to_path' => $row->to_path, 'code' => (int) $row->code, 'hits' => (int) $row->hits, 'active' => (bool) $row->active, 'created_at' => Carbon::parse($row->created_at)->toIso8601String()])->values()->all(),
            'kpis' => ['active' => $rows->where('active', true)->count(), 'hits' => (int) $rows->sum('hits')],
        ];
    }

    private function sitemap(array $paths): array
    {
        $host = $this->fallbackHost();
        $urls = collect(['/', '/tours', '/blog', '/aventuras', ...$paths])->unique()->values();

        return [
            'host' => $host,
            'urls' => $urls->map(fn (string $path) => 'https://'.$host.$path)->all(),
            'robots' => "User-agent: *\nDisallow: /checkout\nDisallow: /cuenta\nSitemap: https://{$host}/sitemap.xml",
        ];
    }

    private function fallbackHost(): string
    {
        $verified = DB::table('cms_site_domains')->where('status', 'verificado')->orderByRaw("case purpose when 'principal' then 0 else 1 end")->value('host');

        return $verified ?: $this->context->tenant()->subdomain.'.'.config('sites.domain');
    }
}
