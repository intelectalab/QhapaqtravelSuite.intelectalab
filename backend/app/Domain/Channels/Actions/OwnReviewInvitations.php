<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OwnReviewInvitations
{
    public function __construct(
        private readonly RuleResolver $rules,
        private readonly CodeSequence $codes,
        private readonly ChannelKit $kit,
        private readonly TenantSettings $settings,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function schedulePending(User $actor): array
    {
        if (! $this->rules->on('R-OWN-REVIEWS')) {
            throw ApiException::forbidden('RULE_NOT_IN_PLAN', 'Las reseñas propias no están activas para la agencia.');
        }

        $settings = OwnReviewSettings::read();
        $daysAfter = (int) ($this->rules->param('R-OWN-REVIEWS', 'daysAfter') ?? 2);
        $today = $this->kit->today();
        $timezone = $this->context->timezone();
        $candidates = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'borrador'])->where('r.travel_to', '<', $today)
            ->whereNotExists(fn ($query) => $query->selectRaw('1')->from('crm_review_requests as q')->whereColumn('q.reservation_id', 'r.id'))
            ->orderBy('r.travel_to')
            ->get(['r.id', 'r.code', 'r.client_id', 'r.travel_to', 'c.email', 'c.phone']);
        $created = [];
        $skipped = [];

        DB::transaction(function () use ($candidates, $settings, $daysAfter, $today, $timezone, $actor, &$created, &$skipped): void {
            foreach ($candidates as $row) {
                $channel = $settings['invite']['channel'];
                $address = $channel === 'whatsapp' ? $row->phone : $row->email;

                if (! $address) {
                    $skipped[] = ['reservation' => $row->code, 'reason' => $channel === 'whatsapp' ? 'El cliente no tiene celular.' : 'El cliente no tiene correo.'];

                    continue;
                }

                $scheduled = Carbon::parse($row->travel_to, $timezone)->addDays($daysAfter)->setTime(9, 0);
                $scheduled = $scheduled->toDateString() < $today ? Carbon::parse($today, $timezone)->addDay()->setTime(9, 0) : $scheduled;
                $code = $this->codes->next('crm_review_requests', 'SRV-', 4);
                DB::table('crm_review_requests')->insert([
                    'code' => $code,
                    'reservation_id' => $row->id,
                    'client_id' => $row->client_id,
                    'to_address' => $address,
                    'channel' => $channel,
                    'token_hash' => hash('sha256', Str::random(48)),
                    'scheduled_at' => $scheduled->utc(),
                    'expires_at' => $scheduled->copy()->addDays((int) $settings['invite']['expire_days'])->utc(),
                    'status' => 'programada',
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ]);
                $created[] = ['code' => $code, 'reservation' => $row->code, 'scheduled_at' => $scheduled->toIso8601String()];
            }

            $this->audit->log('Solicitud de reseña', 'programar_pendientes', 'programar', after: count($created).' programadas · '.count($skipped).' sin dato de contacto');
        });

        return ['created' => $created, 'skipped' => $skipped];
    }

    public function exportFeed(User $actor): array
    {
        $settings = OwnReviewSettings::read();
        $published = DB::table('crm_own_reviews')->whereNull('deleted_at')->where('status', 'publicada');
        $count = $settings['show_on_widget'] ? (clone $published)->count() : 0;
        $average = $settings['show_on_widget'] ? (clone $published)->avg('stars') : null;
        $now = now();

        DB::transaction(function () use ($settings, $count, $now, $actor): void {
            $stored = $this->settings->section(OwnReviewSettings::SECTION);
            $this->settings->save(OwnReviewSettings::SECTION, [...$stored, ...array_diff_key($settings, $stored), 'last_export' => ['at' => $now->toIso8601String(), 'by' => $actor->name, 'count' => $count]], $actor);
            $this->audit->log('Reseña propia', 'feed', 'exportar_feed', after: "{$count} reseñas".($settings['show_on_widget'] ? '' : ' (widget apagado)'));
        });

        return ['count' => $count, 'average' => $average !== null ? round((float) $average, 2) : null, 'exported_at' => $now->toIso8601String(), 'widget' => (bool) $settings['show_on_widget'], 'site' => (bool) $settings['show_on_site']];
    }
}
