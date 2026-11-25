<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SiteTemplates\Support\AiCredits;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AiCreditsLow extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    private const EVENT = 'ia.creditos_bajos';

    protected function run(): string
    {
        $balances = app(AiCredits::class)->summary()['balances'];
        $low = array_filter($balances, fn (array $row): bool => $row['low']);

        if ($low === []) {
            return 'Créditos de IA con saldo suficiente';
        }

        $monthStart = Carbon::now(app(TenantContext::class)->timezone())->startOfMonth()->utc();
        $log = app(NotificationLog::class);
        $sent = 0;

        foreach ($low as $kind => $row) {
            $label = mb_strtolower(AiCredits::KINDS[$kind]);
            $used = (int) round(100 * $row['used_month'] / max(1, $row['balance'] + $row['used_month']));

            foreach ($this->managers() as $userId) {
                $notified = DB::table('notif_messages')->where('event_code', self::EVENT)->where('recipient_user_id', $userId)
                    ->where('source_type', 'ai_credits_'.$kind)->where('created_at', '>=', $monthStart)->exists();

                if ($notified) {
                    continue;
                }

                $log->record([
                    'event_code' => self::EVENT,
                    'channel' => 'portal',
                    'recipient_user_id' => $userId,
                    'subject' => "Usaste el {$used} % de tus créditos de {$label}",
                    'body_rendered' => "Te quedan {$row['balance']} créditos de {$label} este mes. Compra un paquete en Canales › Contenido con IA › Planes y créditos para no quedarte sin generar.",
                    'source_type' => 'ai_credits_'.$kind,
                ]);
                $sent++;
            }
        }

        $kinds = implode(' y ', array_map(fn (string $kind): string => mb_strtolower(AiCredits::KINDS[$kind]), array_keys($low)));

        return $this->warn("Créditos de {$kinds} al 80 % o más · ".self::plural($sent, 'aviso', 'avisos'));
    }
}
