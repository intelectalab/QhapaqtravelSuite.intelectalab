<?php

declare(strict_types=1);

return [
    'roles' => [
        'tenant_admin' => ['experience' => 'backoffice', 'home' => '/dashboard'],
        'manager' => ['experience' => 'backoffice', 'home' => '/dashboard'],
        'sales' => ['experience' => 'backoffice', 'home' => '/dashboard'],
        'operations' => ['experience' => 'backoffice', 'home' => '/dashboard'],
        'finance' => ['experience' => 'backoffice', 'home' => '/dashboard'],
        'accounting' => ['experience' => 'backoffice', 'home' => '/dashboard'],
        'guide' => ['experience' => 'mobile', 'home' => '/mobile/operador'],
        'driver' => ['experience' => 'mobile', 'home' => '/mobile/operador'],
        'passenger' => ['experience' => 'portal', 'home' => '/canales/portal-pasajero/viajes'],
        'customer' => ['experience' => 'portal', 'home' => '/canales/portal-cliente'],
        'b2b' => ['experience' => 'portal', 'home' => '/canales/b2b/portal/catalogo'],
        'provider' => ['experience' => 'portal', 'home' => '/proveedor/solicitudes'],
    ],

    'session_hours' => [
        'backoffice' => 12,
        'portal' => 24 * 7,
        'mobile' => 24 * 30,
    ],

    'mfa_roles' => ['tenant_admin', 'manager', 'finance', 'accounting'],
];
