<?php

declare(strict_types=1);

namespace App\Domain\Finance\Listeners;

use App\Domain\Finance\Actions\TreasurySync;
use App\Domain\Finance\Events\PaymentApplied;
use App\Domain\Finance\Events\PaymentConfirmed;
use App\Domain\Finance\Events\PaymentReverted;
use App\Domain\Finance\Events\SupplierPaymentRegistered;

final class TreasurySyncListener
{
    public const EVENTS = [PaymentConfirmed::class, PaymentApplied::class, PaymentReverted::class, SupplierPaymentRegistered::class];

    public function __construct(private readonly TreasurySync $sync) {}

    public function handle(PaymentConfirmed|PaymentApplied|PaymentReverted|SupplierPaymentRegistered $event): void
    {
        match (true) {
            $event instanceof SupplierPaymentRegistered => $this->sync->payout($event->payoutId, $event->actorId),
            $event instanceof PaymentReverted => $this->sync->reversal($event->paymentId, $event->actorId),
            default => $this->sync->payment($event->paymentId, $event->actorId),
        };
    }
}
