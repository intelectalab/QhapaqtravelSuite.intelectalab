<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Adapters;

use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FxRate;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class SunatFxRateProvider implements FxRateProvider
{
    public const ENDPOINT = 'https://www.sunat.gob.pe/a/txt/tipoCambio.txt';

    public const CURRENCIES = ['USD'];

    public function latest(array $currencies, string $date): array
    {
        $wanted = array_map(fn (string $code): string => strtoupper(trim($code)), $currencies);

        if (! in_array('USD', $wanted, true)) {
            return [];
        }

        [$day, $buy, $sell] = $this->published();

        if ($day > $date) {
            return [];
        }

        return [new FxRate('USD', $sell, $date, FxPublication::source('SUNAT', $day, $date), $buy, $sell)];
    }

    public function healthcheck(): AdapterResult
    {
        try {
            [$day, $buy, $sell] = $this->published();
        } catch (RuntimeException $e) {
            return AdapterResult::transient($e->getMessage());
        }

        return AdapterResult::success('ok', null, ['simulated' => false, 'currency' => 'USD', 'date' => $day, 'buy' => $buy, 'sell' => $sell]);
    }

    private function published(): array
    {
        try {
            $response = Http::timeout(15)->withHeaders(['Accept' => 'text/plain'])->get(self::ENDPOINT);
        } catch (ConnectionException) {
            throw new RuntimeException('No pudimos comunicarnos con SUNAT. Inténtalo de nuevo en unos minutos.');
        }

        if (! $response->successful()) {
            throw new RuntimeException('SUNAT no devolvió el tipo de cambio (HTTP '.$response->status().').');
        }

        $parts = explode('|', trim($response->body()));

        if (count($parts) < 3 || preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', trim($parts[0]), $match) !== 1) {
            throw new RuntimeException('SUNAT respondió en un formato que no reconocemos.');
        }

        $buy = FxPublication::rate($parts[1]);
        $sell = FxPublication::rate($parts[2]);

        if ($buy === null || $sell === null) {
            throw new RuntimeException('SUNAT todavía no publica el tipo de cambio de compra y venta.');
        }

        return ["{$match[3]}-{$match[2]}-{$match[1]}", $buy, $sell];
    }
}
