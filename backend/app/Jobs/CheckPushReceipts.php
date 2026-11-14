<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Integrations\Contracts\PushSender;
use App\Domain\Integrations\Support\PushTickets;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class CheckPushReceipts extends TenantJob
{
    public const QUEUE = 'notifications';

    public const WAIT_MINUTES = 15;

    public const EXPIRE_HOURS = 24;

    private const LIMIT = 1000;

    protected function run(): string
    {
        $expired = DB::table('ops_push_tickets')->where('status', 'pendiente')->where('created_at', '<', now()->subHours(self::EXPIRE_HOURS))
            ->update(['status' => 'sin_recibo', 'checked_at' => now()]);
        $tickets = DB::table('ops_push_tickets')->where('status', 'pendiente')->where('created_at', '<=', now()->subMinutes(self::WAIT_MINUTES))
            ->orderBy('created_at')->limit(self::LIMIT)->get(['id', 'device_id', 'ticket_id']);

        if ($tickets->isEmpty()) {
            return self::summary([$expired > 0 ? self::plural($expired, 'ticket sin recibo', 'tickets sin recibo') : null], 'Sin recibos de push por consultar');
        }

        $result = app(PushSender::class)->receipts($tickets->pluck('ticket_id')->all());

        if (! $result->ok) {
            throw new RuntimeException((string) $result->message);
        }

        $receipts = (array) ($result->payload['receipts'] ?? []);
        $delivered = 0;
        $failed = 0;
        $unregistered = [];

        foreach ($tickets as $ticket) {
            $receipt = $receipts[$ticket->ticket_id] ?? null;

            if ($receipt === null) {
                continue;
            }

            $ok = ($receipt['status'] ?? null) === 'ok';
            $error = $ok ? null : mb_substr((string) ($receipt['error'] ?? $receipt['message'] ?? 'Error de Expo'), 0, 120);
            DB::table('ops_push_tickets')->where('id', $ticket->id)->update(['status' => $ok ? 'entregado' : 'error', 'error' => $error, 'checked_at' => now()]);
            $ok ? $delivered++ : $failed++;

            if ($error === PushTickets::UNREGISTERED && $ticket->device_id !== null) {
                $unregistered[] = (string) $ticket->device_id;
            }
        }

        $deactivated = $unregistered === [] ? 0 : app(PushTickets::class)->deactivate(array_values(array_unique($unregistered)), 'recibo de Expo');
        $summary = self::summary([
            $delivered > 0 ? self::plural($delivered, 'push entregado', 'push entregados') : null,
            $failed > 0 ? self::plural($failed, 'push con error', 'push con error') : null,
            $deactivated > 0 ? self::plural($deactivated, 'dispositivo desactivado', 'dispositivos desactivados') : null,
            $expired > 0 ? self::plural($expired, 'ticket sin recibo', 'tickets sin recibo') : null,
        ], 'Recibos consultados, Expo aún no los tiene listos');

        return $deactivated > 0 ? $this->warn($summary) : $summary;
    }
}
