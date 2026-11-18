<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

final class IntegrationCatalog
{
    public const AGENCY = [
        'email' => [
            'label' => 'Correo de salida',
            'description' => 'Cotizaciones, vouchers y avisos a tus clientes salen desde tu propio correo.',
            'missing' => 'Conecta tu correo para enviar.',
            'href' => '/admin/integraciones?conectar=correo',
            'cta' => 'Conectar correo',
            'driver' => null,
        ],
        'whatsapp' => [
            'label' => 'Número de WhatsApp',
            'description' => 'Conversaciones, recordatorios de pago y plantillas desde tu número de empresa.',
            'missing' => 'Conecta tu número de WhatsApp para enviar.',
            'href' => '/admin/whatsapp',
            'cta' => 'Conectar WhatsApp',
            'driver' => 'whatsapp',
        ],
        'ose' => [
            'label' => 'Facturación electrónica',
            'description' => 'Tu OSE envía a SUNAT las facturas y boletas que emites.',
            'missing' => 'Elige tu OSE para emitir comprobantes electrónicos.',
            'href' => '/finanzas/facturacion',
            'cta' => 'Elegir OSE',
            'driver' => 'fiscal',
        ],
        'payments' => [
            'label' => 'Pasarela de pago',
            'description' => 'Cobros con tarjeta en tu sitio, enlaces de pago y tarjetas de regalo.',
            'missing' => 'Conecta tu pasarela de pago para cobrar con tarjeta.',
            'href' => '/finanzas/pasarelas',
            'cta' => 'Conectar pasarela',
            'driver' => 'payments',
        ],
    ];

    public const PLATFORM = [
        'sales_ai' => ['label' => 'Asistente de ventas con IA', 'driver' => 'sales_ai', 'missing' => 'El asistente de ventas con IA estará disponible próximamente.'],
        'catalog_import' => ['label' => 'Importar catálogo con IA', 'driver' => 'sales_ai', 'missing' => 'Importar el catálogo con IA estará disponible próximamente.'],
        'site_content_ai' => ['label' => 'Contenido con IA', 'driver' => 'site_content_ai', 'missing' => 'El contenido con IA estará disponible próximamente.'],
        'ruc' => ['label' => 'Validación del RUC', 'driver' => 'ruc', 'missing' => 'La consulta del RUC en SUNAT estará disponible próximamente.'],
        'fx' => ['label' => 'Tipo de cambio automático', 'driver' => 'fx', 'missing' => 'La actualización automática del tipo de cambio estará disponible próximamente. Mientras tanto, cárgalo a mano.'],
        'antivirus' => ['label' => 'Antivirus de archivos', 'driver' => 'antivirus', 'missing' => 'La carga de archivos estará disponible cuando KipuControl active el antivirus.'],
        'checkout' => ['label' => 'Cobro de la suscripción', 'driver' => 'checkout', 'missing' => 'El pago en línea de la suscripción estará disponible próximamente. Empieza con la prueba gratuita o escríbenos para pagar por transferencia.'],
        'ota' => ['label' => 'Conexión con OTAs', 'driver' => 'ota', 'missing' => 'La conexión con OTAs estará disponible próximamente.'],
        'accounting' => ['label' => 'Exportación contable', 'driver' => 'accounting', 'missing' => 'La exportación al sistema contable estará disponible próximamente.'],
        'travel_inventory' => ['label' => 'Ofertas de proveedores externos', 'driver' => 'travel_inventory', 'missing' => 'Las ofertas de proveedores externos estarán disponibles próximamente.'],
        'reviews' => ['label' => 'Reseñas externas', 'driver' => 'reviews', 'missing' => 'La sincronización de reseñas externas estará disponible próximamente.'],
        'push' => ['label' => 'Notificaciones push', 'driver' => 'push', 'missing' => 'Las notificaciones push estarán disponibles próximamente.'],
        'domains' => ['label' => 'Dominio propio', 'driver' => 'domains', 'missing' => 'La conexión de un dominio propio estará disponible próximamente.'],
        'tracking' => ['label' => 'Etiquetas y conversiones', 'driver' => 'tracking', 'missing' => 'La verificación de etiquetas y el envío de conversiones estarán disponibles próximamente.'],
    ];

    public const TRIAL_SIMULATION = [
        'ose' => 'Estás en prueba: puedes emitir en modo simulado, sin validez ante SUNAT. Para comprobantes válidos, elige tu OSE.',
    ];

    public static function missing(string $key): string
    {
        return self::AGENCY[$key]['missing'] ?? self::PLATFORM[$key]['missing'] ?? 'Esta función estará disponible próximamente.';
    }

    public static function driver(string $key): ?string
    {
        return self::AGENCY[$key]['driver'] ?? self::PLATFORM[$key]['driver'] ?? null;
    }
}
