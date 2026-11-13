<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Actions;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Domain\Site\Support\SiteDesign;
use App\Domain\SiteTemplates\Support\AiCredits;
use App\Domain\SiteTemplates\Support\TemplateCatalog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use stdClass;

final class TemplateAdmin
{
    public const ENTITY = 'Plantilla web';

    public const ENTITY_SUBMISSION = 'Envío de plantilla';

    public const ENTITY_PACK = 'Paquete de IA';

    public const CHECKS = ['manifest' => 'Manifiesto válido', 'build' => 'Build y SSR', 'lighthouse' => 'Lighthouse móvil', 'contraste' => 'Contraste WCAG AA', 'i18n' => 'Textos ES/EN/PT', 'datos_estructurados' => 'Datos estructurados', 'seguridad' => 'Seguridad (sin scripts externos)', 'revision_visual' => 'Revisión visual'];

    public const REPORTED_CHECKS = ['build', 'datos_estructurados', 'seguridad'];

    public const SUBMISSION_STATUSES = ['recibida' => 'Recibida', 'validando' => 'Validando', 'aprobada' => 'Aprobada', 'rechazada' => 'Rechazada'];

    public const REQUIRED_PAGES = ['inicio', 'buscar', 'destino', 'tour', 'carrito', 'checkout', 'blog', 'articulo', 'aventuras', 'contacto', 'legal', 'libro_reclamaciones'];

    public const REQUIRED_LOCALES = ['es', 'en', 'pt'];

    public function __construct(
        private readonly TemplateCatalog $catalog,
        private readonly PlatformSession $session,
        private readonly TenantDatabase $tenants,
        private readonly TenantContext $context,
        private readonly AiCredits $credits,
    ) {}

    public function overview(): array
    {
        $templates = $this->catalog->all();
        $submissions = $this->catalog->db()->table('platform_template_submissions')->get(['status']);
        $assignments = $this->assignments();
        $sales = $this->catalog->db()->table('cms_template_purchases')->where('source', 'compra')->selectRaw('count(*) as total, coalesce(sum(price), 0) as amount')->first();

        return [
            'templates' => $templates->map(fn (stdClass $template): array => [
                ...$this->catalog->present($template),
                'versions' => $this->catalog->versions($template->id)->map($this->catalog->presentVersion(...))->values()->all(),
            ])->values()->all(),
            'assignments' => $assignments,
            'plans' => $this->catalog->plans()->map(fn (stdClass $plan): array => ['code' => $plan->code, 'name' => $plan->name])->all(),
            'kpis' => [
                'published' => $templates->where('status', 'publicado')->count(),
                'total' => $templates->count(),
                'available' => $templates->filter(fn (stdClass $template): bool => $this->catalog->present($template)['available'])->count(),
                'pending_submissions' => $submissions->whereIn('status', ['recibida', 'validando'])->count(),
                'agencies' => count($assignments),
                'agencies_self' => collect($assignments)->where('chosen_by', 'agencia')->count(),
                'premium_sales' => (int) ($sales->total ?? 0),
                'premium_amount' => number_format((float) ($sales->amount ?? 0), 2, '.', ''),
            ],
            'catalog' => ['categories' => TemplateCatalog::CATEGORIES, 'tiers' => TemplateCatalog::TIERS, 'statuses' => TemplateCatalog::STATUSES, 'checks' => self::CHECKS, 'lighthouse_min' => TemplateCatalog::LIGHTHOUSE_MIN, 'sections' => TemplateCatalog::SECTIONS, 'pages' => self::REQUIRED_PAGES, 'site_styles' => SiteDesign::STYLES],
        ];
    }

