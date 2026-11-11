<?php

use Illuminate\Support\Facades\DB;
use Tests\Support\TestDatabase;

it('todas las conexiones de PostgreSQL apuntan a kipucontrol_test', function (string $connection) {
    expect(config("database.connections.{$connection}.database"))->toBe('kipucontrol_test')
        ->and(DB::connection($connection)->selectOne('select current_database() as name')->name)->toBe('kipucontrol_test');
})->with(TestDatabase::CONNECTIONS);

it('la conexión de la aplicación no es superusuario ni tiene BYPASSRLS', function () {
    $role = DB::connection('pgsql')->selectOne('select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user');

    expect($role->rolname)->toBe('kipucontrol_app')
        ->and($role->rolsuper)->toBeFalse()
        ->and($role->rolbypassrls)->toBeFalse();
});

it('Redis usa bases y prefijos propios de pruebas', function () {
    expect((string) config('database.redis.default.database'))->toBe('14')
        ->and((string) config('database.redis.cache.database'))->toBe('15')
        ->and(config('database.redis.options.prefix'))->toBe('kipucontrol_test:')
        ->and(config('cache.default'))->toBe('redis');
});

it('el entorno es testing', function () {
    expect(app()->environment())->toBe('testing');
});
