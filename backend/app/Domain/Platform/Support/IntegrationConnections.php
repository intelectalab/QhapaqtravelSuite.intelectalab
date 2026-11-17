<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

final class IntegrationConnections
{
    public const SECTIONS = [
        'whatsapp' => 'WhatsApp',
        'app-movil' => 'App móvil',
        'tipo-de-cambio' => 'Tipo de cambio',
        'facturacion-electronica' => 'Facturación electrónica',
        'correo-de-salida' => 'Correo de salida',
        'proteccion-de-formularios' => 'Protección de formularios',
        'antivirus' => 'Antivirus',
        'blog-de-la-vitrina' => 'Blog de la vitrina',
    ];

    private const KINDS = ['fiscal' => 'facturacion-electronica', 'email' => 'correo-de-salida', 'messaging' => 'whatsapp'];

    private const PATTERNS = [
        '/whatsapp/iu' => 'whatsapp',
        '/^(correo|email)\b|correo transaccional|smtp/iu' => 'correo-de-salida',
        '/^push\b|app m[oó]vil|expo/iu' => 'app-movil',
        '/tipo de cambio|\bfx\b|\bsbs\b/iu' => 'tipo-de-cambio',
        '/sunat|\bose\b|comprobante|facturaci[oó]n electr[oó]nica/iu' => 'facturacion-electronica',
        '/antivirus|clamav/iu' => 'antivirus',
        '/turnstile|captcha/iu' => 'proteccion-de-formularios',
        '/payload/iu' => 'blog-de-la-vitrina',
    ];

    public static function for(string $target, ?string $adapterKind = null): ?string
    {
        if ($adapterKind !== null && isset(self::KINDS[$adapterKind])) {
            return self::KINDS[$adapterKind];
        }

        foreach (self::PATTERNS as $pattern => $section) {
            if (preg_match($pattern, $target) === 1) {
                return $section;
            }
        }

        return null;
    }
}
