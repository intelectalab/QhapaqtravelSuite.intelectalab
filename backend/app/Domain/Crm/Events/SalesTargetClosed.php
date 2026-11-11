<?php

declare(strict_types=1);

namespace App\Domain\Crm\Events;

use Illuminate\Foundation\Events\Dispatchable;

final class SalesTargetClosed
{
    use Dispatchable;

    public function __construct(public readonly string $targetId, public readonly ?string $actorId = null) {}
}
