<?php

use Illuminate\Testing\TestResponse;
use Tests\Support\TestDatabase;
use Tests\TestCase;

require_once __DIR__.'/Support/Helpers.php';

uses(TestCase::class)
    ->beforeEach(function () {
        TestDatabase::prepare();
        TestDatabase::begin($this->app);
        $this->beforeApplicationDestroyed(fn () => TestDatabase::rollBack($this->app));
        TestDatabase::flushCache();
        TestDatabase::isolatePermissionCache();
        freezeBusinessToday();
    })
    ->in('Feature');

uses(TestCase::class)
    ->beforeEach(fn () => freezeBusinessToday())
    ->in('Unit/Booking', 'Unit/Quotes', 'Unit/Testing');

expect()->extend('toBeMoney', function (string $amount, ?string $currency = null) {
    $value = is_array($this->value) ? ($this->value['amount'] ?? null) : $this->value;
    expect((string) $value)->toBe($amount);

    if ($currency !== null && is_array($this->value)) {
        expect($this->value['currency'])->toBe($currency);
    }

    return $this;
});

expect()->extend('toBeApiError', function (int $status, ?string $code = null) {
    $response = $this->value;

    if (! $response instanceof TestResponse) {
        throw new InvalidArgumentException('toBeApiError espera una TestResponse.');
    }

    $response->assertStatus($status);

    if ($code !== null) {
        expect($response->json('code'))->toBe($code);
    }

    if ($status === 403) {
        expect($response->json('error'))->toBe('FORBIDDEN')
            ->and($response->json('correlation_id'))->not->toBeEmpty();
    }

    return $this;
});
