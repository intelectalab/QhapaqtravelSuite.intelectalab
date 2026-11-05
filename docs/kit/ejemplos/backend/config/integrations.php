<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| config/integrations.php — selección de adaptador por configuración
|--------------------------------------------------------------------------
| Variables definidas en kit-ia/infra/env/backend.env.example. En desarrollo y pruebas SIEMPRE `fake`
| (CLAUDE.md raíz: «integraciones sin adaptador Fake» está prohibido). Los proveedores reales están
| pendientes de decisión: D-01 (OSE/PSE), D-02 (pasarela), D-03 (WhatsApp/email), D-15 (reseñas),
| D-12 (tipo de cambio). No inventar credenciales ni URLs: cada driver real lee su secreto del gestor de
| secretos (`integration_adapters.secret_ref`).
*/

return [
    'drivers' => [
        'fiscal' => env('FISCAL_GATEWAY', 'fake'),
        'payments' => env('PAYMENT_GATEWAY', 'fake'),
        'messaging' => env('MESSAGING_CHANNEL', 'fake'),
        'reviews' => env('REVIEWS_PROVIDER', 'fake'),
        'fx' => env('FX_RATE_PROVIDER', 'fake'),
    ],

    // Política de reintentos para errores transitorios (spec 09 INT-BR-04): base × 2^intento, ±20 % jitter, máx. 5.
    'retry' => [
        'max_attempts' => 5,
        'base_seconds' => 60,
        'jitter_pct' => 20,
    ],
];
