<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Contracts;

use App\Domain\Bookings\Data\BookingQuote;
use App\Domain\Bookings\Data\DayStatus;
use App\Domain\Bookings\Data\PaxValidation;
use App\Domain\Bookings\Data\ProductData;
use App\Domain\Bookings\Data\QuoteSelection;

/**
 * ÚNICA fuente de disponibilidad, reglas de pasajeros, precio, alojamiento, adicionales, pago y moneda
 * (CLAUDE.md backend; spec 16 §8.1; H-13 «una sola función de pricing»). La consumen: sitio público y widget
 * (/public/quote, /public/bookings), portal B2B, cotizador, reserva directa y simulador del Product 360.
 *
 * Firmas alineadas con la plantilla kit-ia/tests/pest/Unit/Booking/BookingEngineQuoteTest.php
 * (la spec 16 §8.1 usa Product/PaxCount/QuoteResult; aquí DTOs puros: ProductData/array/BookingQuote).
 */
interface BookingEngineInterface
{
    public function dayStatus(ProductData $product, string $date, int $seats = 0): DayStatus;

    /** @return list<array{date:string, status:DayStatus}> */
    public function month(ProductData $product, int $year, int $month, int $seats = 0): array;

    /** Primera fecha `disponible` desde $from (máx. 400 días) o null. */
    public function nextAvailable(ProductData $product, int $seats, ?string $from = null): ?string;

    /** @param array{adt:int,chd:int,inf:int} $pax */
    public function validatePax(ProductData $product, array $pax): PaxValidation;

    /** ADT | CHD | INF | NA (edad sin banda: el checkout la rechaza, CAT-PX-01). */
    public function ageType(ProductData $product, ?int $age): string;

    public function quote(ProductData $product, QuoteSelection $selection): BookingQuote;
}
