<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Finance\Actions\GiftCards;

final class DeliverGiftCards extends TenantJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $sent = app(GiftCards::class)->deliverDue();

        return $sent === 0 ? 'Sin vales por enviar' : self::plural($sent, 'vale enviado', 'vales enviados');
    }
}
