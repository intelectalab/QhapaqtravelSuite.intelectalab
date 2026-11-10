<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ReservationSheet
{
    public const CONFIRMATION = 'confirmacion_reserva';

    public const ITINERARY = 'itinerario_reserva';

    public function __construct(
        private readonly AgencyLetterhead $agency,
        private readonly TravelItinerary $itinerary,
        private readonly TravelPolicies $policies,
        private readonly ClientParty $parties,
    ) {}

    public function confirmation(string $reservationId): DocumentDraft
    {
        $reservation = $this->reservation($reservationId);
        $currency = (string) $reservation->currency;
        $receivables = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->where('status', '<>', 'cancelada')->orderBy('due_date')
            ->get(['concept', 'amount', 'paid_amount', 'currency', 'due_date', 'status']);
        $paid = $receivables->reduce(fn (BigDecimal $sum, object $row): BigDecimal => $sum->plus((string) $row->paid_amount), BigDecimal::zero());
        $total = Decimal::money((string) $reservation->total_amount);
        $passengers = $this->passengers((string) $reservation->id);

        $data = [
            ...$this->common($reservation, 'Confirmación de reserva'),
            'passengers' => $passengers,
            'missing_passengers' => count(array_filter($passengers, fn (array $row): bool => $row['placeholder'])),
            'services' => $this->services((string) $reservation->id)->map(fn (array $service): array => [
                'date' => DocumentFormat::date($service['date']),
                'time' => $service['time'],
                'name' => $service['title'],
                'status' => DocumentFormat::serviceStatus($service['status']),
                'confirmed' => in_array($service['status'], ['confirmado', 'en_curso', 'completado'], true),
                'confirmation' => $service['confirmation'],
            ])->values()->all(),
            'payment' => [
                'total' => DocumentFormat::money($total, $currency),
                'paid' => DocumentFormat::money($paid, $currency),
                'balance' => DocumentFormat::money(BigDecimal::max($total->minus($paid), BigDecimal::zero()), $currency),
                'schedule' => $receivables->map(fn (object $row): array => [
                    'concept' => (string) $row->concept,
                    'due' => DocumentFormat::date((string) $row->due_date),
                    'amount' => DocumentFormat::money((string) $row->amount, (string) $row->currency),
                    'status' => DocumentFormat::paymentStatus((string) $row->status),
                    'settled' => $row->status === 'pagada',
                ])->values()->all(),
                'currency_note' => $currency === 'USD' ? 'Importes en dólares estadounidenses.' : 'Importes en soles.',
            ],
            'policies' => $this->policies->rows($reservation->policies_snapshot),
        ];

        return new DocumentDraft(self::CONFIRMATION, 'booking_reservations', (string) $reservation->id, 'documents.reservation-confirmation', "Confirmación {$reservation->code}", "{$reservation->code}-confirmacion.pdf", $data);
    }

    public function itinerary(string $reservationId): DocumentDraft
    {
        $reservation = $this->reservation($reservationId);
        $services = $this->services((string) $reservation->id);

        $data = [
            ...$this->common($reservation, 'Itinerario de viaje'),
            'days' => $this->itinerary->days($services->map(fn (array $service): array => [
                'date' => $service['date'],
                'time' => $service['time'],
                'title' => $service['title'],
                'detail' => implode(' · ', array_filter([$service['meeting'] ? "Punto de encuentro: {$service['meeting']}" : null, $service['guide'] ? "Guía: {$service['guide']}" : null, $service['transport']])) ?: null,
                'product_id' => $service['product_id'],
                'status' => DocumentFormat::serviceStatus($service['status']),
                'confirmed' => in_array($service['status'], ['confirmado', 'en_curso', 'completado'], true),
                'reference' => $service['voucher'] ? "Voucher {$service['voucher']}" : ($service['confirmation'] ? "Confirmación {$service['confirmation']}" : null),
            ]), (string) $reservation->travel_from),
            'travellers' => count($this->passengers((string) $reservation->id)),
        ];

        return new DocumentDraft(self::ITINERARY, 'booking_reservations', (string) $reservation->id, 'documents.reservation-itinerary', "Itinerario {$reservation->code}", "{$reservation->code}-itinerario.pdf", $data);
    }

    private function common(object $reservation, string $kind): array
    {
        $agency = $this->agency->current();

        return [
            'agency' => $agency,
            'document' => [
                'kind' => $kind,
                'code' => (string) $reservation->code,
                'reference' => "Reserva {$reservation->code}",
                'status' => DocumentFormat::reservationStatus((string) $reservation->status),
                'updated_on' => DocumentFormat::longDate((string) $reservation->updated_at),
            ],
            'trip' => [
                'title' => (string) $reservation->title,
                'dates' => DocumentFormat::range((string) $reservation->travel_from, (string) $reservation->travel_to),
                'duration' => DocumentFormat::duration((string) $reservation->travel_from, (string) $reservation->travel_to),
                'travellers' => $this->travellers((string) $reservation->id),
            ],
            'client' => $this->parties->client((string) $reservation->client_id),
            'advisor' => $this->parties->advisor((string) $reservation->owner_id),
        ];
    }

    private function reservation(string $id): object
    {
        return DB::table('booking_reservations')->where('id', $id)->first() ?? throw new \RuntimeException("Reserva {$id} inexistente.");
    }

    private function passengers(string $reservationId): array
    {
        return DB::table('booking_passengers')->where('reservation_id', $reservationId)->orderByDesc('is_lead')->orderBy('seq')
            ->get(['seq', 'full_name', 'doc_type', 'doc_number', 'pax_type', 'diet_notes', 'is_placeholder', 'is_lead'])
            ->map(fn (object $row): array => [
                'name' => (string) $row->full_name,
                'type' => DocumentFormat::paxType((string) $row->pax_type),
                'document' => $row->doc_number ? trim("{$row->doc_type} {$row->doc_number}") : null,
                'diet' => $row->diet_notes,
                'lead' => (bool) $row->is_lead,
                'placeholder' => (bool) $row->is_placeholder,
            ])->values()->all();
    }

    private function travellers(string $reservationId): string
    {
        $types = DB::table('booking_passengers')->where('reservation_id', $reservationId)->selectRaw('pax_type, count(*) as total')->groupBy('pax_type')->pluck('total', 'pax_type');

        return DocumentFormat::pax((int) ($types['ADT'] ?? 0), (int) ($types['CHD'] ?? 0), (int) ($types['INF'] ?? 0));
    }

    private function services(string $reservationId): Collection
    {
        $services = DB::table('booking_reservation_services as s')
            ->leftJoin('catalog_product_departures as d', 'd.id', '=', 's.departure_id')
            ->where('s.reservation_id', $reservationId)
            ->where('s.status', '<>', 'cancelado')
            ->whereNull('s.replaced_by_id')
            ->orderBy('s.service_date')->orderByRaw('s.service_time nulls last')->orderBy('s.code')
            ->get(['s.id', 's.name', 's.service_date', 's.service_time', 's.status', 's.confirmation_code', 's.product_id', 'd.meeting_point']);
        $ids = $services->pluck('id');
        $assignments = DB::table('ops_assignments as a')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as dr', 'dr.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->whereIn('a.reservation_service_id', $ids)
            ->get(['a.reservation_service_id', 'g.full_name as guide', 'dr.full_name as driver', 'v.vehicle_type', 'v.plate'])
            ->keyBy('reservation_service_id');
        $vouchers = DB::table('ops_vouchers')->whereIn('reservation_service_id', $ids)->where('status', '<>', 'anulado')->pluck('code', 'reservation_service_id');

        return $services->map(function (object $service) use ($assignments, $vouchers): array {
            $assignment = $assignments->get($service->id);

            return [
                'date' => (string) $service->service_date,
                'time' => DocumentFormat::time($service->service_time),
                'title' => (string) $service->name,
                'status' => (string) $service->status,
                'confirmation' => $service->confirmation_code,
                'product_id' => $service->product_id,
                'meeting' => $service->meeting_point,
                'guide' => $assignment?->guide,
                'transport' => $assignment === null ? null : (implode(' · ', array_filter([
                    $assignment->driver ? "Conductor: {$assignment->driver}" : null,
                    $assignment->vehicle_type ? trim("{$assignment->vehicle_type} {$assignment->plate}") : null,
                ])) ?: null),
                'voucher' => $vouchers[$service->id] ?? null,
            ];
        });
    }
}
