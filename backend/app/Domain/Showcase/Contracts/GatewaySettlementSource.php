<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Contracts;

use App\Domain\Showcase\Fake\FakeGatewaySettlementSource;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakeGatewaySettlementSource::class)]
interface GatewaySettlementSource
{
    public function settlement(object $account, array $pending): array;
}
