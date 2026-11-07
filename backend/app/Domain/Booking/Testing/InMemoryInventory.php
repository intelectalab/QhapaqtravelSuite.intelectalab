<?php

declare(strict_types=1);

namespace App\Domain\Booking\Testing;

use App\Domain\Booking\Contracts\InventoryReader;

final class InMemoryInventory implements InventoryReader
{
    public function __construct(private array $sold = [], private array $held = []) {}

    public static function fromReservations(array $reservations): self
    {
        $sold = [];
        foreach ($reservations as $r) {
            if (in_array($r['status'] ?? '', ['cancelada', 'borrador'], true)) {
                continue;
            }
            $paxNoInf = count(array_filter((array) ($r['passengers'] ?? []), fn (array $x) => ($x['type'] ?? 'ADT') !== 'INF'));
            foreach ((array) ($r['services'] ?? []) as $s) {
                if (($s['status'] ?? '') === 'cancelado' || ! isset($s['productId'], $s['date'])) {
                    continue;
                }
                $key = $s['productId'].'|'.$s['date'];
                $sold[$key] = ($sold[$key] ?? 0) + (int) ($s['pax'] ?? ($paxNoInf ?: 1));
            }
        }

        return new self($sold);
    }

    public function hold(string $productId, string $date, int $qty): void
    {
        $this->held[$productId.'|'.$date] = ($this->held[$productId.'|'.$date] ?? 0) + $qty;
    }

    public function soldOn(string $productId, string $date): int
    {
        return $this->sold[$productId.'|'.$date] ?? 0;
    }

    public function heldOn(string $productId, string $date): int
    {
        return $this->held[$productId.'|'.$date] ?? 0;
    }
}
