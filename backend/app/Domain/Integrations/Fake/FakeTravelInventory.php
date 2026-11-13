<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\TravelInventory;
use App\Domain\Integrations\Data\AdapterResult;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;

final class FakeTravelInventory implements TravelInventory
{
    private const PROVIDERS = ['aereo' => 'amadeus', 'hotel' => 'hotelbeds', 'auto' => 'otro', 'seguro' => 'otro'];

    private const CARRIERS = ['LATAM', 'Sky Airline', 'JetSMART'];

    private const HOTELS = ['Casa Andina Premium', 'Tierra Viva', 'Novotel', 'Costa del Sol'];

    private const CARS = ['Hertz · SUV 4x4', 'Budget · sedán', 'Avis · camioneta 7 plazas'];

    private const INSURERS = ['Assist Card · Plan Viajero', 'Rimac · Viaje Seguro', 'Universal Assistance · Classic'];

    private const BASE = ['aereo' => 180, 'hotel' => 95, 'auto' => 60, 'seguro' => 18];

    private const MARKUP = '1.12';

    public function search(array $criteria): array
    {
        $kind = (string) $criteria['kind'];

        return array_map(fn (int $index) => $this->offer($kind, $criteria, $index), [0, 1, 2]);
    }

    public function find(string $provider, string $offerRef): ?array
    {
        if (preg_match('/^SBX-([a-z]+)-(\d)-([A-Za-z0-9_-]+)$/', $offerRef, $match) !== 1 || ! isset(self::PROVIDERS[$match[1]])) {
            return null;
        }

        $criteria = json_decode((string) base64_decode(strtr($match[3], '-_', '+/')), true);

        if (! is_array($criteria)) {
            return null;
        }

        $expanded = ['kind' => $match[1], 'origin' => $criteria['o'] ?? '', 'destination' => $criteria['d'] ?? '', 'date_from' => $criteria['f'] ?? '', 'date_to' => $criteria['t'] ?? '', 'pax' => (int) ($criteria['p'] ?? 1), 'currency' => $criteria['c'] ?? 'USD'];
        $offer = $this->offer($match[1], $expanded, (int) $match[2]);

        return $offer['provider'] === $provider ? $offer : null;
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }

    private function offer(string $kind, array $criteria, int $index): array
    {
        $compact = ['o' => (string) ($criteria['origin'] ?? ''), 'd' => (string) $criteria['destination'], 'f' => (string) $criteria['date_from'], 't' => (string) ($criteria['date_to'] ?? ''), 'p' => (int) $criteria['pax'], 'c' => (string) $criteria['currency']];
        $ref = 'SBX-'.$kind.'-'.$index.'-'.rtrim(strtr(base64_encode((string) json_encode($compact)), '+/', '-_'), '=');
        $seed = crc32($ref);
        $nights = max(1, $compact['t'] !== '' ? (int) Carbon::parse($compact['f'])->diffInDays(Carbon::parse($compact['t'])) : 1);
        $units = match ($kind) {
            'hotel', 'auto' => $nights,
            default => 1,
        };
        $unit = BigDecimal::of(self::BASE[$kind] + ($seed % 60) + $index * 15);
        $net = $unit->multipliedBy($units)->multipliedBy($kind === 'auto' ? 1 : $compact['p']);
        $net = $compact['c'] === 'PEN' ? $net->multipliedBy('3.75') : $net;
        $net = $net->toScale(2, RoundingMode::HALF_UP);
        $sell = $net->multipliedBy(self::MARKUP)->toScale(2, RoundingMode::HALF_UP);
        $label = match ($kind) {
            'aereo' => self::CARRIERS[$index % 3].' · '.mb_strtoupper(mb_substr($compact['o'] ?: 'LIM', 0, 3)).' → '.mb_strtoupper(mb_substr($compact['d'], 0, 3)).' · '.Carbon::parse($compact['f'])->format('d/m').' '.sprintf('%02d:%02d', 6 + ($seed % 12), ($seed % 4) * 15),
            'hotel' => self::HOTELS[($seed + $index) % 4].' '.$compact['d'].' · '.$nights.' '.($nights === 1 ? 'noche' : 'noches').' · '.($index === 2 ? 'suite' : 'doble'),
            'auto' => self::CARS[$index % 3].' · '.$nights.' '.($nights === 1 ? 'día' : 'días'),
            default => self::INSURERS[$index % 3].' · '.$compact['p'].' pax',
        };

        return [
            'provider' => self::PROVIDERS[$kind],
            'kind' => $kind,
            'offer_ref' => $ref,
            'summary' => $label,
            'net_amount' => (string) $net,
            'sell_amount' => (string) $sell,
            'currency' => $compact['c'],
            'offer_expires_at' => now()->addMinutes($kind === 'aereo' ? 30 : 24 * 60)->toIso8601String(),
            'payload' => ['criteria' => $compact, 'units' => $units, 'refundable' => $index !== 0, 'simulated' => true],
        ];
    }
}
