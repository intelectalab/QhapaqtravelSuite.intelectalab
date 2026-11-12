<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class RemindPendingSupplierRequests extends TenantJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $now = Carbon::now();
        $soon = $this->today()->addDays(2)->toDateString();
        $pending = DB::table('ops_supplier_requests as q')->join('booking_reservation_services as s', 's.id', '=', 'q.reservation_service_id')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->join('catalog_providers as p', 'p.id', '=', 'q.provider_id')
            ->whereNull('q.deleted_at')->where('q.status', 'solicitado')->where('s.status', '<>', 'cancelado')
            ->where(fn ($query) => $query->where('q.requested_at', '<=', $now->copy()->subDay())->orWhere('s.service_date', '<=', $soon))
            ->get(['q.id', 'p.name as provider', 'p.email', 's.name as service', 's.service_date', 'r.code as reservation']);
        $notices = app(StaffNotices::class);
        $sent = 0;

        foreach ($pending as $request) {
            $already = DB::table('notif_messages')->where('event_code', 'proveedor.recordatorio')->where('source_id', $request->id)->where('created_at', '>=', $this->today())->exists();

            if ($already) {
                continue;
            }

            $sent += $notices->email($request->email, 'proveedor.recordatorio', "Pendiente de confirmar: {$request->service} · {$request->reservation}", "Hola, {$request->provider}:\n\nTe recordamos confirmar o rechazar el servicio {$request->service} del ".Carbon::parse($request->service_date)->format('d/m/Y')." (reserva {$request->reservation}).\n\nResponde desde la extranet de proveedores.\n\n".$notices->agency(), 'ops_supplier_request', (string) $request->id, 'provider') ? 1 : 0;
        }

        return $pending->isEmpty() ? 'Sin solicitudes pendientes de proveedores' : self::plural($pending->count(), 'solicitud pendiente', 'solicitudes pendientes').' · '.self::plural($sent, 'recordatorio', 'recordatorios');
    }
}
