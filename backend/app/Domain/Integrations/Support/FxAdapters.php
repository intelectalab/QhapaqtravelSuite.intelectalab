<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Fake\FakeFxRateProvider;
use App\Domain\Platform\Support\FxProviderCatalog;
use App\Domain\Platform\Support\IntegrationSecrets;
use InvalidArgumentException;

final class FxAdapters
{
    private const SIMULATED_RATES = [
        'simulado' => ['USD' => '3.740000', 'EUR' => '4.050000', 'GBP' => '4.780000', 'BRL' => '0.680000'],
        'bcrp' => ['USD' => '3.738000', 'EUR' => '4.046000', 'GBP' => '4.775000', 'BRL' => '0.679000'],
        'sunat' => ['USD' => '3.742000', 'EUR' => '4.052000', 'GBP' => '4.781000', 'BRL' => '0.681000'],
        'api' => ['USD' => '3.739000', 'EUR' => '4.049000', 'GBP' => '4.779000', 'BRL' => '0.680000'],
    ];

    public function __construct(private readonly FxProviderCatalog $catalog) {}

    public function simulated(): bool
    {
        return (string) config('integrations.drivers.fx', 'fake') === 'fake';
    }

    public function for(array $provider): FxRateProvider
    {
        $fields = $this->catalog->fields($provider);
        $missing = array_map(fn (string $field): string => $fields[$field], IntegrationSecrets::missing($fields, $this->catalog->credentials($provider)));

        if ($this->simulated()) {
            return new FakeFxRateProvider(self::SIMULATED_RATES[$provider['driver']] ?? self::SIMULATED_RATES['simulado'], $provider['driver'] === 'simulado' ? 'Simulado (demo)' : $provider['name'].' (simulado)', $missing);
        }

        throw new InvalidArgumentException(sprintf('Adaptador «%s» no implementado para el tipo de cambio (proveedor por definir).', $provider['driver']));
    }
}
