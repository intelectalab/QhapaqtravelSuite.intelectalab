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

/**
 * Enlaza cada interfaz de integración con el adaptador elegido en config/integrations.php
 * (FISCAL_GATEWAY, PAYMENT_GATEWAY, MESSAGING_CHANNEL, REVIEWS_PROVIDER, FX_RATE_PROVIDER).
 *
 * - Agregar un proveedor real = nueva clase que implementa la interfaz + una entrada en DRIVERS.
 *   Nada del dominio cambia (02-ARQUITECTURA §9: integraciones detrás de interfaces).
 * - En producción se prohíbe `fake` para fiscal y pagos (falla al arrancar): evita emitir/cobrar "de mentira".
 * - Singletons: el Fake conserva lo enviado durante la prueba (`app(FiscalGateway::class)->issued`).
 *   En Octane, los adaptadores reales deben ser sin estado.
 * - SUPUESTO: en multi-tenant cada tenant puede tener su propio proveedor/credenciales (integration_adapters por
 *   tenant). Para eso el adaptador real recibe la configuración del tenant al construirse (fábrica por TenantContext).
 */
final class IntegrationServiceProvider extends ServiceProvider
{
    /** @var array<class-string, array{config: string, drivers: array<string, class-string>}> */
    private const DRIVERS = [
        FiscalGateway::class => ['config' => 'integrations.drivers.fiscal', 'drivers' => ['fake' => FakeFiscalGateway::class]],
        PaymentGateway::class => ['config' => 'integrations.drivers.payments', 'drivers' => ['fake' => FakePaymentGateway::class]],
        MessagingChannel::class => ['config' => 'integrations.drivers.messaging', 'drivers' => ['fake' => FakeMessagingChannel::class]],
        ReviewsProvider::class => ['config' => 'integrations.drivers.reviews', 'drivers' => ['fake' => FakeReviewsProvider::class]],
        FxRateProvider::class => ['config' => 'integrations.drivers.fx', 'drivers' => ['fake' => FakeFxRateProvider::class]],
    ];

    /** Interfaces que no pueden quedar en `fake` en producción. */
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
