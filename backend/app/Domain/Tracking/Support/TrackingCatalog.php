<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

final class TrackingCatalog
{
    public const PROVIDERS = [
        'ga4' => ['name' => 'Google Analytics 4', 'short' => 'GA4', 'id_label' => 'ID de medición', 'placeholder' => 'G-XXXXXXXXXX', 'pattern' => '/^G-[A-Z0-9]{6,12}$/', 'consent' => 'analiticas', 'server' => 'Measurement Protocol', 'min_rank' => 1, 'domains' => ['www.googletagmanager.com', 'www.google-analytics.com']],
        'gtm' => ['name' => 'Google Tag Manager', 'short' => 'GTM', 'id_label' => 'ID del contenedor', 'placeholder' => 'GTM-XXXXXXX', 'pattern' => '/^GTM-[A-Z0-9]{4,10}$/', 'consent' => 'analiticas', 'server' => null, 'min_rank' => 1, 'domains' => ['www.googletagmanager.com']],
        'google_ads' => ['name' => 'Google Ads', 'short' => 'Ads', 'id_label' => 'ID de conversión', 'placeholder' => 'AW-123456789', 'pattern' => '/^AW-[0-9]{6,12}$/', 'consent' => 'marketing', 'server' => 'Google Ads API', 'min_rank' => 2, 'domains' => ['www.googletagmanager.com', 'googleads.g.doubleclick.net']],
        'meta_pixel' => ['name' => 'Meta Pixel', 'short' => 'Meta', 'id_label' => 'ID del píxel', 'placeholder' => '123456789012345', 'pattern' => '/^[0-9]{10,20}$/', 'consent' => 'marketing', 'server' => 'Conversions API', 'min_rank' => 1, 'domains' => ['connect.facebook.net', 'www.facebook.com']],
        'tiktok' => ['name' => 'TikTok Pixel', 'short' => 'TikTok', 'id_label' => 'ID del píxel', 'placeholder' => 'CXXXXXXXXXXXX', 'pattern' => '/^[A-Za-z0-9_-]{4,40}$/', 'consent' => 'marketing', 'server' => 'Events API', 'min_rank' => 2, 'domains' => ['analytics.tiktok.com']],
        'clarity' => ['name' => 'Microsoft Clarity', 'short' => 'Clarity', 'id_label' => 'ID del proyecto', 'placeholder' => 'abcd1234ef', 'pattern' => '/^[A-Za-z0-9_-]{4,40}$/', 'consent' => 'analiticas', 'server' => null, 'min_rank' => 2, 'domains' => ['www.clarity.ms']],
        'linkedin' => ['name' => 'LinkedIn Insight Tag', 'short' => 'LinkedIn', 'id_label' => 'Partner ID', 'placeholder' => '1234567', 'pattern' => '/^[A-Za-z0-9_-]{4,40}$/', 'consent' => 'marketing', 'server' => null, 'min_rank' => 2, 'domains' => ['snap.licdn.com', 'px.ads.linkedin.com']],
        'script' => ['name' => 'Script propio', 'short' => 'Script', 'id_label' => null, 'placeholder' => null, 'pattern' => null, 'consent' => 'marketing', 'server' => null, 'min_rank' => 2, 'domains' => []],
    ];

    public const CONSENT = ['necesarias' => 'Necesarias', 'analiticas' => 'Analíticas', 'marketing' => 'Marketing'];

    public const PLACEMENTS = ['head' => 'Head', 'body_inicio' => 'Inicio del body', 'body_fin' => 'Final del body'];

    public const STATUSES = ['borrador' => 'Borrador', 'en_revision' => 'En revisión', 'activo' => 'Activa', 'pausado' => 'Pausada', 'rechazado' => 'Rechazada'];

    public const DISPATCH_STATUSES = ['pendiente' => 'Pendiente', 'enviado' => 'Enviado', 'fallido' => 'Fallido', 'sin_consentimiento' => 'Sin consentimiento', 'duplicado' => 'Deduplicado'];

    public const TENANT_EVENTS = [
        'compra' => ['label' => 'Compra confirmada', 'ga4' => 'purchase', 'value' => true],
        'compra_pendiente' => ['label' => 'Compra pendiente (Yape o transferencia)', 'ga4' => 'purchase_pending', 'value' => true],
        'inicio_pago' => ['label' => 'Inicio de pago', 'ga4' => 'begin_checkout', 'value' => true],
        'lead_cotizacion' => ['label' => 'Pedido de viaje a medida', 'ga4' => 'generate_lead', 'value' => false],
        'lead_contacto' => ['label' => 'Formulario de contacto', 'ga4' => 'generate_lead', 'value' => false],
        'chat_web' => ['label' => 'Chat web iniciado', 'ga4' => 'generate_lead', 'value' => false],
        'registro_cliente' => ['label' => 'Cuenta de cliente creada', 'ga4' => 'sign_up', 'value' => false],
        'suscripcion_boletin' => ['label' => 'Suscripción al boletín', 'ga4' => 'sign_up_newsletter', 'value' => false],
        'clic_whatsapp' => ['label' => 'Clic en WhatsApp', 'ga4' => 'contact_whatsapp', 'value' => false],
        'reserva_vitrina' => ['label' => 'Reserva desde la vitrina', 'ga4' => 'purchase_showcase', 'value' => true],
    ];