    public function create(array $data, PlatformUser $actor): array
    {
        $slug = Str::slug((string) $data['slug']);
        $code = 'TPL-'.Str::upper(Str::limit(str_replace('-', '', $slug), 16, ''));
        $db = $this->catalog->db();

        if ($db->table('platform_site_templates')->where('slug', $slug)->orWhere('code', $code)->exists()) {
            throw ApiException::unprocessable('TEMPLATE_EXISTS', 'Ya existe una plantilla con ese identificador.');
        }

        $this->ensurePrice($data);

        $db->transaction(function () use ($db, $code, $slug, $data, $actor): void {
            $db->table('platform_site_templates')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'slug' => $slug,
                ...$this->values($data),
                'author_kind' => $data['author_kind'],
                'author_name' => trim((string) $data['author_name']),
                'repo_url' => $data['repo_url'] ?? null,
                'status' => 'borrador',
            ]);
            $this->session->log(self::ENTITY, $code, 'crear', null, $data['name'].' · '.$data['tier'], $actor);
        });

        return $this->catalog->present($this->catalog->find($code));
    }

    public function update(string $code, array $data, PlatformUser $actor): array
    {
        $template = $this->catalog->find($code);
        $db = $this->catalog->db();
        $merged = [...(array) $template, ...array_intersect_key($data, array_flip(['tier', 'price_once']))];
        $this->ensurePrice($merged);
        $status = $data['status'] ?? null;
        $default = $data['is_default'] ?? null;

        if ($status === 'publicado' && $template->current_version_id === null) {
            throw ApiException::unprocessable('TEMPLATE_VERSION_UNAVAILABLE', 'La plantilla no tiene una versión aprobada: publíquela desde un envío a revisión.');
        }

        if ($status !== null && ! in_array($status, ['publicado', 'retirado'], true)) {
            throw ApiException::unprocessable('TEMPLATE_STATUS', 'Solo se puede publicar o retirar una plantilla desde aquí.');
        }

        $finalStatus = $status ?? $template->status;
        $finalDefault = $default ?? (bool) $template->default_for_new;

        if ($finalDefault && ($finalStatus !== 'publicado' || $merged['tier'] !== 'incluida')) {
            throw ApiException::unprocessable('TEMPLATE_DEFAULT', 'La plantilla por defecto debe estar publicada y ser incluida.');
        }

        if ($default === false && $template->default_for_new) {
            throw ApiException::unprocessable('TEMPLATE_DEFAULT', 'Elija otra plantilla por defecto en lugar de quitar esta.');
        }

        $db->transaction(function () use ($db, $template, $data, $status, $default, $actor): void {
            $values = $this->values([...(array) $template, ...$data, 'price_once' => ($data['tier'] ?? $template->tier) === 'incluida' ? 0 : ($data['price_once'] ?? $template->price_once)]);

            if ($status !== null) {
                $values['status'] = $status;
            }

            if ($default === true && ! $template->default_for_new) {
                $db->table('platform_site_templates')->where('default_for_new', true)->update(['default_for_new' => false]);
                $values['default_for_new'] = true;
            }

            $db->table('platform_site_templates')->where('id', $template->id)->update($values);
            $action = match (true) {
                $status === 'retirado' => 'retirar',
                $status === 'publicado' && $template->status !== 'publicado' => 'publicar',
                $default === true && ! $template->default_for_new => 'por_defecto',
                default => 'editar',
            };
            $this->session->log(self::ENTITY, $template->code, $action, $template->status.' · '.$template->tier.' '.$template->price_once, ($values['status'] ?? $template->status).' · '.$values['tier'].' '.$values['price_once'], $actor);
        });

        return $this->catalog->present($this->catalog->find($code));
    }

    public function submissions(): array
    {
        $rows = $this->catalog->db()->table('platform_template_submissions')->orderByDesc('created_at')->limit(100)->get();
        $templates = $this->catalog->db()->table('platform_site_templates')->whereIn('id', $rows->pluck('template_id')->unique()->all())->get()->keyBy('id');
        $reviewers = $this->catalog->db()->table('platform_users')->whereIn('id', $rows->pluck('reviewer_id')->filter()->unique()->all())->pluck('name', 'id');

        return $rows->map(fn (stdClass $row): array => $this->presentSubmission($row, $templates->get($row->template_id), $reviewers[$row->reviewer_id] ?? null))->values()->all();
    }

    public function submit(array $data, PlatformUser $actor): array
    {
        $template = $this->catalog->find((string) $data['template_code']);
        $db = $this->catalog->db();

        if ($template->status === 'retirado') {
            throw ApiException::unprocessable('TEMPLATE_RETIRED', 'La plantilla está retirada: republíquela antes de enviar versiones.');
        }

        if ($db->table('platform_site_template_versions')->where('template_id', $template->id)->where('version', $data['version'])->exists()) {
            throw ApiException::unprocessable('TEMPLATE_VERSION_EXISTS', 'Esa versión ya fue enviada. Suba el número de versión.');
        }

        $current = $this->catalog->versionById($template->current_version_id);

        if ($current !== null && version_compare((string) $data['version'], (string) $current->version, '<=')) {
            throw ApiException::unprocessable('TEMPLATE_VERSION_EXISTS', 'La versión debe ser mayor que la publicada ('.$current->version.').');
        }

        $manifest = (array) $data['manifest'];
        $lighthouse = array_map('intval', (array) ($data['lighthouse'] ?? []));
        $checks = $this->checks($manifest, $lighthouse, (array) ($data['checks'] ?? []));

        return $db->transaction(function () use ($db, $template, $data, $manifest, $lighthouse, $checks, $actor): array {
            $db->select('select pg_advisory_xact_lock(hashtext(?))', ['platform_template_submissions:code']);
            $last = $db->table('platform_template_submissions')->selectRaw("max(substring(code from '[0-9]+$')::int) as n")->value('n');
            $code = 'TSB-'.str_pad((string) ((int) $last + 1), 4, '0', STR_PAD_LEFT);
            $db->table('platform_site_template_versions')->insert([
                'id' => (string) Str::uuid7(),
                'template_id' => $template->id,
                'version' => $data['version'],
                'manifest' => json_encode($manifest, JSON_UNESCAPED_UNICODE),
                'bundle_path' => $data['bundle_path'],
                'bundle_sha256' => strtolower((string) $data['bundle_sha256']),
                'changelog' => $data['changelog'] ?? null,
                'status' => 'candidata',
                'lh_performance' => $lighthouse['performance'] ?? null,
                'lh_accessibility' => $lighthouse['accessibility'] ?? null,
                'lh_seo' => $lighthouse['seo'] ?? null,
                'lh_best_practices' => $lighthouse['best_practices'] ?? null,
            ]);
            $db->table('platform_template_submissions')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'template_id' => $template->id,
                'version' => $data['version'],
                'submitted_by' => $actor->getKey(),
                'submitted_by_name' => $actor->name,
                'status' => 'validando',
                'checks' => json_encode($checks, JSON_UNESCAPED_UNICODE),
            ]);

            if ($template->status === 'borrador') {
                $db->table('platform_site_templates')->where('id', $template->id)->update(['status' => 'en_revision']);
            }

            $this->session->log(self::ENTITY_SUBMISSION, $code, 'enviar', null, $template->code.' v'.$data['version'], $actor);

            return $this->presentSubmission($db->table('platform_template_submissions')->where('code', $code)->first(), $this->catalog->find($template->code), null);
        });
    }

    public function decide(string $code, array $data, PlatformUser $actor): array
    {
        $db = $this->catalog->db();
        $submission = $db->table('platform_template_submissions')->where('code', $code)->first();

        if ($submission === null) {
            throw ApiException::notFound('Ese envío no existe.');
        }

        if (! in_array($submission->status, ['recibida', 'validando'], true)) {
            throw ApiException::unprocessable('SUBMISSION_DECIDED', 'Este envío ya fue decidido.');
        }

        $template = $this->catalog->byId($submission->template_id);
        $version = $db->table('platform_site_template_versions')->where('template_id', $submission->template_id)->where('version', $submission->version)->first();
        $checks = $this->decode($submission->checks);

        if ($data['decision'] === 'rechazar') {
            $db->transaction(function () use ($db, $submission, $version, $checks, $data, $actor): void {
                $db->table('platform_template_submissions')->where('id', $submission->id)->update(['status' => 'rechazada', 'reject_reason' => trim((string) $data['reason']), 'reviewer_id' => $actor->getKey(), 'decided_at' => now()->utc(), 'checks' => json_encode($checks, JSON_UNESCAPED_UNICODE)]);

                if ($version !== null && $version->status === 'candidata') {
                    $db->table('platform_site_template_versions')->where('id', $version->id)->update(['status' => 'retirada']);
                }

                $this->session->log(self::ENTITY_SUBMISSION, $submission->code, 'rechazar', $submission->status, trim((string) $data['reason']), $actor);
            });

            return $this->presentSubmission($db->table('platform_template_submissions')->where('id', $submission->id)->first(), $template, $actor->name);
        }

        $failing = collect($checks)->except(['lighthouse', 'revision_visual'])->filter(fn (mixed $value): bool => $value !== 'ok')->keys()->map(fn (string $key): string => self::CHECKS[$key] ?? $key)->values()->all();
        $scores = $version !== null ? ['performance' => $version->lh_performance, 'accessibility' => $version->lh_accessibility, 'seo' => $version->lh_seo, 'best_practices' => $version->lh_best_practices] : [];

        if ($version === null || ! $this->catalog->meetsLighthouse(array_filter($scores, fn (mixed $value): bool => $value !== null))) {
            throw ApiException::unprocessable('TEMPLATE_LIGHTHOUSE', 'No se puede aprobar: Lighthouse móvil está por debajo del mínimo (85 rendimiento, 95 accesibilidad, 95 SEO y 90 buenas prácticas).');
        }

        if ($failing !== []) {
            throw ApiException::unprocessable('TEMPLATE_CHECKS', 'Hay validaciones que no pasan: '.implode(', ', $failing).'.', ['failing' => $failing]);
        }

        if (! ($data['visual_review'] ?? false)) {
            throw ApiException::unprocessable('TEMPLATE_VISUAL_REVIEW', 'Confirme la revisión visual a 360, 768 y 1280 px en claro y oscuro antes de publicar.');
        }

        $db->transaction(function () use ($db, $submission, $version, $template, $checks, $actor): void {
            $db->table('platform_site_template_versions')->where('template_id', $template->id)->where('status', 'publicada')->update(['status' => 'retirada']);
            $db->table('platform_site_template_versions')->where('id', $version->id)->update(['status' => 'publicada', 'approved_by' => $actor->getKey(), 'published_at' => now()->utc()]);
            $db->table('platform_site_templates')->where('id', $template->id)->update(['current_version_id' => $version->id, 'status' => 'publicado']);
            $db->table('platform_template_submissions')->where('id', $submission->id)->update(['status' => 'aprobada', 'reviewer_id' => $actor->getKey(), 'decided_at' => now()->utc(), 'checks' => json_encode([...$checks, 'revision_visual' => 'ok'], JSON_UNESCAPED_UNICODE)]);
            $this->session->log(self::ENTITY_SUBMISSION, $submission->code, 'aprobar', $submission->status, 'Publicada '.$template->code.' v'.$version->version, $actor);
        });

        return $this->presentSubmission($db->table('platform_template_submissions')->where('id', $submission->id)->first(), $this->catalog->byId($template->id), $actor->name);
    }

    public function assign(string $tenantRef, array $data, PlatformUser $actor): array
    {
        $tenant = Tenant::on(TemplateCatalog::CONNECTION)->where(fn ($query) => Str::isUuid($tenantRef) ? $query->where('id', $tenantRef) : $query->where('code', $tenantRef))->first();

        if ($tenant === null) {
            throw ApiException::notFound('Esa agencia no existe.');
        }

        $template = $this->catalog->findPublished((string) $data['template_code']);
        $note = isset($data['note']) ? trim((string) $data['note']) ?: null : null;

        try {
            $result = $this->tenants->run((string) $tenant->getKey(), fn (): array => app(SiteThemes::class)->apply($template->code, $data['version'] ?? null, null, 'admin_plataforma', null, 'KipuControl · '.$actor->name, $note));
        } finally {
            $this->context->clear();
        }

        $this->catalog->db()->transaction(fn () => $this->session->log(self::ENTITY, $template->code, 'asignar', $tenant->code, $template->name.' v'.$result['version'].($template->tier === 'premium' ? ' · cortesía' : '').($note ? ' · '.$note : ''), $actor));

        return ['tenant' => ['id' => $tenant->getKey(), 'code' => $tenant->code, 'name' => $tenant->commercial_name], 'theme' => $result];
    }

    public function packs(): array
    {
        return $this->credits->packs(false)->map($this->credits->presentPack(...))->values()->all();
    }

    public function updatePack(string $code, array $data, PlatformUser $actor): array
    {
        $pack = $this->credits->pack($code);
        $values = array_filter([
            'name' => isset($data['name']) ? trim((string) $data['name']) : null,
            'price' => $data['price'] ?? null,
            'credits' => isset($data['credits']) ? (int) $data['credits'] : null,
            'active' => array_key_exists('active', $data) ? (bool) $data['active'] : null,
        ], fn (mixed $value): bool => $value !== null);

        if ($values === []) {
            throw ApiException::unprocessable('AI_PACK_EMPTY', 'Indique qué quiere cambiar del paquete.');
        }

        $db = $this->catalog->db();
        $db->transaction(function () use ($db, $pack, $values, $actor): void {
            $db->table('platform_ai_credit_packs')->where('id', $pack->id)->update($values);
            $this->session->log(self::ENTITY_PACK, $pack->code, array_key_exists('active', $values) && count($values) === 1 ? ($values['active'] ? 'activar' : 'desactivar') : 'editar', $pack->credits.' · '.$pack->currency.' '.$pack->price.($pack->active ? '' : ' · inactivo'), ($values['credits'] ?? $pack->credits).' · '.$pack->currency.' '.($values['price'] ?? $pack->price).(($values['active'] ?? (bool) $pack->active) ? '' : ' · inactivo'), $actor);
        });

        return $this->credits->presentPack($this->credits->pack($code));
    }

    private function assignments(): array
    {
        $db = $this->catalog->db();
        $themes = $db->table('cms_site_themes')->where('status', 'activo')->get()->keyBy('tenant_id');
        $templates = $this->catalog->all()->keyBy('id');
        $default = $this->catalog->defaultTemplate();

        return $db->table('tenants')->orderBy('code')->get(['id', 'code', 'commercial_name', 'legal_name', 'created_at'])->map(function (stdClass $tenant) use ($themes, $templates, $default): array {
            $theme = $themes->get($tenant->id);
            $template = $theme !== null ? $templates->get($theme->template_id) : $default;
            $version = $theme !== null ? $this->catalog->versionById($theme->template_version_id) : $this->catalog->versionById($template?->current_version_id);
            $current = $template !== null ? $this->catalog->versionById($template->current_version_id) : null;

            return [
                'tenant' => ['id' => $tenant->id, 'code' => $tenant->code, 'name' => $tenant->commercial_name ?: $tenant->legal_name],
                'template' => $template !== null ? ['code' => $template->code, 'name' => $template->name, 'tier' => $template->tier] : null,
                'version' => $version?->version,
                'chosen_by' => $theme->chosen_by ?? 'alta',
                'chosen_by_label' => SiteThemes::CHOSEN_BY[$theme->chosen_by ?? 'alta'],
                'applied_at' => ($theme->applied_at ?? $tenant->created_at) !== null ? Carbon::parse($theme->applied_at ?? $tenant->created_at)->toIso8601String() : null,
                'update_available' => $current !== null && $version !== null && $current->id !== $version->id ? $current->version : null,
            ];
        })->all();
    }

    private function checks(array $manifest, array $lighthouse, array $reported): array
    {
        $tokens = (array) ($manifest['tokens'] ?? []);
        $required = ['id', 'name', 'version', 'kipu', 'category', 'tier', 'author', 'tokens', 'sections', 'pages', 'locales'];
        $manifestOk = array_diff($required, array_keys($manifest)) === []
            && array_diff(self::REQUIRED_PAGES, (array) ($manifest['pages'] ?? [])) === []
            && array_diff((array) ($manifest['sections'] ?? []), TemplateCatalog::SECTIONS) === [];
        $accent = (string) ($tokens['accent'] ?? '');
        $contrastOk = preg_match('/^#[0-9a-fA-F]{6}$/', $accent) === 1 && SiteDesign::contrast(strtolower($accent), '#ffffff') >= 4.5;
        $checks = [
            'manifest' => $manifestOk ? 'ok' : 'falla',
            'build' => 'pendiente',
            'lighthouse' => $lighthouse,
            'contraste' => $contrastOk ? 'ok' : 'falla',
            'i18n' => array_diff(self::REQUIRED_LOCALES, (array) ($manifest['locales'] ?? [])) === [] ? 'ok' : 'falla',
            'datos_estructurados' => 'pendiente',
            'seguridad' => 'pendiente',
            'revision_visual' => 'pendiente',
        ];

        foreach (self::REPORTED_CHECKS as $key) {
            if (in_array($reported[$key] ?? null, ['ok', 'falla'], true)) {
                $checks[$key] = $reported[$key];
            }
        }

        return $checks;
    }

    private function presentSubmission(stdClass $row, ?stdClass $template, ?string $reviewer): array
    {
        $checks = $this->decode($row->checks);

        return [
            'code' => $row->code,
            'template' => $template !== null ? ['code' => $template->code, 'name' => $template->name, 'slug' => $template->slug] : null,
            'version' => $row->version,
            'submitted_by' => $row->submitted_by_name,
            'status' => $row->status,
            'status_label' => self::SUBMISSION_STATUSES[$row->status] ?? $row->status,
            'checks' => $checks,
            'lighthouse_ok' => $this->catalog->meetsLighthouse((array) ($checks['lighthouse'] ?? [])),
            'reviewer' => $reviewer,
            'reject_reason' => $row->reject_reason,
            'decided_at' => $row->decided_at ? Carbon::parse($row->decided_at)->toIso8601String() : null,
            'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
        ];
    }

    private function ensurePrice(array $data): void
    {
        if (($data['tier'] ?? 'incluida') === 'premium' && (float) ($data['price_once'] ?? 0) <= 0) {
            throw ApiException::unprocessable('TEMPLATE_PRICE', 'Una plantilla premium necesita un precio mayor que cero.');
        }
    }

    private function values(array $data): array
    {
        $tags = array_values(array_filter(array_map(fn (mixed $tag): string => trim((string) $tag), is_array($data['tags'] ?? null) ? $data['tags'] : $this->tags($data['tags'] ?? null))));

        return [
            'name' => trim((string) $data['name']),
            'description' => trim((string) $data['description']),
            'category' => $data['category'],
            'tier' => $data['tier'],
            'price_once' => $data['tier'] === 'incluida' ? 0 : $data['price_once'],
            'min_plan_code' => ($data['min_plan_code'] ?? null) ?: null,
            'tags' => '{'.implode(',', array_map(fn (string $tag): string => '"'.str_replace('"', '', $tag).'"', $tags)).'}',
        ];
    }

    private function tags(mixed $value): array
    {
        $inner = trim((string) $value, '{}');

        return $inner === '' ? [] : array_map(fn (string $tag): string => trim($tag, '"'), str_getcsv($inner, ',', '"', '\\'));
    }

    private function decode(mixed $value): array
    {
        return is_string($value) ? (json_decode($value, true) ?: []) : (array) $value;
    }
}
