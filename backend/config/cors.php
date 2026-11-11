<?php

declare(strict_types=1);

$domain = preg_quote((string) env('TENANCY_CENTRAL_DOMAIN', 'localhost'), '#');
$scheme = env('APP_ENV', 'production') === 'production' ? 'https' : 'https?';
$extra = array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')))));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_unique([(string) env('FRONTEND_URL', 'http://localhost:3000'), ...$extra])),
    'allowed_origins_patterns' => ["#^{$scheme}://([a-z0-9-]+\\.)*{$domain}(:\\d+)?$#"],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'Idempotency-Key', 'If-Match', 'X-Request-Id', 'X-Site-Locale', 'X-Order-Token', 'X-Qhapaq-Key'],
    'exposed_headers' => ['ETag', 'X-Request-Id', 'Retry-After'],
    'max_age' => 600,
    'supports_credentials' => false,
];
