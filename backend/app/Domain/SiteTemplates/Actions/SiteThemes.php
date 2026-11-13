<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Actions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\SiteDesignStudio;
use App\Domain\SiteTemplates\Support\TemplateCatalog;
use App\Domain\SiteTemplates\Support\ThemeTokens;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class SiteThemes
{
    public const AUDIT = 'Plantilla del sitio';

    public const PREVIEW_HOURS = 24;

    public const CHOSEN_BY = ['alta' => 'Elegida al contratar', 'agencia' => 'Elegida por su equipo', 'admin_plataforma' => 'Asignada por KipuControl'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly TemplateCatalog $catalog,
        private readonly SiteDesignStudio $studio,
        private readonly AuditLogger $audit,
    ) {}

    public function overview(): array
    {
        $active = $this->activeRow();
        $template = $active !== null ? $this->catalog->byId($active->template_id) : $this->catalog->defaultTemplate();
        $version = $active !== null ? $this->catalog->versionById($active->template_version_id) : ($template !== null ? $this->catalog->versionById($template->current_version_id) : null);
        $current = $template !== null ? $this->catalog->versionById($template->current_version_id) : null;
        $design = $this->studio->publishedDesign();

        return [
            'active' => $template !== null ? [
                'id' => $active?->id,
                'template' => $this->catalog->present($template, $version),
                'version' => $version?->version,
                'chosen_by' => $active->chosen_by ?? 'alta',
                'chosen_by_label' => self::CHOSEN_BY[$active->chosen_by ?? 'alta'],
                'applied_at' => $this->iso($active->applied_at ?? $this->context->tenant()->created_at),
                'applied_by' => $active !== null ? $this->userName($active->applied_by) : null,
                'update_available' => $current !== null && $version !== null && $current->id !== $version->id && $current->status === 'publicada' ? $current->version : null,
            ] : null,
            'lock_version' => (int) ($active->lock_version ?? 0),
            'subdomain' => (string) $this->context->tenant()->subdomain,
            'tokens' => ThemeTokens::fromDesign($design),
            'site_style' => $design['theme']['style'],
            'history' => $this->history($template),
            'purchased' => $this->purchasedCodes(),
            'plan' => $this->plan(),
            'catalog' => ['categories' => TemplateCatalog::CATEGORIES, 'corner_px' => ThemeTokens::CORNER_PX, 'min_contrast' => ThemeTokens::MIN_CONTRAST, 'radius_max' => ThemeTokens::RADIUS_MAX],
        ];
    }

    public function gallery(): array
    {
        $purchased = $this->purchasedCodes();
        $plan = $this->plan();
        $active = $this->activeRow();
        $activeId = $active->template_id ?? $this->catalog->defaultTemplate()?->id;

        return $this->catalog->published()->map(fn (stdClass $template): array => [
            ...$this->catalog->present($template),
            'purchased' => $template->tier === 'incluida' || in_array($template->code, $purchased, true),
            'plan_allowed' => $this->catalog->planAllows($template, $plan),
            'is_active' => $template->id === $activeId,
        ])->values()->all();
    }

    public function detail(string $code): array
    {
        $template = $this->catalog->findPublished($code);

        return [
            ...$this->catalog->present($template),
            'purchased' => $template->tier === 'incluida' || in_array($template->code, $this->purchasedCodes(), true),
            'plan_allowed' => $this->catalog->planAllows($template, $this->plan()),
            'versions' => $this->catalog->versions($template->id)->filter(fn (stdClass $version): bool => in_array($version->status, ['publicada', 'retirada'], true))->map($this->catalog->presentVersion(...))->values()->all(),
        ];
    }

    public function preview(string $code, ?string $userId): array
    {
        $template = $this->catalog->findPublished($code);
        $version = $this->catalog->publishedVersion($template);
        $this->ensureStyle($template, $version);
        $token = Str::random(48);
        $design = $this->studio->publishedDesign();

        DB::transaction(function () use ($template, $version, $token, $design, $userId): void {
            DB::table('cms_site_themes')->where('status', 'vista_previa')->where('created_at', '<', now()->subHours(self::PREVIEW_HOURS))->delete();
            DB::table('cms_site_themes')->insert([
                'id' => (string) Str::uuid7(),
                'template_id' => $template->id,
                'template_version_id' => $version->id,
                'status' => 'vista_previa',
                'tokens' => json_encode(ThemeTokens::fromDesign($design), JSON_UNESCAPED_UNICODE),
                'sections' => json_encode($design['sections']),
                'chosen_by' => 'agencia',
                'applied_by' => $userId,
                'preview_token' => $token,
            ]);
            $this->audit->log(self::AUDIT, $template->code, 'vista previa', null, $template->name.' v'.$version->version);
        });

        $subdomain = (string) $this->context->tenant()->subdomain;

        return [
            'token' => $token,
            'template' => $template->code,
            'expires_at' => now()->addHours(self::PREVIEW_HOURS)->toIso8601String(),
            'url' => 'https://'.$subdomain.'.'.config('sites.domain').'/?preview='.$token,
            'site_path' => '/sitio/'.$subdomain.'?preview='.$token,
        ];
    }

    public function purchase(string $code, string $userId, string $byName): array
    {
        $template = $this->catalog->findPublished($code);
        $version = $this->catalog->publishedVersion($template);

        if ($template->tier !== 'premium') {
            throw ApiException::unprocessable('TEMPLATE_NOT_PREMIUM', 'Esta plantilla está incluida en su plan: no necesita comprarla.');
        }

        $this->ensureStyle($template, $version);
        $this->ensurePlan($template);

        if (in_array($template->code, $this->purchasedCodes(), true)) {
            throw ApiException::conflict('TEMPLATE_ALREADY_PURCHASED', 'Su cuenta ya tiene esta plantilla.');
        }

        DB::transaction(function () use ($template, $userId, $byName): void {
            DB::table('cms_template_purchases')->insert(['id' => (string) Str::uuid7(), 'template_id' => $template->id, 'source' => 'compra', 'price' => $template->price_once, 'currency' => $template->currency, 'purchased_by' => $userId, 'purchased_by_name' => $byName]);
            $this->audit->log(self::AUDIT, $template->code, 'comprar', null, $template->currency.' '.number_format((float) $template->price_once, 2, '.', ''));
        });

        return ['template' => $template->code, 'price' => number_format((float) $template->price_once, 2, '.', ''), 'currency' => $template->currency, 'purchased' => true];
    }

    public function apply(string $code, ?string $versionNumber, ?int $expected, string $chosenBy, ?string $userId, string $byName, ?string $note = null): array
    {
        $template = $this->catalog->findPublished($code);
        $version = $this->catalog->publishedVersion($template, $versionNumber);
        $style = $this->ensureStyle($template, $version);

        if ($chosenBy === 'admin_plataforma') {
            $this->grantCourtesy($template, $byName);
        } else {
            $this->ensurePlan($template);

            if ($template->tier === 'premium' && ! in_array($template->code, $this->purchasedCodes(), true)) {
                throw ApiException::unprocessable('TEMPLATE_PURCHASE_REQUIRED', 'Esta plantilla es premium: cómprela antes de aplicarla.');
            }
        }

        return DB::transaction(function () use ($template, $version, $style, $expected, $chosenBy, $userId, $byName, $note): array {
            $active = $this->lockedActive();

            if ($expected !== null && $active !== null) {
                IfMatch::assertMatches($expected, (int) $active->lock_version, 'La plantilla del sitio');
            }

            if ($active !== null && $active->template_id === $template->id && $active->template_version_id === $version->id) {
                throw ApiException::unprocessable('THEME_ALREADY_ACTIVE', 'Esa plantilla ya está activa en su sitio.');
            }

            $previous = $active !== null ? $this->catalog->byId($active->template_id) : $this->catalog->defaultTemplate();
            $this->retire($active, $template);
            $design = $this->studio->applyTemplate(['theme' => ['style' => $style]], trim('Plantilla '.$template->name.' v'.$version->version.' aplicada'.($note ? ' · '.$note : '')), $userId, $byName);
            $id = $this->insertActive($template->id, $version->id, $design, $chosenBy, $userId);
            $this->countInstall($previous?->id, $template->id);
            $this->audit->log(self::AUDIT, $template->code, $active !== null && $active->template_id === $template->id ? 'actualizar' : 'aplicar', $previous?->name, $template->name.' v'.$version->version.($note ? ' · '.$note : ''));

            return ['id' => $id, 'template' => $template->code, 'version' => $version->version, 'site_style' => $style, 'lock_version' => 1];
        });
    }

    public function updateTokens(array $tokens, int $expected, string $userId, string $byName): array
    {
        ThemeTokens::ensureContrast($tokens);

        return DB::transaction(function () use ($tokens, $expected, $userId, $byName): array {
            $active = $this->lockedActive() ?? $this->materializeDefault();
            IfMatch::assertMatches($expected, (int) $active->lock_version, 'La plantilla del sitio');
            $template = $this->catalog->byId($active->template_id);
            $style = $this->catalog->siteStyle($this->catalog->versionById($active->template_version_id)) ?? 'actual';
            $before = ThemeTokens::fromDesign($this->studio->publishedDesign());
            $changes = ThemeTokens::toChanges($tokens);
            $changes['theme']['style'] = $style;
            $design = $this->studio->applyTemplate($changes, 'Personalización de la plantilla '.($template->name ?? ''), $userId, $byName);
            $after = ThemeTokens::fromDesign($design);
            DB::table('cms_site_themes')->where('id', $active->id)->update(['tokens' => json_encode($after, JSON_UNESCAPED_UNICODE), 'sections' => json_encode($design['sections']), 'lock_version' => (int) $active->lock_version + 1]);
            $this->audit->log(self::AUDIT, (string) ($template->code ?? $active->id), 'personalizar', $this->describe($before), $this->describe($after), $this->diff($before, $after));

            return ['tokens' => $after, 'lock_version' => (int) $active->lock_version + 1];
        });
    }

    public function restore(string $id, string $userId, string $byName): array
    {
        $row = Str::isUuid($id) ? DB::table('cms_site_themes')->where('id', $id)->first() : null;

        if ($row === null || $row->status === 'vista_previa') {
            throw ApiException::notFound('Esa plantilla no está en el historial.');
        }

        if ($row->status === 'activo') {
            throw ApiException::unprocessable('THEME_ALREADY_ACTIVE', 'Esa plantilla ya está activa en su sitio.');
        }

        $template = $this->catalog->byId($row->template_id);

        if ($template === null || $template->status !== 'publicado') {
            throw ApiException::unprocessable('TEMPLATE_RETIRED', 'Esa plantilla ya no está en la galería y no se puede restaurar.');
        }

        $version = $this->catalog->versionById($row->template_version_id);
        $style = $this->ensureStyle($template, $version);
        $this->ensurePlan($template);

        if ($template->tier === 'premium' && ! in_array($template->code, $this->purchasedCodes(), true)) {
            throw ApiException::unprocessable('TEMPLATE_PURCHASE_REQUIRED', 'Esta plantilla es premium: cómprela antes de restaurarla.');
        }

        return DB::transaction(function () use ($row, $template, $version, $style, $userId, $byName): array {
            $active = $this->lockedActive();
            $previous = $active !== null ? $this->catalog->byId($active->template_id) : $this->catalog->defaultTemplate();
            $this->retire($active, $template);
            $changes = ThemeTokens::toChanges($this->decode($row->tokens));
            $changes['theme']['style'] = $style;
            $this->studio->applyTemplate($changes, 'Plantilla '.$template->name.' v'.$version?->version.' restaurada', $userId, $byName);
            DB::table('cms_site_themes')->where('id', $row->id)->update(['status' => 'activo', 'applied_at' => now()->utc(), 'applied_by' => $userId, 'chosen_by' => 'agencia', 'lock_version' => (int) $row->lock_version + 1]);
            $this->countInstall($previous?->id, $template->id);
            $this->audit->log(self::AUDIT, $template->code, 'restaurar', $previous?->name, $template->name.' v'.$version?->version);

            return ['id' => $row->id, 'template' => $template->code, 'version' => $version?->version, 'site_style' => $style];
        });
    }

    public function publicTheme(?string $token): array
    {
        $preview = $token !== null && $token !== '' ? DB::table('cms_site_themes')->where('status', 'vista_previa')->where('preview_token', $token)->where('created_at', '>=', now()->subHours(self::PREVIEW_HOURS))->first() : null;
        $row = $preview ?? $this->activeRow();
        $template = $row !== null ? $this->catalog->byId($row->template_id) : $this->catalog->defaultTemplate();
        $version = $row !== null ? $this->catalog->versionById($row->template_version_id) : ($template !== null ? $this->catalog->versionById($template->current_version_id) : null);
        $design = $this->studio->publishedDesign();

        return [
            'template' => $template !== null ? ['code' => $template->code, 'slug' => $template->slug, 'name' => $template->name] : null,
            'version' => $version?->version,
            'site_style' => $preview !== null ? $this->catalog->siteStyle($version) : $design['theme']['style'],
            'tokens' => ThemeTokens::fromDesign($design),
            'preview' => $preview !== null,
            'noindex' => $preview !== null,
            'expires_at' => $preview !== null ? Carbon::parse($preview->created_at)->addHours(self::PREVIEW_HOURS)->toIso8601String() : null,
        ];
    }

    private function ensureStyle(stdClass $template, ?stdClass $version): string
    {
        $style = $this->catalog->siteStyle($version);

        if ($style === null) {
            throw ApiException::unprocessable('TEMPLATE_COMING_SOON', $template->name.' llegará pronto: todavía no se puede ver ni aplicar en su sitio.');
        }

        return $style;
    }

    private function ensurePlan(stdClass $template): void
    {
        if (! $this->catalog->planAllows($template, $this->plan())) {
            $required = $this->catalog->plans()->firstWhere('code', $template->min_plan_code);

            throw ApiException::unprocessable('TEMPLATE_PLAN_REQUIRED', $template->name.' está disponible desde el plan '.($required->name ?? $template->min_plan_code).'.', ['min_plan' => $template->min_plan_code]);
        }
    }

    private function grantCourtesy(stdClass $template, string $byName): void
    {
        if ($template->tier !== 'premium' || in_array($template->code, $this->purchasedCodes(), true)) {
            return;
        }

        DB::table('cms_template_purchases')->insert(['id' => (string) Str::uuid7(), 'template_id' => $template->id, 'source' => 'cortesia', 'price' => 0, 'currency' => $template->currency, 'purchased_by' => null, 'purchased_by_name' => $byName]);
    }

    private function retire(?stdClass $active, stdClass $next): void
    {
        if ($active !== null) {
            DB::table('cms_site_themes')->where('id', $active->id)->update(['status' => 'anterior', 'lock_version' => (int) $active->lock_version + 1]);

            return;
        }

        $default = $this->catalog->defaultTemplate();

        if ($default !== null && $default->id !== $next->id && $default->current_version_id !== null) {
            DB::table('cms_site_themes')->insert(['id' => (string) Str::uuid7(), 'template_id' => $default->id, 'template_version_id' => $default->current_version_id, 'status' => 'anterior', 'tokens' => json_encode(ThemeTokens::fromDesign($this->studio->publishedDesign()), JSON_UNESCAPED_UNICODE), 'sections' => '[]', 'chosen_by' => 'alta', 'applied_at' => $this->context->tenant()->created_at]);
        }
    }

    private function materializeDefault(): stdClass
    {
        $default = $this->catalog->defaultTemplate();

        if ($default === null || $default->current_version_id === null) {
            throw ApiException::unprocessable('TEMPLATE_VERSION_UNAVAILABLE', 'Todavía no hay una plantilla por defecto publicada.');
        }

        $id = (string) Str::uuid7();
        DB::table('cms_site_themes')->insert(['id' => $id, 'template_id' => $default->id, 'template_version_id' => $default->current_version_id, 'status' => 'activo', 'tokens' => '{}', 'sections' => '[]', 'chosen_by' => 'alta', 'applied_at' => $this->context->tenant()->created_at, 'lock_version' => 0]);

        return DB::table('cms_site_themes')->where('id', $id)->first();
    }

    private function insertActive(string $templateId, string $versionId, array $design, string $chosenBy, ?string $userId): string
    {
        $id = (string) Str::uuid7();
        DB::table('cms_site_themes')->where('status', 'vista_previa')->where('template_id', $templateId)->delete();
        DB::table('cms_site_themes')->insert([
            'id' => $id,
            'template_id' => $templateId,
            'template_version_id' => $versionId,
            'status' => 'activo',
            'tokens' => json_encode(ThemeTokens::fromDesign($design), JSON_UNESCAPED_UNICODE),
            'sections' => json_encode($design['sections']),
            'chosen_by' => $chosenBy,
            'applied_by' => $userId,
            'applied_at' => now()->utc(),
            'lock_version' => 1,
        ]);

        return $id;
    }

    private function countInstall(?string $from, string $to): void
    {
        if ($from === $to) {
            return;
        }

        $db = $this->catalog->db();

        if ($from !== null) {
            $db->table('platform_site_templates')->where('id', $from)->where('installs', '>', 0)->decrement('installs');
        }

        $db->table('platform_site_templates')->where('id', $to)->increment('installs');
    }

    private function history(?stdClass $activeTemplate): array
    {
        return DB::table('cms_site_themes')->where('status', 'anterior')->orderByDesc('applied_at')->limit(12)->get()
            ->map(function (stdClass $row) use ($activeTemplate): array {
                $template = $this->catalog->byId($row->template_id);
                $version = $this->catalog->versionById($row->template_version_id);

                return [
                    'id' => $row->id,
                    'template' => $template !== null ? ['code' => $template->code, 'name' => $template->name, 'status' => $template->status] : null,
                    'version' => $version?->version,
                    'chosen_by' => $row->chosen_by,
                    'chosen_by_label' => self::CHOSEN_BY[$row->chosen_by] ?? $row->chosen_by,
                    'applied_at' => $this->iso($row->applied_at),
                    'applied_by' => $this->userName($row->applied_by),
                    'until' => $this->iso($row->updated_at),
                    'can_restore' => $template !== null && $template->status === 'publicado' && $this->catalog->siteStyle($version) !== null && $template->id !== $activeTemplate?->id,
                ];
            })->all();
    }

    private function purchasedCodes(): array
    {
        $ids = DB::table('cms_template_purchases')->pluck('template_id')->all();

        return $ids === [] ? [] : $this->catalog->db()->table('platform_site_templates')->whereIn('id', $ids)->pluck('code')->all();
    }

    private function plan(): ?array
    {
        $plan = $this->catalog->tenantPlan((string) $this->context->id());

        return $plan !== null ? ['code' => $plan->code, 'name' => $plan->name, 'rank' => (int) $plan->rank] : null;
    }

    private function activeRow(): ?stdClass
    {
        return DB::table('cms_site_themes')->where('status', 'activo')->first();
    }

    private function lockedActive(): ?stdClass
    {
        return DB::table('cms_site_themes')->where('status', 'activo')->lock('for no key update')->first();
    }

    private function userName(?string $id): ?string
    {
        return $id !== null ? DB::table('iam_users')->where('id', $id)->value('name') : null;
    }

    private function describe(array $tokens): string
    {
        return 'Marca '.$tokens['side'].' · botones '.$tokens['accent'].' · acento '.$tokens['sun'].' · redondeo '.$tokens['radius'].' px';
    }

    private function diff(array $before, array $after): array
    {
        $diff = [];

        foreach ($after as $key => $value) {
            if (json_encode($before[$key] ?? null) !== json_encode($value)) {
                $diff[$key] = ['antes' => $before[$key] ?? null, 'despues' => $value];
            }
        }

        return $diff;
    }

    private function decode(mixed $value): array
    {
        return is_string($value) ? (json_decode($value, true) ?: []) : (array) $value;
    }

    private function iso(mixed $value): ?string
    {
        return $value !== null ? Carbon::parse($value)->toIso8601String() : null;
    }
}
