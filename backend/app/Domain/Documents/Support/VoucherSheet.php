<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use Illuminate\Support\Facades\DB;

final class VoucherSheet
{
    public const DOC_TYPE = 'voucher';

    private const STATUS = ['emitido' => 'Vigente', 'utilizado' => 'Utilizado', 'anulado' => 'Anulado'];

    public function __construct(
        private readonly AgencyLetterhead $agency,
        private readonly TravelItinerary $itinerary,
        private readonly ClientParty $parties,
    ) {}

    public function draft(string $voucherId): DocumentDraft
    {
        $voucher = DB::table('ops_vouchers')->where('id', $voucherId)->first() ?? throw new \RuntimeException("Voucher {$voucherId} inexistente.");
        $reservation = DB::table('booking_reservations')->where('id', $voucher->reservation_id)->first(['id', 'code', 'title', 'client_id', 'owner_id']);
        $service = DB::table('booking_reservation_services as s')
            ->leftJoin('catalog_product_departures as d', 'd.id', '=', 's.departure_id')
            ->leftJoin('catalog_products as p', fn ($join) => $join->whereNull('p.deleted_at')->where(fn ($match) => $match->whereColumn('p.id', 's.product_id')->orWhere(fn ($byName) => $byName->whereNull('s.product_id')->whereColumn('p.name', 's.name'))))
            ->where('s.id', $voucher->reservation_service_id)
            ->first(['s.name', 's.service_time', 's.confirmation_code', 'p.id as product_id', 's.service_kind', 'd.meeting_point', 'd.return_point', 'p.modality']);
        $provider = DB::table('catalog_providers')->where('id', $voucher->provider_id)->first(['name', 'type', 'phone', 'email', 'contact_name', 'city']);
        $assignment = DB::table('ops_assignments as a')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as dr', 'dr.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->where('a.reservation_service_id', $voucher->reservation_service_id)
            ->first(['g.full_name as guide', 'g.phone as guide_phone', 'dr.full_name as driver', 'dr.phone as driver_phone', 'v.vehicle_type', 'v.plate']);
        $agency = $this->agency->current();
        $coordinator = DB::table('ops_orders as o')->join('iam_users as u', 'u.id', '=', 'o.coordinator_id')->where('o.reservation_id', $voucher->reservation_id)->where('o.status', '<>', 'cancelada')->orderByDesc('o.created_at')->first(['u.name', 'u.phone']);
        $general = DB::table('sys_settings')->where('section', 'general')->value('values');
        $general = is_string($general) ? (json_decode($general, true) ?: []) : [];
        $emergency = $general['emergency_phone'] ?? $general['phone'] ?? DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->value('phone') ?? $agency['phone'] ?? null;
        $inclusions = $service?->product_id ? $this->itinerary->inclusions(collect([(string) $service->product_id])) : [];
        $passengers = DB::table('booking_passengers')->where('reservation_id', $voucher->reservation_id)->orderByDesc('is_lead')->orderBy('seq')
            ->get(['full_name', 'doc_type', 'doc_number', 'pax_type', 'diet_notes', 'is_lead'])
            ->map(fn (object $row): array => [
                'name' => (string) $row->full_name,
                'type' => DocumentFormat::paxType((string) $row->pax_type),
                'document' => $row->doc_number ? trim("{$row->doc_type} {$row->doc_number}") : null,
                'diet' => $row->diet_notes,
                'lead' => (bool) $row->is_lead,
            ])->values()->all();

        $data = [
            'agency' => $agency,
            'document' => [
                'kind' => 'Voucher de servicio',
                'code' => (string) $voucher->code,
                'reference' => "{$voucher->code} · versión {$voucher->version}",
                'version' => (int) $voucher->version,
                'status' => self::STATUS[$voucher->status] ?? (string) $voucher->status,
                'state' => (string) $voucher->status,
                'issued_at' => DocumentFormat::dateTime((string) $voucher->issued_at, $agency['timezone']),
                'used_at' => $voucher->used_at ? DocumentFormat::dateTime((string) $voucher->used_at, $agency['timezone']) : null,
                'verification' => strtoupper(implode(' ', str_split(substr((string) $voucher->qr_token, 0, 16), 4))),
                'qr' => QrImage::dataUri((string) $voucher->qr_token, 5),
            ],
            'service' => [
                'name' => (string) $voucher->service_label,
                'date' => DocumentFormat::longDate((string) $voucher->service_date),
                'day' => DocumentFormat::dayTitle((string) $voucher->service_date),
                'time' => DocumentFormat::time($service?->service_time),
                'pax' => DocumentFormat::count((int) $voucher->pax, 'pasajero', 'pasajeros'),
                'modality' => $service?->modality,
                'confirmation' => $service?->confirmation_code,
                'meeting' => $service?->meeting_point,
                'return' => $service?->return_point,
                'note' => trim((string) $voucher->note) ?: null,
            ],
            'provider' => [
                'name' => (string) ($provider->name ?? ''),
                'type' => $provider->type ?? null,
                'contact' => $provider->contact_name ?? null,
                'phone' => $provider->phone ?? null,
                'email' => $provider->email ?? null,
            ],
            'crew' => array_values(array_filter([
                $assignment?->guide ? ['label' => 'Guía', 'name' => (string) $assignment->guide, 'phone' => $assignment->guide_phone] : null,
                $assignment?->driver ? ['label' => 'Conductor', 'name' => (string) $assignment->driver, 'phone' => $assignment->driver_phone] : null,
                $assignment?->vehicle_type ? ['label' => 'Vehículo', 'name' => trim("{$assignment->vehicle_type} · placa {$assignment->plate}"), 'phone' => null] : null,
                $coordinator ? ['label' => 'Coordinador', 'name' => (string) $coordinator->name, 'phone' => $coordinator->phone] : null,
            ])),
            'emergency' => $emergency ? (string) $emergency : null,
            'reservation' => ['code' => (string) $reservation->code, 'title' => (string) $reservation->title],
            'client' => $this->parties->client((string) $reservation->client_id),
            'advisor' => $this->parties->advisor((string) $reservation->owner_id),
            'passengers' => $passengers,
            'diets' => array_values(array_filter($passengers, fn (array $row): bool => trim((string) $row['diet']) !== '')),
            'inclusions' => $inclusions[0] ?? null,
        ];

        return new DocumentDraft(self::DOC_TYPE, 'ops_vouchers', (string) $voucher->id, 'documents.voucher', "Voucher {$voucher->code} v{$voucher->version}", "{$voucher->code}-v{$voucher->version}.pdf", $data);
    }
}
