<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Channels\Support\ReviewLinks;
use App\Domain\Channels\Support\ReviewRequestSender;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class SendDueReviewRequests extends TenantJob
{
    public const QUEUE = 'notifications';

    private const COLUMNS = ['id', 'code', 'status', 'reservation_id', 'client_id', 'channel', 'to_address', 'lang', 'sent_at', 'expires_at'];

    protected function run(): string
    {
        $audit = app(AuditLogger::class);
        $expired = $this->expire($audit);

        if (! app(RuleResolver::class)->on('R-OWN-REVIEWS')) {
            return $this->warn('Reseñas propias apagadas (R-OWN-REVIEWS)'.($expired > 0 ? ' · '.self::plural($expired, 'solicitud vencida', 'solicitudes vencidas') : ''));
        }

        $invite = OwnReviewSettings::read()['invite'];
        $sender = app(ReviewRequestSender::class);
        $tenant = app(TenantContext::class)->idOrFail();
        $sent = 0;
        $reminded = 0;

        foreach (DB::table('crm_review_requests')->where('status', 'programada')->whereNotNull('scheduled_at')->where('scheduled_at', '<=', now())->orderBy('scheduled_at')->lockForUpdate()->get(self::COLUMNS) as $request) {
            DB::table('crm_review_requests')->where('id', $request->id)->update(['status' => 'enviada', 'token_hash' => ReviewLinks::hash($tenant, (string) $request->code), 'sent_at' => now(), 'expires_at' => now()->addDays((int) $invite['expire_days']), 'updated_at' => now()]);
            $sender->send($request);
            $audit->log('Solicitud de reseña', (string) $request->code, 'enviar', 'programada', 'enviada');
            $sent++;
        }

        $days = (int) $invite['reminder_days'];

        if ($days > 0) {
            $due = DB::table('crm_review_requests')->whereIn('status', ['enviada', 'abierta'])->whereNull('reminded_at')->whereNotNull('sent_at')
                ->where('sent_at', '<=', now()->subDays($days))->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                ->orderBy('sent_at')->lockForUpdate()->get(self::COLUMNS);

            foreach ($due as $request) {
                DB::table('crm_review_requests')->where('id', $request->id)->update(['reminded_at' => now(), 'updated_at' => now()]);
                $sender->send($request, true);
                $audit->log('Solicitud de reseña', (string) $request->code, 'recordar', (string) $request->status, (string) $request->status);
                $reminded++;
            }
        }

        if ($sent + $reminded + $expired === 0) {
            return 'Sin invitaciones por enviar';
        }

        return implode(' · ', array_filter([
            $sent > 0 ? self::plural($sent, 'invitación enviada', 'invitaciones enviadas') : null,
            $reminded > 0 ? self::plural($reminded, 'recordatorio', 'recordatorios') : null,
            $expired > 0 ? self::plural($expired, 'solicitud vencida', 'solicitudes vencidas') : null,
        ]));
    }

    private function expire(AuditLogger $audit): int
    {
        $rows = DB::table('crm_review_requests')->whereIn('status', ['enviada', 'abierta'])->whereNotNull('expires_at')->where('expires_at', '<=', now())->lockForUpdate()->get(['id', 'code', 'status']);

        foreach ($rows as $row) {
            DB::table('crm_review_requests')->where('id', $row->id)->update(['status' => 'vencida', 'updated_at' => now()]);
            $audit->log('Solicitud de reseña', (string) $row->code, 'vencer', (string) $row->status, 'vencida');
        }

        return $rows->count();
    }
}
