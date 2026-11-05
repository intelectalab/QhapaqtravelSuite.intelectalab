<?php

/*
|--------------------------------------------------------------------------
| Pest — configuración de referencia (copiar a tests/Pest.php del repo API)
|--------------------------------------------------------------------------
| - Feature: base real PostgreSQL 17 con RLS (NUNCA sqlite: RLS, CHECK, índices parciales y
|   FOR UPDATE son parte de lo que se prueba). El usuario de BD de pruebas NO es superusuario
|   ni tiene BYPASSRLS, y las tablas usan FORCE ROW LEVEL SECURITY.
| - Semilla: DemoTenantSeeder (seeds/*.json → TNT-0001) + SecondTenantSeeder (TNT-0002 mínimo).
| - Fecha de negocio congelada: 2026-09-29 (window.TODAY del prototipo).
*/

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

require_once __DIR__.'/Support/Helpers.php';

uses(TestCase::class, LazilyRefreshDatabase::class)
    ->beforeEach(function () {
        freezeBusinessToday();          // Carbon::setTestNow('2026-09-29 10:00:00', 'America/Lima')
        seedDemoTenants();              // idempotente por test (transacción)
    })
    ->in('Feature');

uses(TestCase::class)
    ->beforeEach(fn () => freezeBusinessToday())
    ->in('Unit');

/*
| Expectativas propias
*/
expect()->extend('toBeMoney', function (string $amount, ?string $currency = null) {
    // Dinero = string decimal con 2 decimales (CONVENCIONES §3: montos como string + currency)
    $value = is_array($this->value) ? ($this->value['amount'] ?? null) : $this->value;
    expect((string) $value)->toBe($amount);
    if ($currency !== null && is_array($this->value)) {
        expect($this->value['currency'])->toBe($currency);
    }

    return $this;
});

expect()->extend('toBeApiError', function (int $status, ?string $code = null) {
    /** @var \Illuminate\Testing\TestResponse $res */
    $res = $this->value;
    $res->assertStatus($status);
    if ($code !== null) {
        expect($res->json('code'))->toBe($code);
    }
    if ($status === 403) {
        expect($res->json('error'))->toBe('FORBIDDEN')
            ->and($res->json('correlation_id'))->not->toBeEmpty();
    }

    return $this;
});
