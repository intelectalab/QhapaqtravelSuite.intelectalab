<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\EmailNotifications;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class SendPaymentReminders extends TenantJob
{
    public const QUEUE = 'notifications';

    private const EVENT = 'pago.recordatorio';

    protected function run(): string
    {
        $notifications = app(EmailNotifications::class);

        if (! $notifications->enabled(self::EVENT)) {
            return $this->warn('El recordatorio de pago está desactivado en Notificaciones');
        }

        $today = $this->today();
        $limit = $today->addDays($this->setting('operations', 'pay_reminder_days', 3));
        $rows = DB::table('fin_receivables as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'r.reservation_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'b.owner_id')
            ->whereIn('r.status', ['abierta', 'parcial', 'vencida'])
            ->where('r.due_date', '<=', $limit->toDateString())
            ->where(fn ($query) => $query->whereNull('r.last_reminder_at')->orWhere('r.last_reminder_at', '<', $today))
            ->orderBy('r.due_date')
            ->lock('for update of r')
            ->get(['r.id', 'r.code', 'r.amount', 'r.paid_amount', 'r.currency', 'r.client_id', 'r.reservation_id', 'c.name as client_name', 'c.email', 'b.code as reservation_code', 'b.travel_from', 'u.name as owner_name']);

        $sent = 0;
        $missing = 0;

        foreach ($rows as $row) {
            $pending = BigDecimal::of((string) $row->amount)->minus((string) $row->paid_amount);

            if (! $pending->isPositive()) {
                continue;
            }

            $queued = $notifications->queue(self::EVENT, (string) $row->email, [
                'cliente' => (string) $row->client_name,
                'reserva' => (string) ($row->reservation_code ?? $row->code),
                'monto' => Decimal::display($pending, (string) $row->currency),
                'fecha_viaje' => $row->travel_from ? CarbonImmutable::parse((string) $row->travel_from)->format('d/m/Y') : '',
                'vendedor' => (string) ($row->owner_name ?? ''),
            ], ['source_type' => 'fin_receivable', 'source_id' => $row->id, 'client_id' => $row->client_id, 'reservation_id' => $row->reservation_id]);

            if ($queued === null) {
                $missing++;

                continue;
            }

            DB::table('fin_receivables')->where('id', $row->id)->update(['last_reminder_at' => now(), 'updated_at' => now()]);
            $sent++;
        }

        $result = $sent === 0 ? 'Sin cobros por recordar' : self::plural($sent, 'recordatorio en cola', 'recordatorios en cola');

        return $missing > 0 ? $this->warn($result.' · '.self::plural($missing, 'cliente sin correo', 'clientes sin correo')) : $result;
    }
}
