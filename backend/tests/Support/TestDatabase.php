<?php

declare(strict_types=1);

namespace Tests\Support;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Foundation\Testing\DatabaseTransactionsManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\ParallelTesting;
use PDO;
use RuntimeException;
use Spatie\Permission\PermissionRegistrar;
use Throwable;

final class TestDatabase
{
    public const NAME = 'kipucontrol_test';

    public const CONNECTIONS = ['pgsql', 'pgsql_audit', 'pgsql_platform', 'pgsql_owner'];

    public const TRANSACTIONAL = ['pgsql', 'pgsql_audit', 'pgsql_platform'];

    public const REDIS_DATABASES = ['default' => '14', 'cache' => '15'];

    private const SEED_MOMENT = '2026-09-29 10:00:00';

    private const REBUILD_LOCK = 7410291;

    private const USAGE_LOCK = 7410292;

    private static bool $ready = false;

    private static ?Throwable $failure = null;

    private static ?PDO $session = null;

    public static function assertIsolated(Application $app): void
    {
        $config = $app->make('config');

        if ($app->environment() !== 'testing' || $app->configurationIsCached()) {
            throw new RuntimeException('Las pruebas solo corren con APP_ENV=testing y sin config:cache.');
        }

        if ($config->get('database.default') !== 'pgsql') {
            throw new RuntimeException('Las pruebas deben usar la conexión pgsql.');
        }

        foreach (self::CONNECTIONS as $name) {
            $connection = $config->get("database.connections.{$name}");

            if (($connection['database'] ?? null) !== self::NAME || ($connection['url'] ?? null)) {
                throw new RuntimeException("La conexión {$name} no apunta a ".self::NAME.'. Se detienen las pruebas para proteger la base de desarrollo.');
            }
        }

        foreach (self::REDIS_DATABASES as $name => $database) {
            if ((string) $config->get("database.redis.{$name}.database") !== $database) {
                throw new RuntimeException("Redis {$name} no usa la base {$database} de pruebas.");
            }
        }
    }

    public static function confirmServerSide(): void
    {
        foreach (self::CONNECTIONS as $name) {
            $current = DB::connection($name)->selectOne('select current_database() as name')->name;

            if ($current !== self::NAME) {
                throw new RuntimeException("La conexión {$name} está en {$current}. Se detienen las pruebas.");
            }
        }
    }

    public static function prepare(): void
    {
        if (self::$failure !== null) {
            throw self::$failure;
        }

        if (self::$ready) {
            return;
        }

        self::confirmServerSide();
        $session = self::session();
        $session->query('select pg_advisory_lock('.self::REBUILD_LOCK.')');

        try {
            if (self::fingerprint() !== self::storedFingerprint() || getenv('KIPUCONTROL_TEST_REFRESH') === '1') {
                self::rebuildWhenAlone($session);
            }

            $session->query('select pg_advisory_lock_shared('.self::USAGE_LOCK.')');
        } catch (Throwable $e) {
            self::$failure = new RuntimeException('No se pudo preparar kipucontrol_test: '.$e->getMessage(), 0, $e);

            throw self::$failure;
        } finally {
            $session->query('select pg_advisory_unlock('.self::REBUILD_LOCK.')');
        }

        self::$ready = true;
    }

    private static function rebuildWhenAlone(PDO $session): void
    {
        if (! $session->query('select pg_try_advisory_lock('.self::USAGE_LOCK.')')->fetchColumn()) {
            fwrite(STDERR, "Otra ejecución de pruebas usa kipucontrol_test: se reutiliza la semilla actual.\n");

            return;
        }

        try {
            self::rebuild();
        } finally {
            $session->query('select pg_advisory_unlock('.self::USAGE_LOCK.')');
        }
    }

    private static function session(): PDO
    {
        if (self::$session !== null) {
            return self::$session;
        }

        $config = config('database.connections.pgsql_owner');

        if ($config['database'] !== self::NAME) {
            throw new RuntimeException('La sesión de control no apunta a '.self::NAME.'.');
        }

        self::$session = new PDO(
            sprintf('pgsql:host=%s;port=%s;dbname=%s', $config['host'], $config['port'], $config['database']),
            $config['username'],
            $config['password'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
        );

        if (self::$session->query('select current_database()')->fetchColumn() !== self::NAME) {
            throw new RuntimeException('La sesión de control no está en '.self::NAME.'.');
        }

        return self::$session;
    }

    public static function begin(Application $app): void
    {
        $database = $app->make('db');
        $manager = new DatabaseTransactionsManager(self::TRANSACTIONAL);
        $app->instance('db.transactions', $manager);

        foreach (self::TRANSACTIONAL as $name) {
            $connection = $database->connection($name);
            $connection->setTransactionManager($manager);
            $dispatcher = $connection->getEventDispatcher();
            $connection->unsetEventDispatcher();
            $connection->beginTransaction();
            $connection->setEventDispatcher($dispatcher);
        }
    }

    public static function rollBack(Application $app): void
    {
        $database = $app->make('db');

        foreach (self::TRANSACTIONAL as $name) {
            $connection = $database->connection($name);
            $dispatcher = $connection->getEventDispatcher();
            $connection->unsetEventDispatcher();

            while ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }

            $connection->setEventDispatcher($dispatcher);
            $connection->disconnect();
        }
    }

    public static function isolatePermissionCache(): void
    {
        config(['permission.cache.store' => 'array']);
        app(PermissionRegistrar::class)->initializeCache();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public static function flushCache(): void
    {
        if (ParallelTesting::token() === false) {
            Cache::flush();
        }
    }

    private static function rebuild(): void
    {
        $now = CarbonImmutable::parse(self::SEED_MOMENT, 'America/Lima');
        Carbon::setTestNow($now);
        CarbonImmutable::setTestNow($now);

        try {
            Artisan::call('migrate:fresh', [
                '--database' => 'pgsql_owner',
                '--force' => true,
                '--seed' => true,
                '--seeder' => 'Database\\Seeders\\DemoSeeder',
            ]);
        } finally {
            Carbon::setTestNow();
            CarbonImmutable::setTestNow();
        }

        $owner = DB::connection('pgsql_owner');
        $owner->statement('create table if not exists zz_test_fingerprint (value text not null)');
        $owner->statement('revoke all on zz_test_fingerprint from app_role, platform_role');
        $owner->table('zz_test_fingerprint')->delete();
        $owner->table('zz_test_fingerprint')->insert(['value' => self::fingerprint()]);

        Cache::flush();
    }

    private static function storedFingerprint(): ?string
    {
        $owner = DB::connection('pgsql_owner');

        if (! $owner->getSchemaBuilder()->hasTable('zz_test_fingerprint')) {
            return null;
        }

        return $owner->table('zz_test_fingerprint')->value('value');
    }

    private static function fingerprint(): string
    {
        $files = array_merge(
            glob(database_path('migrations/*.php')) ?: [],
            glob(database_path('seeders/*.php')) ?: [],
            glob(database_path('seeders/*/*.php')) ?: [],
            glob(database_path('seeders/*/*/*.php')) ?: [],
            glob(database_path('Support/*.php')) ?: [],
            glob(base_path('../docs/kit/database/*.sql')) ?: [],
            glob(base_path('../docs/kit/seeds/*.json')) ?: [],
            [base_path('app/Domain/Shared/Jobs/JobCatalog.php')],
        );
        sort($files);

        return hash('sha256', implode('|', array_map(
            fn (string $file): string => $file.':'.hash_file('xxh128', $file),
            $files,
        )));
    }
}
