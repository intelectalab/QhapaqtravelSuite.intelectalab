<?php

declare(strict_types=1);

namespace App\Domain\Booking\Contracts;

interface InventoryReader
{
    public function soldOn(string $productId, string $date): int;

    public function heldOn(string $productId, string $date): int;
}
