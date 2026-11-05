<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Http\Resources;

use App\Domain\Bookings\Enums\ReservationStatus;
use App\Domain\Bookings\Models\Reservation;
use App\Domain\Bookings\Models\ReservationService;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Http\Resources\RevealsSensitiveAmounts;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Brick\Money\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Representación de `booking_reservations` según `components.schemas.BookingReservation` del contrato.
 *
 * - Montos como string decimal con 2 decimales + `currency` (CONVENCIONES §3; `toBeMoney` en Pest).
 * - `status_label` en español para el frontend (StatusBadge usa `status` para el color y `status_label` para el texto).
 * - Servicios (`?include=services`): costo solo con permiso; margen solo con permiso de rentabilidad (SEC-BR-13).
 * - Ownership/alcance se resuelve antes (Policy/scope): el Resource no decide QUÉ reservas se ven, solo QUÉ campos.
 *
 * @mixin Reservation
 */
final class ReservationResource extends JsonResource
{
    use RevealsSensitiveAmounts;

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Reservation $r */
        $r = $this->resource;

        return [
            'id' => $r->id,
            'code' => $r->code,
            'quote_id' => $r->quote_id,
            'quote_version_id' => $r->quote_version_id,
            'quote_version_no' => $r->quote_version_no,
            'client_id' => $r->client_id,
            'agency_id' => $r->agency_id,
            'owner_id' => $r->owner_id,
            'sede_id' => $r->sede_id,
            'title' => $r->title,
            'status' => $r->status,
            'status_label' => ReservationStatus::tryFrom((string) $r->status)?->label(),
            'channel' => $r->channel,
            'travel_from' => $r->travel_from?->toDateString(),
            'travel_to' => $r->travel_to?->toDateString(),
            'currency' => $r->currency,
            'fx_rate' => $r->fx_rate === null ? null : (string) $r->fx_rate,
            'total_amount' => self::amount($r->total_amount),
            'snapshot_label' => $r->snapshot_label,
            'policies_snapshot' => $r->policies_snapshot,
            'notes' => $r->notes,
            'rescheduled_at' => $r->rescheduled_at?->toIso8601String(),
            'cancelled_at' => $r->cancelled_at?->toIso8601String(),
            'cancel_reason' => $r->cancel_reason,
            'penalty_amount' => self::amount($r->penalty_amount),
            'refund_amount' => self::amount($r->refund_amount),
            'lock_version' => (int) $r->lock_version,
            'services' => $this->whenLoaded('services', fn () => $r->services->map(
                fn (ReservationService $s) => $this->service($s, $request),
            )->values()->all()), // array (no Collection) para que JsonResource filtre when/mergeWhen anidados
        ];
    }

    /** @return array<string, mixed> */
    private function service(ReservationService $s, Request $request): array
    {
        $price = $s->price_amount instanceof Money ? $s->price_amount->getAmount() : BigDecimal::zero();
        $cost = $s->cost_amount instanceof Money ? $s->cost_amount->getAmount() : BigDecimal::zero();

        return [
            'id' => $s->id,
            'code' => $s->code,
            'name' => $s->name,
            'service_date' => $s->service_date?->toDateString(),
            'service_time' => $s->service_time === null ? null : substr((string) $s->service_time, 0, 5),
            'pax' => $s->pax,
            'status' => $s->status,
            'provider_id' => $s->provider_id,
            'currency' => $s->currency,
            'price_amount' => self::amount($s->price_amount),
            // Campos sensibles: AUSENTES (no null) si el rol no puede verlos.
            'cost_amount' => $this->when($this->canSeeCosts($request), fn () => self::amount($s->cost_amount)),
            $this->mergeWhen($this->canSeeMargins($request), fn () => [
                'profit_amount' => (string) $price->minus($cost)->toScale(2),
                'margin_pct' => $price->isZero() ? null : (string) $price->minus($cost)->multipliedBy(100)->dividedBy($price, 2, RoundingMode::HALF_UP),
            ]),
        ];
    }

    private static function amount(?Money $money): ?string
    {
        return $money === null ? null : (string) $money->getAmount()->toScale(2);
    }

    /** ETag = lock_version: el frontend lo reenvía en If-Match (CONVENCIONES §3). */
    public function withResponse(Request $request, $response): void
    {
        $response->headers->set('ETag', IfMatch::etag((int) $this->resource->lock_version));
    }
}
