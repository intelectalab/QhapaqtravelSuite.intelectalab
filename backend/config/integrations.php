<?php

declare(strict_types=1);

return [
    'drivers' => [
        'fiscal' => env('FISCAL_GATEWAY', 'fake'),
        'payments' => env('PAYMENT_GATEWAY', 'fake'),
        'messaging' => env('MESSAGING_CHANNEL', 'fake'),
        'whatsapp' => env('WHATSAPP_CLOUD', 'fake'),
        'reviews' => env('REVIEWS_PROVIDER', 'fake'),
        'fx' => env('FX_RATE_PROVIDER', 'fake'),
        'antivirus' => env('ANTIVIRUS_PROVIDER', 'fake'),
        'push' => env('PUSH_PROVIDER', 'fake'),
        'sales_ai' => env('SALES_AI_PROVIDER', 'fake'),
        'ota' => env('OTA_PROVIDER', 'fake'),
        'site_content_ai' => env('SITE_CONTENT_AI_PROVIDER', 'fake'),
        'accounting' => env('ACCOUNTING_PROVIDER', 'fake'),
        'travel_inventory' => env('TRAVEL_INVENTORY_PROVIDER', 'fake'),
        'ruc' => env('RUC_LOOKUP_PROVIDER', 'fake'),
        'checkout' => env('PLATFORM_CHECKOUT_PROVIDER', 'fake'),
        'domains' => env('DOMAIN_PROVISIONER', 'fake'),
        'tracking' => env('TRACKING_PROVIDER', 'fake'),
    ],

    'require_real' => env('INTEGRATIONS_REQUIRE_REAL'),

    'retry' => [
        'max_attempts' => 5,
        'base_seconds' => 60,
        'jitter_pct' => 20,
    ],
];
