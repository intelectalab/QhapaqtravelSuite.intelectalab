<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\EmailNotifications;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class RemindTravelDocuments extends TenantJob
{
    public const QUEUE = 'notifications';

    private const EVENT = 'documentos.recordatorio';

    public const CODE = 'JOB-11';

    public const DEFAULT_DAYS = [15, 7, 3];

    protected function run(): string
    {
        $notifications = app(EmailNotifications::class);
        $today = $this->today();
        $days = $this->reminderDays();
        $rows = DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.owner_id')
            ->whereNotIn('r.status', ['borrador', 'cancelada', 'completada'])
            ->whereNull('r.deleted_at')
            ->whereBetween('r.travel_from', [$today->toDateString(), $today->addDays(max($days))->toDateString()])
            ->whereExists(fn ($query) => $query->from('ops_travel_doc_items as i')->whereColumn('i.reservation_id', 'r.id')->whereIn('i.status', ['pendiente', 'observado']))
            ->whereNotExists(fn ($query) => $query->from('ops_travel_doc_reminders as m')->whereColumn('m.reservation_id', 'r.id')->where('m.trigger', 'auto')->where('m.sent_on', $today->toDateString()))
            ->get(['r.id', 'r.code', 'r.client_id', 'r.travel_from', 'c.name', 'c.email', 'u.name as owner_name']);

        $sent = 0;

        foreach ($rows as $row) {
            $left = (int) $today->diffInDays(CarbonImmutable::parse((string) $row->travel_from)->startOfDay());

            if (! in_array($left, $days, true) && $left > min($days)) {
                continue;
            }

            $pending = DB::table('ops_travel_doc_items')->where('reservation_id', $row->id)->whereIn('status', ['pendiente', 'observado'])->count();
            $messageId = $notifications->queue(self::EVENT, (string) $row->email, [
                'cliente' => (string) $row->name,
                'reserva' => (string) $row->code,
                'fecha_viaje' => CarbonImmutable::parse((string) $row->travel_from)->format('d/m/Y'),
                'enlace' => rtrim((string) config('app.frontend_url'), '/').'/portal',
                'vendedor' => (string) ($row->owner_name ?? ''),
            ], ['source_type' => 'booking_reservation', 'source_id' => $row->id, 'client_id' => $row->client_id, 'reservation_id' => $row->id]);

            if ($messageId === null) {
                continue;
            }

            DB::table('ops_travel_doc_reminders')->insert([
                'reservation_id' => $row->id,
                'channels' => 'Email',
                'recipient' => mb_substr((string) $row->email, 0, 190),
                'trigger' => 'auto',
                'days_before' => $left,
                'items_count' => $pending,
                'notification_ids' => '{'.$messageId.'}',
            ]);
            $sent++;
        }

        return $sent === 0 ? 'Sin recordatorios de documentos para hoy' : self::plural($sent, 'recordatorio en cola', 'recordatorios en cola');
    }

    private function reminderDays(): array
    {
        $values = (array) json_decode((string) DB::table('sys_settings')->where('section', 'travel_docs')->value('values'), true);
        $days = array_values(array_filter(array_map('intval', (array) ($values['reminder_days'] ?? [])), fn (int $day): bool => $day >= 0));

        return $days === [] ? self::DEFAULT_DAYS : $days;
    }
}
