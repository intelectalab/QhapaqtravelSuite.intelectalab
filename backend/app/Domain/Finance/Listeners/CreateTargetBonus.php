<?php

declare(strict_types=1);

namespace App\Domain\Finance\Listeners;

use App\Domain\Crm\Events\SalesTargetClosed;
use App\Domain\Finance\Actions\TargetBonusCommission;

final class CreateTargetBonus
{
    public function __construct(private readonly TargetBonusCommission $bonus) {}

    public function handle(SalesTargetClosed $event): void
    {
        $this->bonus->create($event->targetId, $event->actorId);
    }
}
