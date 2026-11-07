<?php

declare(strict_types=1);

namespace App\Domain\Booking\Contracts;

use App\Domain\Booking\Data\BookingQuote;
use App\Domain\Booking\Data\DayStatus;
use App\Domain\Booking\Data\PaxValidation;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\QuoteSelection;

interface BookingEngineInterface
{
    public function dayStatus(ProductData $product, string $date, int $seats = 0): DayStatus;

    public function month(ProductData $product, int $year, int $month, int $seats = 0): array;

    public function nextAvailable(ProductData $product, int $seats, ?string $from = null): ?string;

    public function validatePax(ProductData $product, array $pax): PaxValidation;

    public function ageType(ProductData $product, ?int $age): string;

    public function quote(ProductData $product, QuoteSelection $selection): BookingQuote;
}
