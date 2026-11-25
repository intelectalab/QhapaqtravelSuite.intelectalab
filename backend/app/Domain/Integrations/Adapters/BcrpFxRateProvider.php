<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Adapters;

use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FxRate;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class BcrpFxRateProvider implements FxRateProvider
{
    public const ENDPOINT = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api';

    public const SERIES = [
        'USD' => ['buy' => 'PD04639PD', 'sell' => 'PD04640PD'],
        'EUR' => ['buy' => 'PD04647PD', 'sell' => 'PD04648PD'],
    ];

    public const LOOKBACK_DAYS = 15;

    private const MONTHS = ['ene' => 1, 'feb' => 2, 'mar' => 3, 'abr' => 4, 'may' => 5, 'jun' => 6, 'jul' => 7, 'ago' => 8, 'set' => 9, 'sep' => 9, 'oct' => 10, 'nov' => 11, 'dic' => 12];

    public function latest(array $currencies, string $date): array
    {
        $wanted = array_values(array_filter(array_map(fn (string $code): string => strtoupper(trim($code)), $currencies), fn (string $code): bool => isset(self::SERIES[$code])));

        if ($wanted === []) {
            return [];
        }

        $published = $this->published($wanted, $date);
        $out = [];

        foreach ($wanted as $code) {
            if (isset($published[$code])) {
                [$day, $buy, $sell] = $published[$code];
                $out[] = new FxRate($code, $sell, $date, FxPublication::source('BCRP', $day, $date), $buy, $sell);
            }
        }

        return $out;
    }

    public function healthcheck(): AdapterResult
    {
        try {
            $published = $this->published(['USD'], Carbon::now('America/Lima')->toDateString());
        } catch (RuntimeException $e) {
            return AdapterResult::transient($e->getMessage());
        }

        if (! isset($published['USD'])) {
            return AdapterResult::permanent('El BCRP respondió, pero no publicó el dólar en los últimos '.self::LOOKBACK_DAYS.' días.');
        }

        [$day, $buy, $sell] = $published['USD'];

        return AdapterResult::success('ok', null, ['simulated' => false, 'currency' => 'USD', 'date' => $day, 'buy' => $buy, 'sell' => $sell]);
    }

    private function published(array $codes, string $date): array
    {
        $codes = array_values($codes);
        $series = [];

        foreach ($codes as $code) {
            $series[] = self::SERIES[$code]['buy'];
            $series[] = self::SERIES[$code]['sell'];
        }

        $end = Carbon::parse($date);
        $url = sprintf('%s/%s/json/%s/%s/esp', self::ENDPOINT, implode('-', $series), $end->copy()->subDays(self::LOOKBACK_DAYS)->toDateString(), $end->toDateString());

        try {
            $response = Http::timeout(15)->acceptJson()->get($url);
        } catch (ConnectionException) {
            throw new RuntimeException('No pudimos comunicarnos con el BCRP. Inténtalo de nuevo en unos minutos.');
        }

        $periods = $response->successful() ? $response->json('periods') : null;

        if (! is_array($periods)) {
            throw new RuntimeException('El BCRP no devolvió la serie del tipo de cambio (HTTP '.$response->status().').');
        }

        $found = [];

        foreach ($periods as $period) {
            $day = $this->day((string) ($period['name'] ?? ''));
            $values = (array) ($period['values'] ?? []);

            if ($day === null || $day > $end->toDateString()) {
                continue;
            }

            foreach ($codes as $index => $code) {
                $buy = FxPublication::rate($values[$index * 2] ?? null);
                $sell = FxPublication::rate($values[$index * 2 + 1] ?? null);

                if ($buy !== null && $sell !== null) {
                    $found[$code] = [$day, $buy, $sell];
                }
            }
        }

        return $found;
    }

    private function day(string $name): ?string
    {
        if (preg_match('/^(\d{1,2})\.([A-Za-z]{3})\.(\d{2})$/', trim($name), $match) !== 1) {
            return null;
        }

        $month = self::MONTHS[strtolower($match[2])] ?? null;

        return $month === null ? null : sprintf('20%s-%02d-%02d', $match[3], $month, (int) $match[1]);
    }
}
