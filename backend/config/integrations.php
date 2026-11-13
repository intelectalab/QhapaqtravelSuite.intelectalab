<?php

declare(strict_types=1);

return [
    'drivers' => [
        'fiscal' => env('FISCAL_GATEWAY', 'fake'),
        'payments' => env('PAYMENT_GATEWAY', 'fake'),
        'messaging' => env('MESSAGING_CHANNEL', 'fake'),
        'reviews' => env('REVIEWS_PROVIDER', 'fake'),
        'fx' => env('FX_RATE_PROVIDER', 'fake'),
        'antivirus' => env('ANTIVIRUS_PROVIDER', 'fake'),
        'push' => env('PUSH_PROVIDER', 'fake'),
        'sales_ai' => env('SALES_AI_PROVIDER', 'fake'),
        'ota' => env('OTA_PROVIDER', 'fake'),
        'site_content_ai' => env('SITE_CONTENT_AI_PROVIDER', 'fake'),
        'accounting' => env('ACCOUNTING_PROVIDER', 'fake'),
        'travel_inventory' => env('TRAVEL_INVENTORY_PROVIDER', 'fake'),
    ],

    'retry' => [
        'max_attempts' => 5,
        'base_seconds' => 60,
        'jitter_pct' => 20,
    ],
];
