<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Contracts;

/**
 * Lectura de ocupación para el motor (spec 16 §8.1 `AvailabilityCalculator::sold()/held()`).
 * Producción: consulta `booking_reservation_services` (no cancelados, de reservas ≠ borrador/cancelada) y
 * `catalog_availability_holds` vigentes (status = 'hold' y expires_at > now()). Pruebas: InMemoryInventory.
 */
interface InventoryReader
{
    /** Pasajeros vendidos del producto en la fecha (sin infantes que no ocupan asiento). */
    public function soldOn(string $productId, string $date): int;

    /** Cupos retenidos por holds vigentes del producto en la fecha. */
    public function heldOn(string $productId, string $date): int;
}
