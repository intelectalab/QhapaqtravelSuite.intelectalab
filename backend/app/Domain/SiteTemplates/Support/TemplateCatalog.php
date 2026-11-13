<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Support\SiteDesign;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class TemplateCatalog
{
    public const CONNECTION = 'pgsql_platform';

    public const CATEGORIES = ['agencia' => 'Agencia', 'free_tour' => 'Free tours', 'aventura' => 'Aventura', 'lujo' => 'Lujo', 'corporativo' => 'Corporativo', 'multi' => 'Circuitos'];

    public const STATUSES = ['borrador' => 'Borrador', 'en_revision' => 'En revisión', 'publicado' => 'Publicada', 'retirado' => 'Retirada'];

    public const TIERS = ['incluida' => 'Incluida', 'premium' => 'Premium'];

    public const LIGHTHOUSE_MIN = ['performance' => 85, 'accessibility' => 95, 'seo' => 95, 'best_practices' => 90];

    public const SECTIONS = ['hero_buscador', 'hero_video', 'hero_foto', 'hero_simple', 'destinos', 'experiencias', 'mas_vendidos', 'salidas', 'ofertas', 'resenas', 'aventuras', 'blog', 'boletin', 'servicios', 'casos', 'cotizar', 'clientes', 'colecciones', 'a_medida', 'testimonios', 'prensa', 'horarios_hoy', 'tours', 'punto_encuentro', 'mapa_rutas', 'armar_viaje'];

    public function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }

    public function all(): Collection
    {
        return $this->db()->table('platform_site_templates')->orderByDesc('default_for_new')->orderBy('status')->orderByDesc('installs')->orderBy('name')->get();
    }

    public function published(): Collection
    {
        return $this->db()->table('platform_site_templates')->where('status', 'publicado')->orderByDesc('default_for_new')->orderByDesc('installs')->orderBy('name')->get();
    }

    public function find(string $code): stdClass
    {
        $row = $this->db()->table('platform_site_templates')->where('code', $code)->first();

        if ($row === null) {
            throw ApiException::notFound('Esa plantilla no existe.');
        }

        return $row;
    }

    public function findPublished(string $code): stdClass
    {
        $row = $this->find($code);

        if ($row->status !== 'publicado') {
            throw ApiException::notFound('Esa plantilla no está disponible en la galería.');
        }

        return $row;
    }

    public function byId(string $id): ?stdClass
    {
        return $this->db()->table('platform_site_templates')->where('id', $id)->first();
    }

    public function defaultTemplate(): ?stdClass
    {
        return $this->db()->table('platform_site_templates')->where('default_for_new', true)->where('status', 'publicado')->first();
    }

    public function versionById(?string $id): ?stdClass
    {
        return $id === null ? null : $this->db()->table('platform_site_template_versions')->where('id', $id)->first();
    }

    public function versions(string $templateId): Collection
    {
        return $this->db()->table('platform_site_template_versions')->where('template_id', $templateId)->orderByDesc('created_at')->get();
    }

    public function publishedVersion(stdClass $template, ?string $version = null): stdClass
    {
        $row = $version === null
            ? $this->versionById($template->current_version_id)
            : $this->db()->table('platform_site_template_versions')->where('template_id', $template->id)->where('version', $version)->first();

        if ($row === null || $row->status !== 'publicada') {
            throw ApiException::unprocessable('TEMPLATE_VERSION_UNAVAILABLE', 'Esa versión de la plantilla no está publicada.');
        }

        return $row;
    }

    public function plans(): Collection
    {
        return $this->db()->table('plans')->orderBy('rank')->get(['id', 'code', 'name', 'rank']);
    }

    public function tenantPlan(string $tenantId): ?stdClass
    {
        return $this->db()->table('tenants')->join('plans', 'plans.id', '=', 'tenants.plan_id')->where('tenants.id', $tenantId)->first(['plans.code', 'plans.name', 'plans.rank']);
    }

    public function planAllows(stdClass $template, ?array $plan): bool
    {
        if ($template->min_plan_code === null) {
            return true;
        }

        $required = $this->plans()->firstWhere('code', $template->min_plan_code);

        return $required === null || ($plan !== null && (int) $plan['rank'] >= (int) $required->rank);
    }

    public function siteStyle(?stdClass $version): ?string
    {
        $style = $version !== null ? ($this->manifest($version)['site_style'] ?? null) : null;

        return is_string($style) && array_key_exists($style, SiteDesign::STYLES) ? $style : null;
    }

    public function manifest(stdClass $version): array
    {
        return is_string($version->manifest) ? (json_decode($version->manifest, true) ?: []) : (array) $version->manifest;
    }

    public function present(stdClass $template, ?stdClass $version = null): array
    {
        $version ??= $this->versionById($template->current_version_id);
        $manifest = $version !== null ? $this->manifest($version) : [];
        $style = $this->siteStyle($version);
        $plan = $template->min_plan_code !== null ? $this->plans()->firstWhere('code', $template->min_plan_code) : null;

        return [
            'code' => $template->code,
            'slug' => $template->slug,
            'name' => $template->name,
            'description' => $template->description,
            'category' => $template->category,
            'category_label' => self::CATEGORIES[$template->category] ?? $template->category,
            'tier' => $template->tier,
            'price' => number_format((float) $template->price_once, 2, '.', ''),
            'currency' => $template->currency,
            'min_plan' => $plan !== null ? ['code' => $plan->code, 'name' => $plan->name] : null,
            'author' => ['kind' => $template->author_kind, 'name' => $template->author_name],
            'repo_url' => $template->repo_url,
            'status' => $template->status,
            'status_label' => self::STATUSES[$template->status] ?? $template->status,
            'is_default' => (bool) $template->default_for_new,
            'installs' => (int) $template->installs,
            'tags' => $this->tags($template->tags),
            'version' => $version?->version,
            'lighthouse' => $version !== null ? $this->lighthouse($version, $manifest) : null,
            'sections' => array_values((array) ($manifest['sections'] ?? [])),
            'tokens' => (array) ($manifest['tokens'] ?? []),
            'site_style' => $style,
            'available' => $template->status === 'publicado' && $style !== null,
        ];
    }

    public function presentVersion(stdClass $version): array
    {
        $manifest = $this->manifest($version);

        return [
            'id' => $version->id,
            'version' => $version->version,
            'status' => $version->status,
            'changelog' => $version->changelog,
            'lighthouse' => $this->lighthouse($version, $manifest),
            'sections' => array_values((array) ($manifest['sections'] ?? [])),
            'published_at' => $version->published_at ? Carbon::parse($version->published_at)->toIso8601String() : null,
        ];
    }

    public function lighthouse(stdClass $version, array $manifest): array
    {
        return [
            'performance' => $version->lh_performance !== null ? (int) $version->lh_performance : null,
            'accessibility' => $version->lh_accessibility !== null ? (int) $version->lh_accessibility : null,
            'seo' => $version->lh_seo !== null ? (int) $version->lh_seo : null,
            'best_practices' => $version->lh_best_practices !== null ? (int) $version->lh_best_practices : null,
            'measured' => ($manifest['lighthouse_measured'] ?? true) !== false,
        ];
    }

    public function meetsLighthouse(array $scores): bool
    {
        foreach (self::LIGHTHOUSE_MIN as $key => $minimum) {
            if (! isset($scores[$key]) || (int) $scores[$key] < $minimum) {
                return false;
            }
        }

        return true;
    }

    private function tags(mixed $value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        $inner = trim((string) $value, '{}');

        return $inner === '' ? [] : array_map(fn (string $tag): string => trim($tag, '"'), str_getcsv($inner, ',', '"', '\\'));
    }
}
