<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class InboxFirstResponseSla extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    public const WARN_MINUTES = 15;

    protected function run(): string
    {
        $now = Carbon::now();
        $open = DB::table('collab_conversations')->whereIn('status', ['abierta', 'pendiente'])->whereNull('first_response_at')->where('first_response_due_at', '<=', $now->copy()->addMinutes(self::WARN_MINUTES))
            ->get(['id', 'contact_name', 'channel', 'assignee_id', 'first_response_due_at']);
        $managers = $this->managers();
        $late = 0;
        $soon = 0;

        foreach ($open as $conversation) {
            $expired = Carbon::parse($conversation->first_response_due_at)->lte($now);
            $expired ? $late++ : $soon++;
            $event = $expired ? 'inbox.sla_vencido' : 'inbox.sla_por_vencer';
            $subject = ($expired ? 'Sin primera respuesta: ' : 'Responde pronto a ').$conversation->contact_name;
            $recipients = $expired ? [...$managers, $conversation->assignee_id] : [$conversation->assignee_id ?? $managers[0] ?? null];

            foreach (array_unique(array_filter(array_map(fn ($id) => $id ? (string) $id : null, $recipients))) as $userId) {
                $this->notifyOnce($event, $userId, 'collab_conversation', (string) $conversation->id, $subject, "Conversación por {$conversation->channel} · plazo ".Carbon::parse($conversation->first_response_due_at)->format('d/m H:i').' (INB-BR-01).', false);
            }
        }

        return $late + $soon === 0 ? 'Conversaciones dentro del plazo de primera respuesta' : self::plural($soon, 'por vencer', 'por vencer').' · '.self::plural($late, 'vencida', 'vencidas');
    }
}
