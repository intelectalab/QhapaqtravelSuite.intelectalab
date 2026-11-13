<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use App\Domain\Tracking\Actions\TrackingTagWorkflow;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

final class SiteTags
{
    public const POLICY_VERSION = 'COOK-2026.2';

    public const CATEGORIES = [
        ['code' => 'necesarias', 'label' => 'Necesarias', 'description' => 'Carrito, sesión, idioma y seguridad. Siempre activas.', 'required' => true],
        ['code' => 'analiticas', 'label' => 'Analíticas', 'description' => 'Nos ayudan a entender qué páginas sirven (Google Analytics, Clarity).', 'required' => false],
        ['code' => 'marketing', 'label' => 'Marketing', 'description' => 'Miden campañas y muestran anuncios relevantes (Google Ads, Meta, TikTok).', 'required' => false],
    ];

    private const SAFE_CONFIG = ['enhanced_conversions', 'send_page_view', 'debug_mode', 'ads_data_redaction', 'url_passthrough'];

    public function for(TagScope $scope, ?string $tenantId, string $path, ?string $site): array
    {
        $tags = Cache::remember(TrackingTagWorkflow::cacheKey($scope, $tenantId), 60, fn () => $scope->db()->table($scope->tags)
            ->whereNull('deleted_at')->where('status', 'activo')
            ->get(['code', 'provider', 'name', 'measurement_id', 'consent_category', 'placement', 'page_rules', 'config', 'script_src', 'sri_hash', 'script_body', 'csp_domains', 'starts_at', 'ends_at', ...($scope->isPlatform() ? ['site'] : [])])
            ->map(fn (object $tag) => [...(array) $tag, 'site' => $tag->site ?? null])->all());
        $checkout = TrackingCatalog::isCheckout($path);
        $now = now();

        $active = collect($tags)
            ->filter(fn (array $tag) => ! $scope->isPlatform() || $site === null || in_array($tag['site'], [$site, 'ambos'], true))
            ->filter(fn (array $tag) => ($tag['starts_at'] === null || Carbon::parse($tag['starts_at'])->lessThanOrEqualTo($now)) && ($tag['ends_at'] === null || Carbon::parse($tag['ends_at'])->greaterThan($now)))
            ->filter(fn (array $tag) => ! $checkout || ($tag['provider'] !== 'script' && $tag['consent_category'] === 'necesarias'))
            ->filter(fn (array $tag) => TrackingCatalog::matchesRules((array) json_decode((string) $tag['page_rules'], true), $path))
            ->map(function (array $tag): array {
                $config = (array) json_decode((string) $tag['config'], true);
                $domains = $tag['provider'] === 'script' ? TagInput::currentDomains((object) $tag) : TrackingCatalog::provider($tag['provider'])['domains'];

                return [
                    'code' => $tag['code'],
                    'provider' => $tag['provider'],
                    'name' => $tag['name'],
                    'measurement_id' => $tag['measurement_id'],
                    'consent_category' => $tag['consent_category'],
                    'placement' => $tag['placement'],
                    'config' => array_intersect_key($config, array_flip(self::SAFE_CONFIG)),
                    'script_src' => $tag['script_src'],
                    'integrity' => $tag['sri_hash'],
                    'script_body' => $tag['script_body'],
                    'csp_domains' => $domains,
                ];
            })->values();

        return [
            'policy_version' => self::POLICY_VERSION,
            'categories' => self::CATEGORIES,
            'consent_defaults' => ['ad_storage' => 'denied', 'analytics_storage' => 'denied', 'ad_user_data' => 'denied', 'ad_personalization' => 'denied', 'wait_for_update' => 500],
            'checkout' => $checkout,
            'tags' => $active->all(),
            'csp_domains' => $active->pluck('csp_domains')->flatten()->unique()->values()->all(),
            'cache_seconds' => 60,
        ];
    }
}
