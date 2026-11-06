<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FxRate;

final class FakeFxRateProvider implements FxRateProvider
{
    public function __construct(private readonly array $rates = ['USD' => '3.740000', 'EUR' => '4.050000', 'GBP' => '4.780000', 'BRL' => '0.680000']) {}

    public function latest(array $currencies, string $date): array
    {
        $out = [];
        foreach ($currencies as $code) {
            if (isset($this->rates[$code])) {
                $out[] = new FxRate($code, $this->rates[$code], $date, 'Simulado (demo)');
            }
        }

        return $out;
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
