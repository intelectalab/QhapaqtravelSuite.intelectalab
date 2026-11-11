<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Integrations\Adapters\ClamAvMalwareScanner;
use App\Domain\Integrations\Contracts\CaptchaVerifier;
use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Contracts\MalwareScanner;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Integrations\Fake\FakeFiscalGateway;
use App\Domain\Integrations\Fake\FakeFxRateProvider;
use App\Domain\Integrations\Fake\FakeMalwareScanner;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Integrations\Fake\FakePaymentGateway;
use App\Domain\Integrations\Fake\FakeReviewsProvider;
use App\Domain\Integrations\Mail\PlatformMailTransport;
use App\Domain\Integrations\Mail\SmtpConnector;
use App\Domain\Integrations\Support\ConfiguredCaptchaVerifier;
use App\Domain\Platform\Support\OutgoingMail;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Mail;
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
        MalwareScanner::class => ['config' => 'integrations.drivers.antivirus', 'drivers' => ['fake' => FakeMalwareScanner::class, 'clamav' => ClamAvMalwareScanner::class]],
    ];

    private const REAL_REQUIRED_IN_PRODUCTION = [FiscalGateway::class, PaymentGateway::class, MalwareScanner::class];

    public function register(): void
    {
        $this->mergeConfigFrom(config_path('integrations.php'), 'integrations');
        $this->app->bind(CaptchaVerifier::class, ConfiguredCaptchaVerifier::class);

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

    public function boot(): void
    {
        Mail::extend('platform', function (array $config): PlatformMailTransport {
            $fallback = (string) ($config['fallback'] ?? 'log');

            return new PlatformMailTransport($this->app->make(OutgoingMail::class), $this->app->make(SmtpConnector::class), $this->app->make('mail.manager'), $fallback === 'platform' ? 'log' : $fallback);
        });
    }
}
