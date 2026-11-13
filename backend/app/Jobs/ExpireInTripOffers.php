<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Booking\Actions\InTripOffers;

final class ExpireInTripOffers extends TenantJob
{
    public const QUEUE = 'default';

    protected function run(): string
    {
        $expired = app(InTripOffers::class)->expire();

        return $expired === 0 ? 'Sin ofertas en ruta vencidas' : self::plural($expired, 'oferta en ruta vencida', 'ofertas en ruta vencidas');
    }
}
