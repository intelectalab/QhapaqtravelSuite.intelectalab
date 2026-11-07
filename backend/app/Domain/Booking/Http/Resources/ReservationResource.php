<?php

declare(strict_types=1);

namespace App\Domain\Booking\Http\Resources;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\Models\ReservationService;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Http\Resources\RevealsSensitiveAmounts;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Brick\Money\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ReservationResource extends JsonResource
{
    use RevealsSensitiveAmounts;

    public function toArray(Request $request): array
    {
        $reservation = $this->reservation();

        return [
            'id' => $reservation->id,
            'code' => $reservation->code,
            'quote_id' => $reservation->quote_id,
            'quote_version_id' => $reservation->quote_version_id,
            'quote_version_no' => $reservation->quote_version_no,
            'client_id' => $reservation->client_id,
            'agency_id' => $reservation->agency_id,
            'owner_id' => $reservation->owner_id,
            'sede_id' => $reservation->sede_id,
            'title' => $reservation->title,
            'status' => $reservation->status,
            'status_label' => ReservationStatus::tryFrom((string) $reservation->status)?->label(),
            'channel' => $reservation->channel,
            'travel_from' => $reservation->travel_from?->toDateString(),
            'travel_to' => $reservation->travel_to?->toDateString(),
            'currency' => $reservation->currency,
            'fx_rate' => $reservation->fx_rate === null ? null : (string) $reservation->fx_rate,
            'total_amount' => self::amount($reservation->total_amount),
            'snapshot_label' => $reservation->snapshot_label,
            'catalog_snapshot' => $reservation->catalog_snapshot,
            'policies_snapshot' => $reservation->policies_snapshot ?? (object) [],
            'notes' => $reservation->notes,
            'rescheduled_at' => $reservation->rescheduled_at?->toIso8601String(),
            'cancelled_at' => $reservation->cancelled_at?->toIso8601String(),
            'cancel_reason' => $reservation->cancel_reason,
            'penalty_amount' => self::amount($reservation->penalty_amount),
            'refund_amount' => self::amount($reservation->refund_amount),
            'lock_version' => (int) $reservation->lock_version,
            'services' => $this->whenLoaded('services', fn (): array => $this->services($reservation, $request)),
        ];
    }

    public function withResponse(Request $request, $response): void
    {
        $response->headers->set('ETag', IfMatch::etag((int) $this->reservation()->lock_version));
    }

    private function reservation(): Reservation
    {
        return $this->resource;
    }

    private function services(Reservation $reservation, Request $request): array
    {
        $rows = [];

        foreach ($reservation->services as $service) {
            if ($service instanceof ReservationService) {
                $rows[] = $this->service($service, $request);
            }
        }

        return $rows;
    }

    private function service(ReservationService $service, Request $request): array
    {
        $price = $service->price_amount instanceof Money ? $service->price_amount->getAmount() : BigDecimal::zero();
        $cost = $service->cost_amount instanceof Money ? $service->cost_amount->getAmount() : BigDecimal::zero();

        return [
            'id' => $service->id,
            'code' => $service->code,
            'name' => $service->name,
            'service_date' => $service->service_date?->toDateString(),
            'service_time' => $service->service_time === null ? null : substr((string) $service->service_time, 0, 5),
            'pax' => $service->pax,
            'status' => $service->status,
            'provider_id' => $service->provider_id,
            'currency' => $service->currency,
            'price_amount' => self::amount($service->price_amount),
            'cost_amount' => $this->when($this->canSeeCosts($request), fn (): ?string => self::amount($service->cost_amount)),
            $this->mergeWhen($this->canSeeMargins($request), fn (): array => [
                'profit_amount' => (string) $price->minus($cost)->toScale(2),
                'margin_pct' => $price->isZero() ? null : (string) $price->minus($cost)->multipliedBy(100)->dividedBy($price, 2, RoundingMode::HALF_UP),
            ]),
        ];
    }

    private static function amount(?Money $money): ?string
    {
        return $money === null ? null : (string) $money->getAmount()->toScale(2);
    }
}
