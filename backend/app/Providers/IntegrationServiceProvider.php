<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Integrations\Fake\FakeFiscalGateway;
use App\Domain\Integrations\Fake\FakeFxRateProvider;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Integrations\Fake\FakePaymentGateway;
use App\Domain\Integrations\Fake\FakeReviewsProvider;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

final class IntegrationServiceProvider extends ServiceProvider
{
    private const DRIVERS = [
        FiscalGateway::class => ['config' => 'integrations.drivers.fiscal', 'drivers' => ['fake' => FakeFiscalGateway::class]],
        PaymentGateway::class => ['config' => 'integrations.drivers.payments', 'drivers' => ['fake' => FakePaymentGateway::class]],
        MessagingChannel::class => ['config' => 'integrations.drivers.messaging', 'drivers' => ['fake' => FakeMessagingChannel::class]],
        ReviewsProvider::class => ['config' => 'integrations.drivers.reviews', 'drivers' => ['fake' => FakeReviewsProvider::class]],
        FxRateProvider::class => ['config' => 'integrations.drivers.fx', 'drivers' => ['fake' => FakeFxRateProvider::class]],
    ];

    private const REAL_REQUIRED_IN_PRODUCTION = [FiscalGateway::class, PaymentGateway::class];

    public function register(): void
    {
        $this->mergeConfigFrom(config_path('integrations.php'), 'integrations');

        foreach (self::DRIVERS as $contract => $definition) {
            $this->app->singleton($contract, function (Application $app) use ($contract, $definition) {
                $driver = (string) $app['config']->get($definition['config'], 'fake');

                if ($driver === 'fake' && $app->isProduction() && in_array($contract, self::REAL_REQUIRED_IN_PRODUCTION, true)) {
                    throw new InvalidArgumentException(class_basename($contract).': el adaptador `fake` no está permitido en producción.');
                }

                $class = $definition['drivers'][$driver]
                    ?? throw new InvalidArgumentException(sprintf('Adaptador «%s» no implementado para %s (proveedor por definir).', $driver, class_basename($contract)));

                return $app->make($class);
            });
        }
    }
}
