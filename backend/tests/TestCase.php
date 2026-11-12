<?php

namespace Tests;

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\ParallelTesting;
use Illuminate\Testing\TestResponse;
use Tests\Support\TestDatabase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication(): Application
    {
        $app = parent::createApplication();

        if (($token = ParallelTesting::token()) !== false) {
            $app['config']->set('cache.prefix', $app['config']->get('cache.prefix').'p'.$token.':');
            $app['cache']->forgetDriver(array_keys((array) $app['config']->get('cache.stores')));
            $app->forgetInstance('cache.store');
            Cache::clearResolvedInstances();
        }

        TestDatabase::assertIsolated($app);

        return $app;
    }

    private static ?array $tenantIds = null;

    protected function tearDown(): void
    {
        if (isset($this->app)) {
            self::$tenantIds ??= DB::connection('pgsql_platform')->table('tenants')->pluck('id')->map(fn (mixed $id): string => (string) $id)->all();

            foreach (self::$tenantIds as $tenantId) {
                RuleResolver::invalidate($tenantId);
            }
        }

        parent::tearDown();
    }

    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
