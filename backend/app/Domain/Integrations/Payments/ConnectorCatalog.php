<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments;

use App\Domain\Integrations\Payments\Adapters\CulqiGateway;
use App\Domain\Integrations\Payments\Adapters\IzipayGateway;
use App\Domain\Integrations\Payments\Adapters\MercadoPagoGateway;
use App\Domain\Integrations\Payments\Adapters\NiubizGateway;

final class ConnectorCatalog
{
    public const CONNECTORS = [
        'izipay' => [
            'label' => 'Izipay',
            'class' => IzipayGateway::class,
            'webhook' => true,
            'webhook_hint' => 'Pégala en el Back Office de Izipay › Configuración › Reglas de notificación › URL de notificación al final del pago (IPN).',
            'fields' => [
                ['key' => 'shop_id', 'label' => 'Usuario (ID de tienda)', 'secret' => false, 'hint' => 'Número de 8 dígitos de Configuración › Tienda › Claves de API REST.'],
                ['key' => 'password', 'label' => 'Contraseña', 'secret' => true, 'hint' => 'Contraseña de test (testpassword_…) o de producción (prodpassword_…), según el modo.'],
                ['key' => 'public_key', 'label' => 'Clave pública JavaScript', 'secret' => false, 'hint' => 'Tiene la forma 12345678:testpublickey_… o 12345678:prodpublickey_….'],
                ['key' => 'hmac_key', 'label' => 'Clave HMAC-SHA-256', 'secret' => true, 'hint' => 'Firma la respuesta que vuelve al navegador.'],
            ],
            'csp' => [
                'script' => ['https://static.micuentaweb.pe'],
                'style' => ['https://static.micuentaweb.pe'],
                'connect' => ['https://api.micuentaweb.pe', 'https://static.micuentaweb.pe', 'https://secure.micuentaweb.pe'],
                'frame' => ['https://api.micuentaweb.pe', 'https://static.micuentaweb.pe', 'https://secure.micuentaweb.pe'],
            ],
        ],
        'culqi' => [
            'label' => 'Culqi',
            'class' => CulqiGateway::class,
            'webhook' => true,
            'webhook_hint' => 'Pégala en CulqiPanel › Eventos › Webhooks › Añadir, con los eventos de cargos y devoluciones.',
            'fields' => [
                ['key' => 'public_key', 'label' => 'Llave pública', 'secret' => false, 'hint' => 'Empieza con pk_test_ en modo prueba o pk_live_ en producción.'],
                ['key' => 'secret_key', 'label' => 'Llave secreta', 'secret' => true, 'hint' => 'Empieza con sk_test_ en modo prueba o sk_live_ en producción.'],
            ],
            'csp' => [
                'script' => ['https://checkout.culqi.com', 'https://js.culqi.com', 'https://3ds.culqi.com'],
                'style' => ['https://checkout.culqi.com'],
                'connect' => ['https://api.culqi.com', 'https://secure.culqi.com', 'https://checkout.culqi.com'],
                'frame' => ['https://checkout.culqi.com', 'https://js.culqi.com', 'https://3ds.culqi.com'],
            ],
        ],
        'niubiz' => [
            'label' => 'Niubiz',
            'class' => NiubizGateway::class,
            'webhook' => false,
            'webhook_hint' => 'Niubiz confirma cada cobro en línea al autorizarlo, así que no necesita URL de aviso.',
            'fields' => [
                ['key' => 'merchant_id', 'label' => 'Código de comercio', 'secret' => false, 'hint' => 'Los 9 dígitos que te asignó Niubiz al afiliarte.'],
                ['key' => 'user', 'label' => 'Usuario de la API', 'secret' => false, 'hint' => 'El correo de integración que te entregó Niubiz.'],
                ['key' => 'password', 'label' => 'Contraseña de la API', 'secret' => true, 'hint' => 'La de pruebas o la de producción, según el modo.'],
            ],
            'csp' => [
                'sandbox' => [
                    'script' => ['https://static-content-qas.vnforapps.com'],
                    'style' => ['https://static-content-qas.vnforapps.com'],
                    'connect' => ['https://static-content-qas.vnforapps.com', 'https://apisandbox.vnforappstest.com'],
                    'frame' => ['https://static-content-qas.vnforapps.com', 'https://apisandbox.vnforappstest.com'],
                ],
                'produccion' => [
                    'script' => ['https://static-content.vnforapps.com'],
                    'style' => ['https://static-content.vnforapps.com'],
                    'connect' => ['https://static-content.vnforapps.com', 'https://apiprod.vnforapps.com'],
                    'frame' => ['https://static-content.vnforapps.com', 'https://apiprod.vnforapps.com'],
                ],
            ],
        ],
        'mercadopago' => [
            'label' => 'Mercado Pago',
            'class' => MercadoPagoGateway::class,
            'webhook' => true,
            'webhook_hint' => 'Pégala en Tus integraciones › tu aplicación › Webhooks › Configurar notificaciones, con el evento Pagos, y copia aquí la clave secreta que genera.',
            'fields' => [
                ['key' => 'public_key', 'label' => 'Public Key', 'secret' => false, 'hint' => 'De Credenciales de prueba o de producción, según el modo.'],
                ['key' => 'access_token', 'label' => 'Access Token', 'secret' => true, 'hint' => 'Del mismo juego de credenciales que la Public Key.'],
                ['key' => 'webhook_secret', 'label' => 'Clave secreta de webhooks', 'secret' => true, 'hint' => 'La que aparece al guardar la URL de webhooks en tu aplicación.'],
            ],
            'csp' => [
                'script' => ['https://sdk.mercadopago.com', 'https://http2.mlstatic.com'],
                'style' => ['https://http2.mlstatic.com'],
                'connect' => ['https://api.mercadopago.com', 'https://api.mercadolibre.com', 'https://events.mercadopago.com', 'https://http2.mlstatic.com'],
                'frame' => ['https://www.mercadopago.com.pe', 'https://www.mercadolibre.com', 'https://api.mercadopago.com', 'https://secure-fields.mercadopago.com'],
            ],
        ],
    ];

