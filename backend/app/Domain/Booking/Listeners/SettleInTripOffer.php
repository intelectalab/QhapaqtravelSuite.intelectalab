<?php

declare(strict_types=1);

namespace App\Domain\Booking\Listeners;

use App\Domain\Booking\Actions\InTripOffers;
use App\Domain\Finance\Events\PaymentApplied;
use Illuminate\Support\Facades\DB;

final class SettleInTripOffer
{
    public function __construct(private readonly InTripOffers $offers) {}

    public function handle(PaymentApplied $event): void
    {
        $receivable = DB::table('fin_payments')->where('id', $event->paymentId)->value('receivable_id');
        if ($receivable === null) {
            return;
        }
        $offer = DB::table('booking_in_trip_offers as o')->join('fin_payment_links as l', 'l.id', '=', 'o.payment_link_id')
            ->where('l.receivable_id', $receivable)->where('o.status', 'link_enviado')->value('o.id');
        if ($offer === null) {
            return;
        }
        $this->offers->paid((string) $offer, $event->paymentId);
        $this->offers->confirm((string) $offer, $event->actorId);
    }
}
