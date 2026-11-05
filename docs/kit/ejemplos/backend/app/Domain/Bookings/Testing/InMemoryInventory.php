<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Testing;

use App\Domain\Bookings\Contracts\InventoryReader;

/**
 * Ocupación en memoria para pruebas unitarias del motor (kit-ia/tests/pest/Unit/Booking/BookingEngineQuoteTest.php):
 *   InMemoryInventory::fromReservations(json_decode(file_get_contents('…/reservations.json'), true))
 * Replica `BE.soldOn` del prototipo: reservas ≠ cancelada/borrador, servicios ≠ cancelado del producto en la fecha;
 * pax del servicio o, si falta, pasajeros no infantes.
 */
final class InMemoryInventory implements InventoryReader
{
    /**
     * @param  array<string, int>  $sold  "{productId}|{fecha}" → pax
     * @param  array<string, int>  $held
     */
    public function __construct(private array $sold = [], private array $held = [])
    {
    }

    /** @param list<array<string, mixed>> $reservations formato de kit-ia/seeds/reservations.json */
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
