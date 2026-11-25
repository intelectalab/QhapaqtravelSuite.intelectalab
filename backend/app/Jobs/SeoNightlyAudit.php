<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Showcase\Actions\ManageSiteBrand;
use Illuminate\Support\Facades\DB;

final class SeoNightlyAudit extends TenantJob
{
    public const QUEUE = 'reports';

    protected function run(): string
    {
        if (! DB::table('cms_seo_pages')->exists() && ! DB::table('cms_travel_stories')->where('status', 'publicado')->exists()) {
            return 'Sin páginas publicadas por auditar';
        }

        $result = app(ManageSiteBrand::class)->audit();
        $issues = DB::table('cms_seo_pages')->whereRaw("issues <> '[]'::jsonb")->count();

        return self::summary([
            self::plural((int) $result['pages'], 'página auditada', 'páginas auditadas'),
            $result['created'] > 0 ? self::plural((int) $result['created'], 'página nueva', 'páginas nuevas') : null,
            $result['average'] !== null ? 'puntaje medio '.$result['average'] : null,
            $issues > 0 ? self::plural($issues, 'página con mejoras pendientes', 'páginas con mejoras pendientes') : null,
        ], 'Sin páginas publicadas por auditar');
    }
}
