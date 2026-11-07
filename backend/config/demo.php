<?php

declare(strict_types=1);

return [
    'password' => env('DEMO_PASSWORD', env('E2E_PASSWORD')),
    'totp_secret' => env('DEMO_TOTP_SECRET', env('E2E_TOTP_SECRET')),
    'frozen_today' => env('APP_FROZEN_TODAY'),
];
