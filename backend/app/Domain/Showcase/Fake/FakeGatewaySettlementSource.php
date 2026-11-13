<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Fake;

use App\Domain\Showcase\Contracts\GatewaySettlementSource;
use Illuminate\Support\Carbon;

final class FakeGatewaySettlementSource implements GatewaySettlementSource
{
    public function settlement(object $account, array $pending): array
    {
        return array_map(fn (array $fee): array => [
            'payment_id' => $fee['payment_id'],
            'external_ref' => 'STL-'.strtoupper(substr(hash('sha256', $account->id.'|'.$fee['payment_id']), 0, 10)),
            'fee' => $fee['fee'],
            'fee_tax' => $fee['fee_tax'],
            'fx_spread' => $fee['fx_spread'],
            'settled_on' => Carbon::parse($fee['created_at'])->addDays((int) $account->settle_days)->toDateString(),
        ], $pending);
    }
}
