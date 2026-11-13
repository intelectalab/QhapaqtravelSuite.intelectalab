<?php

declare(strict_types=1);

return [
    'payload' => [
        'webhook_secret' => env('PAYLOAD_WEBHOOK_SECRET', ''),
        'tolerance_seconds' => 300,
        'admin_url' => env('PAYLOAD_ADMIN_URL', 'https://rutaslibres.pe/admin'),
    ],
];
