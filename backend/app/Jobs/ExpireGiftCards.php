<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Finance\Actions\GiftCards;
use Illuminate\Support\Facades\DB;

final class ExpireGiftCards extends TenantJob
{
    public const QUEUE = 'default';

    protected function run(): string
    {
        $due = fn (): int => DB::table('fin_gift_cards')->where('status', 'activa')->where('expires_at', '<', $this->today()->toDateString())->count();
        $before = $due();

        for ($round = 0; $round < 50 && $due() > 0; $round++) {
            app(GiftCards::class)->expireDue();
        }

        return $before === 0 ? 'Sin vales por vencer' : self::plural($before, 'vale vencido', 'vales vencidos');
    }
}