    public static function has(string $provider): bool
    {
        return isset(self::CONNECTORS[$provider]);
    }

    public static function providers(): array
    {
        return array_keys(self::CONNECTORS);
    }

    public static function label(string $provider): string
    {
        return self::CONNECTORS[$provider]['label'] ?? $provider;
    }

    public static function fields(string $provider): array
    {
        return self::CONNECTORS[$provider]['fields'] ?? [];
    }

    public static function fieldKeys(): array
    {
        return array_values(array_unique(array_merge(...array_map(fn (array $row) => array_column($row['fields'], 'key'), array_values(self::CONNECTORS)))));
    }

    public static function required(string $provider): array
    {
        return array_column(self::fields($provider), 'key');
    }

    public static function missing(string $provider, array $secrets): array
    {
        return array_values(array_map(fn (array $field) => $field['label'], array_filter(self::fields($provider), fn (array $field) => trim((string) ($secrets[$field['key']] ?? '')) === '')));
    }

    public static function sources(string $provider, string $mode): array
    {
        $csp = self::CONNECTORS[$provider]['csp'] ?? [];

        return isset($csp['sandbox']) ? ($mode === 'produccion' ? $csp['produccion'] : $csp['sandbox']) : $csp;
    }

    public static function form(): array
    {
        return array_map(fn (string $provider, array $row) => [
            'provider' => $provider,
            'label' => $row['label'],
            'webhook' => $row['webhook'],
            'webhook_hint' => $row['webhook_hint'],
            'fields' => $row['fields'],
        ], array_keys(self::CONNECTORS), array_values(self::CONNECTORS));
    }

    public static function modeError(string $provider, string $mode, array $secrets): ?string
    {
        $live = $mode === 'produccion';

        return match ($provider) {
            'culqi' => self::prefixed($secrets, ['public_key' => $live ? 'pk_live_' : 'pk_test_', 'secret_key' => $live ? 'sk_live_' : 'sk_test_'])
                ? null : ($live ? 'En producción las llaves de Culqi empiezan con pk_live_ y sk_live_.' : 'En modo prueba las llaves de Culqi empiezan con pk_test_ y sk_test_.'),
            'izipay' => ! isset($secrets['public_key']) || str_contains((string) $secrets['public_key'], $live ? 'prodpublickey_' : 'testpublickey_')
                ? null : ($live ? 'En producción la clave pública de Izipay contiene prodpublickey_.' : 'En modo prueba la clave pública de Izipay contiene testpublickey_.'),
            default => null,
        };
    }

    private static function prefixed(array $secrets, array $prefixes): bool
    {
        foreach ($prefixes as $key => $prefix) {
            if (isset($secrets[$key]) && ! str_starts_with((string) $secrets[$key], $prefix)) {
                return false;
            }
        }

        return true;
    }
}