    public const PLATFORM_EVENTS = [
        'reserva_vitrina' => ['label' => 'Reserva en la vitrina', 'ga4' => 'purchase_showcase', 'value' => true],
        'registro_agencia' => ['label' => 'Registro de agencia', 'ga4' => 'sign_up', 'value' => false],
        'pase_iniciado' => ['label' => 'Pase de 30 días iniciado', 'ga4' => 'begin_trial', 'value' => false],
        'plan_pagado' => ['label' => 'Plan pagado', 'ga4' => 'purchase', 'value' => true],
        'addon_comprado' => ['label' => 'Add-on comprado', 'ga4' => 'purchase_addon', 'value' => true],
        'suscripcion_boletin' => ['label' => 'Suscripción al boletín', 'ga4' => 'sign_up_newsletter', 'value' => false],
        'lectura_articulo' => ['label' => 'Lectura completa de artículo', 'ga4' => 'article_read', 'value' => false],
        'clic_whatsapp' => ['label' => 'Clic en WhatsApp', 'ga4' => 'contact_whatsapp', 'value' => false],
    ];

    public const PLATFORM_SITES = ['vitrina' => 'Vitrina', 'blog' => 'Blog', 'ambos' => 'Vitrina y blog'];

    public const CHECKOUT_PATHS = ['/checkout', '/pagar', '/suscribirse'];

    private const META_EVENTS = ['compra' => 'Purchase', 'compra_pendiente' => 'AddPaymentInfo', 'inicio_pago' => 'InitiateCheckout', 'registro_cliente' => 'CompleteRegistration', 'registro_agencia' => 'CompleteRegistration', 'suscripcion_boletin' => 'Subscribe', 'clic_whatsapp' => 'Contact', 'plan_pagado' => 'Purchase', 'reserva_vitrina' => 'Schedule'];

    private const TIKTOK_EVENTS = ['compra' => 'CompletePayment', 'plan_pagado' => 'CompletePayment', 'inicio_pago' => 'InitiateCheckout'];

    public static function provider(string $code): array
    {
        return self::PROVIDERS[$code] ?? self::PROVIDERS['script'];
    }

    public static function idIsValid(string $provider, ?string $measurementId): bool
    {
        $pattern = self::PROVIDERS[$provider]['pattern'] ?? null;

        return $pattern === null ? $measurementId === null : $measurementId !== null && preg_match($pattern, $measurementId) === 1;
    }

    public static function defaultProviderEvent(string $provider, string $event, array $events): string
    {
        return match ($provider) {
            'meta_pixel' => self::META_EVENTS[$event] ?? 'Lead',
            'google_ads', 'linkedin' => 'conversion',
            'tiktok' => self::TIKTOK_EVENTS[$event] ?? 'SubmitForm',
            default => $events[$event]['ga4'] ?? $event,
        };
    }

    public static function supportsServer(string $provider): bool
    {
        return self::provider($provider)['server'] !== null;
    }

    public static function isCheckout(string $path): bool
    {
        foreach (self::CHECKOUT_PATHS as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }

    public static function matchesRules(array $rules, string $path): bool
    {
        $match = fn (string $pattern): bool => $pattern === '/*' || $pattern === $path || (str_ends_with($pattern, '/*') && str_starts_with($path, substr($pattern, 0, -1))) || (str_ends_with($pattern, '/*') && $path === substr($pattern, 0, -2));
        $include = array_values(array_filter((array) ($rules['include'] ?? ['/*']), 'is_string'));
        $exclude = array_values(array_filter((array) ($rules['exclude'] ?? []), 'is_string'));

        return collect($include)->contains($match) && ! collect($exclude)->contains($match);
    }

    public static function rules(?string $pages, ?string $exclude): array
    {
        $split = fn (?string $value): array => collect(explode(',', (string) $value))->map(fn (string $item) => trim($item))->filter(fn (string $item) => $item !== '' && str_starts_with($item, '/'))->unique()->values()->all();
        $include = $split($pages);

        return ['include' => $include === [] ? ['/*'] : $include, 'exclude' => $split($exclude)];
    }

    public static function forbiddenCode(string $body): ?string
    {
        return match (true) {
            preg_match('/\beval\s*\(/i', $body) === 1 => 'eval',
            preg_match('/document\s*\.\s*write/i', $body) === 1 => 'document.write',
            preg_match('/new\s+Function\s*\(/i', $body) === 1 => 'new Function',
            preg_match('/(card|cvv|cvc|tarjeta|card_number|cc-number)/i', $body) === 1 => 'lectura de datos de pago',
            default => null,
        };
    }
}
