<?php

declare(strict_types=1);

return [
    'central_domain' => env('TENANCY_CENTRAL_DOMAIN', 'localhost'),
    'allow_slug_login' => env('APP_ENV', 'production') !== 'production',
];
