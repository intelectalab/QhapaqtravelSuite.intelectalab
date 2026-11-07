<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\EmailNotifications;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class NotifyUpcomingTrips extends TenantJob
{
    public const QUEUE = 'notifications';

    private const EVENT = 'viaje.proximo';

    protected function run(): string
    {
        $notifications = app(EmailNotifications::class);

        if (! $notifications->enabled(self::EVENT)) {
            return $this->warn('El aviso de viaje próximo está desactivado en Notificaciones');
        }

        $today = $this->today();
        $until = $today->addHours($this->setting('operations', 'trip_notice_hours', 48));
        $rows = DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.owner_id')
            ->whereIn('r.status', ['confirmada', 'pendiente_pago'])
            ->whereNull('r.deleted_at')
            ->whereBetween('r.travel_from', [$today->toDateString(), $until->toDateString()])
            ->whereNotExists(fn ($query) => $query->from('notif_messages as m')->whereColumn('m.reservation_id', 'r.id')->where('m.event_code', self::EVENT))
            ->get(['r.id', 'r.code', 'r.client_id', 'r.travel_from', 'c.name', 'c.email', 'u.name as owner_name']);

        $sent = 0;
        $missing = 0;

        foreach ($rows as $row) {
            $queued = $notifications->queue(self::EVENT, (string) $row->email, [
                'cliente' => (string) $row->name,
                'reserva' => (string) $row->code,
                'fecha_viaje' => CarbonImmutable::parse((string) $row->travel_from)->format('d/m/Y'),
                'vendedor' => (string) ($row->owner_name ?? ''),
            ], ['source_type' => 'booking_reservation', 'source_id' => $row->id, 'client_id' => $row->client_id, 'reservation_id' => $row->id]);

            $queued === null ? $missing++ : $sent++;
        }

        $result = $sent === 0 ? 'Sin viajes próximos por avisar' : self::plural($sent, 'aviso en cola', 'avisos en cola');

        return $missing > 0 ? $this->warn($result.' · '.self::plural($missing, 'cliente sin correo', 'clientes sin correo')) : $result;
    }
}
