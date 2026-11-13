<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\SupplierPortal\Support\SupplierNotices;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OpsMail
{
    public function __construct(private readonly StaffNotices $notices) {}

    public function voucher(string $voucherId, string $kind, ?string $reason = null): int
    {
        $voucher = DB::table('ops_vouchers as v')->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')->leftJoin('catalog_providers as p', 'p.id', '=', 'v.provider_id')
            ->where('v.id', $voucherId)->first(['v.id', 'v.code', 'v.version', 'v.service_label', 'v.service_date', 'v.pax', 'v.reservation_id', 'r.code as reservation', 'r.client_id', 'c.name as client', 'c.email as client_email', 'v.provider_id', 'p.name as provider', 'p.email as provider_email']);

        if ($voucher === null) {
            return 0;
        }

        $agency = $this->notices->agency();
        $date = Carbon::parse($voucher->service_date)->format('d/m/Y');
        $line = "{$voucher->service_label} · {$date} · {$voucher->pax} pax · reserva {$voucher->reservation}";
        $sent = 0;
        [$event, $clientSubject, $providerSubject] = match ($kind) {
            'issued' => ['voucher.emitido', "Tu voucher {$voucher->code} · {$agency}", "Voucher {$voucher->code} emitido · {$agency}"],
            'updated' => ['voucher.actualizado', "Actualizamos tu voucher {$voucher->code} · {$agency}", "Voucher {$voucher->code} actualizado (v{$voucher->version}) · {$agency}"],
            default => ['voucher.anulado', '', "Voucher {$voucher->code} anulado · {$agency}"],
        };
        $link = ['client_id' => $voucher->client_id, 'reservation_id' => $voucher->reservation_id];

        if ($kind !== 'voided') {
            $body = "Hola, {$voucher->client}:\n\n".($kind === 'issued' ? 'Ya está listo tu voucher' : 'Actualizamos tu voucher')." {$voucher->code}.\n{$line}".($reason ? "\nMotivo: {$reason}" : '')."\n\nLo encuentras en tu portal y en la app con el código QR.\n\n{$agency}";
            $sent += $this->notices->email($voucher->client_email, $event, $clientSubject, $body, 'ops_voucher', $voucher->id, 'client', $link) ? 1 : 0;
        }

        $verb = match ($kind) {
            'issued' => 'Emitimos el voucher',
            'updated' => "Actualizamos el voucher a la versión {$voucher->version}",
            default => 'Anulamos el voucher',
        };
        $body = "Hola, {$voucher->provider}:\n\n{$verb} {$voucher->code}.\n{$line}".($reason ? "\nMotivo: {$reason}" : '')."\n\nPuedes verlo en la extranet de proveedores.\n\n{$agency}";
        $portalTitle = match ($kind) {
            'issued' => "Voucher {$voucher->code} emitido",
            'updated' => "Voucher {$voucher->code} actualizado a la versión {$voucher->version}",
            default => "Voucher {$voucher->code} anulado",
        };
        app(SupplierNotices::class)->toProvider($voucher->provider_id, $event, $portalTitle, $line.($reason ? " · Motivo: {$reason}" : ''), 'ops_voucher', (string) $voucher->id, (string) $voucher->reservation_id);

        return $sent + ($this->notices->email($voucher->provider_email, $event, $providerSubject, $body, 'ops_voucher', $voucher->id, 'provider', ['reservation_id' => $voucher->reservation_id]) ? 1 : 0);
    }

    public function rooming(string $listId): ?string
    {
        $list = DB::table('ops_rooming_lists as l')->join('booking_reservations as r', 'r.id', '=', 'l.reservation_id')->leftJoin('catalog_providers as p', 'p.id', '=', 'l.hotel_provider_id')
            ->where('l.id', $listId)->first(['l.id', 'l.reservation_id', 'l.hotel_name', 'l.check_in', 'l.check_out', 'l.sent_version', 'l.hotel_provider_id', 'r.code as reservation', 'p.name as provider', 'p.email']);

        if ($list === null) {
            return null;
        }

        $guests = DB::table('ops_rooming_guests as g')->join('booking_passengers as b', 'b.id', '=', 'g.passenger_id')->where('g.rooming_list_id', $listId)->get(['g.room_id', 'b.full_name'])->groupBy('room_id');
        $rooms = DB::table('ops_rooming_rooms')->where('rooming_list_id', $listId)->orderBy('room_number')->get(['id', 'room_number', 'room_type'])
            ->map(fn (object $room): string => "Habitación {$room->room_number} ({$room->room_type}): ".collect($guests[$room->id] ?? [])->pluck('full_name')->implode(', '));
        $agency = $this->notices->agency();
        $hotel = $list->hotel_name ?: $list->provider;
        $body = "Hola, {$hotel}:\n\nTe enviamos la rooming list de la reserva {$list->reservation} (versión {$list->sent_version}).\nIngreso: ".Carbon::parse($list->check_in)->format('d/m/Y').' · Salida: '.Carbon::parse($list->check_out)->format('d/m/Y')."\n\n".$rooms->implode("\n")."\n\nConfírmanos la recepción en la extranet de proveedores.\n\n{$agency}";

        app(SupplierNotices::class)->toProvider($list->hotel_provider_id, 'rooming.enviado', ((int) $list->sent_version > 1 ? 'Rooming list reenviada' : 'Nueva rooming list')." · reserva {$list->reservation}", 'Versión '.$list->sent_version.' · ingreso '.Carbon::parse($list->check_in)->format('d/m/Y').' · '.$rooms->count().' '.($rooms->count() === 1 ? 'habitación' : 'habitaciones').'. Acuse recibo y confirme las habitaciones.', 'ops_rooming_list', (string) $list->id, (string) $list->reservation_id);

        return $this->notices->email($list->email, 'rooming.enviado', "Rooming list {$list->reservation} · {$agency}", $body, 'ops_rooming_list', $list->id, 'provider', ['reservation_id' => $list->reservation_id]);
    }
}
