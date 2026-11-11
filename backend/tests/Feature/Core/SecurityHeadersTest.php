<?php

it('las respuestas de la API llevan las cabeceras de seguridad', function () {
    $response = $this->getJson('/api/v1/public/plans');

    expect($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('X-Frame-Options'))->toBe('DENY')
        ->and($response->headers->get('Referrer-Policy'))->toBe('no-referrer')
        ->and((string) $response->headers->get('Content-Security-Policy'))->toContain("frame-ancestors 'none'")
        ->and($response->headers->has('X-Powered-By'))->toBeFalse();
});

it('HSTS solo se envía cuando la conexión es segura', function () {
    expect($this->getJson('/api/v1/public/plans')->headers->has('Strict-Transport-Security'))->toBeFalse()
        ->and($this->getJson('https://localhost/api/v1/public/plans')->headers->get('Strict-Transport-Security'))->toContain('max-age=');
});

it('CORS solo responde a la web propia y a los subdominios de las agencias', function () {
    $preflight = fn (string $origin) => $this->call('OPTIONS', '/api/v1/public/plans', server: ['HTTP_ORIGIN' => $origin, 'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET']);

    expect($preflight('http://localhost:3000')->headers->get('Access-Control-Allow-Origin'))->toBe('http://localhost:3000')
        ->and($preflight('http://andes.localhost:3000')->headers->get('Access-Control-Allow-Origin'))->toBe('http://andes.localhost:3000')
        ->and($preflight('https://sitio-malicioso.com')->headers->get('Access-Control-Allow-Origin'))->toBeNull()
        ->and($preflight('http://localhost.sitio-malicioso.com')->headers->get('Access-Control-Allow-Origin'))->toBeNull();
});

it('la depuración nunca queda encendida en producción aunque APP_DEBUG diga lo contrario', function () {
    $config = fn (string $env) => (function () use ($env) {
        $previous = [getenv('APP_ENV'), getenv('APP_DEBUG')];
        putenv("APP_ENV={$env}");
        putenv('APP_DEBUG=true');
        $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = $env;
        $_ENV['APP_DEBUG'] = $_SERVER['APP_DEBUG'] = 'true';
        try {
            return (require base_path('config/app.php'))['debug'];
        } finally {
            putenv('APP_ENV='.$previous[0]);
            putenv('APP_DEBUG='.$previous[1]);
            $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = (string) $previous[0];
            $_ENV['APP_DEBUG'] = $_SERVER['APP_DEBUG'] = (string) $previous[1];
        }
    })();

    expect($config('production'))->toBeFalse()
        ->and($config('local'))->toBeTrue();
});

it('X-Forwarded-Proto solo se respeta si viene de un proxy configurado en TRUSTED_PROXIES', function () {
    $forwarded = fn () => $this->call('GET', 'http://localhost/api/v1/ruta-inexistente', server: ['REMOTE_ADDR' => '10.0.0.5', 'HTTP_X_FORWARDED_PROTO' => 'https', 'HTTP_ACCEPT' => 'application/json']);

    config(['app.trusted_proxies' => '']);
    expect($forwarded()->headers->has('Strict-Transport-Security'))->toBeFalse();

    config(['app.trusted_proxies' => '10.0.0.5']);
    expect($forwarded()->headers->get('Strict-Transport-Security'))->toContain('max-age=');

    config(['app.trusted_proxies' => '10.0.0.9']);
    expect($forwarded()->headers->has('Strict-Transport-Security'))->toBeFalse();
});
