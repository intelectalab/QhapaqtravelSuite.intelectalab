<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Channels\Support\B2bRecipients;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class MarkB2bAgreementsExpired extends TenantJob
{
    public const QUEUE = 'low';

    public const NOTICE_DAYS = [30, 7];

    public const EXPIRED_LOOKBACK_DAYS = 30;

    private const SOURCE = 'channel_b2b_agency';

    protected function run(): string
    {
        $today = $this->today();
        $agencies = DB::table('channel_b2b_agencies')->whereNull('deleted_at')->where('status', '<>', 'inactiva')
            ->whereBetween('valid_to', [$today->subDays(self::EXPIRED_LOOKBACK_DAYS)->toDateString(), $today->addDays(max(self::NOTICE_DAYS))->toDateString()])
            ->orderBy('valid_to')->orderBy('code')->get(['id', 'code', 'legal_name', 'valid_to']);

        if ($agencies->isEmpty()) {
            return 'Sin convenios B2B por vencer';
        }

        $recipients = app(B2bRecipients::class);
        $executives = $recipients->executives();
        $counts = ['expiring' => 0, 'expired' => 0, 'notices' => 0];

        foreach ($agencies as $agency) {
            $validTo = CarbonImmutable::parse((string) $agency->valid_to, app(TenantContext::class)->timezone())->startOfDay();
            $days = (int) $today->diffInDays($validTo, false);
            $stage = $days < 0 ? 0 : min(array_filter(self::NOTICE_DAYS, fn (int $limit): bool => $days <= $limit));
            $event = $stage === 0 ? 'b2b.convenio_vencido' : "b2b.convenio_por_vencer_{$stage}";
            $windowStart = $stage === 0 ? $validTo : $validTo->subDays($stage);
            $date = $validTo->format('d/m/Y');
            $sent = 0;

            foreach ($executives as $userId) {
                $sent += $this->notify($event, $userId, $agency, $windowStart, $this->subject($stage, $days, (string) $agency->legal_name), $stage === 0
                    ? "Venció el {$date}. La agencia no puede reservar hasta que renueves la vigencia en Canales › B2B agencias."
                    : "Vence el {$date}. Renueva la vigencia en Canales › B2B agencias para que la agencia siga reservando.");
            }

            foreach ($recipients->agencyUsers((string) $agency->id) as $userId) {
                $sent += $this->notify($event, $userId, $agency, $windowStart, $stage === 0 ? 'Tu convenio venció' : 'Tu convenio está por vencer', $stage === 0
                    ? "Tu convenio venció el {$date}. No puedes hacer reservas hasta renovarlo: escribe a tu ejecutivo de cuenta."
                    : "Tu convenio vence el {$date}. Coordina la renovación con tu ejecutivo de cuenta para seguir reservando.", 'agency');
            }

            if ($sent > 0 && $stage === 0) {
                app(AuditLogger::class)->log('Agencia B2B', (string) $agency->code, 'vencer_convenio', 'vigente', "vencido · convenio hasta {$agency->valid_to}");
            }

            $counts[$stage === 0 ? 'expired' : 'expiring'] += $sent > 0 ? 1 : 0;
            $counts['notices'] += $sent;
        }

        return self::summary([
            $counts['expiring'] > 0 ? self::plural($counts['expiring'], 'convenio por vencer', 'convenios por vencer') : null,
            $counts['expired'] > 0 ? self::plural($counts['expired'], 'convenio vencido', 'convenios vencidos') : null,
            $counts['notices'] > 0 ? self::plural($counts['notices'], 'aviso', 'avisos') : null,
        ], 'Convenios B2B ya avisados');
    }

    private function subject(int $stage, int $days, string $name): string
    {
        return match (true) {
            $stage === 0 => "Venció el convenio de {$name}",
            $days === 0 => "El convenio de {$name} vence hoy",
            $days === 1 => "El convenio de {$name} vence mañana",
            default => "El convenio de {$name} vence en {$days} días",
        };
    }

    private function notify(string $event, string $userId, object $agency, CarbonImmutable $windowStart, string $subject, string $body, string $audience = 'internal'): int
    {
        $sent = DB::table('notif_messages')->where('event_code', $event)->where('recipient_user_id', $userId)
            ->where('source_type', self::SOURCE)->where('source_id', $agency->id)->where('created_at', '>=', $windowStart)->exists();

        if ($sent) {
            return 0;
        }

        app(NotificationLog::class)->record([
            'event_code' => $event,
            'channel' => 'portal',
            'audience' => $audience,
            'recipient_user_id' => $userId,
            'subject' => mb_substr($subject, 0, 200),
            'body_rendered' => $body,
            'source_type' => self::SOURCE,
            'source_id' => (string) $agency->id,
        ]);

        return 1;
    }
}
