<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FxRate;
use App\Domain\Integrations\Support\IntegrationReadiness;

final class FakeFxRateProvider implements FxRateProvider
{
    public function __construct(
        private readonly array $rates = ['USD' => '3.740000', 'EUR' => '4.050000', 'GBP' => '4.780000', 'BRL' => '0.680000'],
        private readonly string $source = 'Simulado (demo)',
        private readonly array $missing = [],
    ) {}

    public function latest(array $currencies, string $date): array
    {
        IntegrationReadiness::refuse('fx');

        $out = [];
        foreach ($currencies as $code) {
            if (isset($this->rates[$code])) {
                $out[] = new FxRate($code, $this->rates[$code], $date, $this->source);
            }
        }

        return $out;
    }

    public function healthcheck(): AdapterResult
    {
        if (($unavailable = IntegrationReadiness::health('fx')) !== null) {
            return $unavailable;
        }

        if ($this->missing !== []) {
            return AdapterResult::permanent('Faltan credenciales: '.implode(', ', $this->missing).'.');
        }

        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
