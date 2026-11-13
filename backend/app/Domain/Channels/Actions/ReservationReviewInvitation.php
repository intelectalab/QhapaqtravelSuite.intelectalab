<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Channels\Support\ReviewLinks;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class ReservationReviewInvitation
{
    public function __construct(
        private readonly RuleResolver $rules,
        private readonly CodeSequence $codes,
        private readonly ChannelKit $kit,
        private readonly ModerateOwnReview $moderate,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function invite(string $reference, ?string $channel, User $actor): array
    {
        if (! $this->rules->on('R-REVIEW-INVITE')) {
            throw ApiException::unprocessable('RULE_INACTIVE', 'La regla de invitación a reseña (R-REVIEW-INVITE) está inactiva. Actívala en Reglas de reserva para invitar.');
        }

        $reservation = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')
            ->where(Str::isUuid($reference) ? 'r.id' : 'r.code', $reference)
            ->first(['r.id', 'r.code', 'r.status', 'r.travel_to', 'r.client_id', 'c.email', 'c.phone']);

        if (! $reservation instanceof stdClass) {
            throw ApiException::notFound('La reserva no existe.');
        }

        if (in_array($reservation->status, ['cancelada', 'borrador'], true) || $reservation->travel_to === null || $reservation->travel_to >= $this->kit->today()) {
            throw ApiException::unprocessable('REV-BR-07', 'Solo se invita a reseñar cuando el viaje ya terminó.');
        }

        $settings = OwnReviewSettings::read();
        $channel ??= (string) $settings['invite']['channel'];
        $address = $channel === 'whatsapp' ? $reservation->phone : $reservation->email;

        if (blank($address)) {
            throw ApiException::unprocessable('REV-BR-08', $channel === 'whatsapp' ? 'El cliente no tiene un celular registrado.' : 'El cliente no tiene un correo registrado.');
        }

        $code = DB::transaction(function () use ($reservation, $channel, $address, $settings, $actor): string {
            $open = DB::table('crm_review_requests')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelada', 'vencida'])->lock('for no key update')->value('code');

            if ($open !== null) {
                throw ApiException::conflict('REV-BR-09', "La reserva ya tiene la invitación {$open}.", ['request' => $open]);
            }

            $code = $this->codes->next('crm_review_requests', 'SRV-', 4);
            DB::table('crm_review_requests')->insert([
                'code' => $code,
                'reservation_id' => $reservation->id,
                'client_id' => $reservation->client_id,
                'to_address' => $address,
                'channel' => $channel,
                'token_hash' => ReviewLinks::hash($this->context->idOrFail(), $code),
                'scheduled_at' => now(),
                'expires_at' => now()->addDays((int) $settings['invite']['expire_days']),
                'status' => 'programada',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Reseña externa', (string) $reservation->code, 'invitar', null, "{$code} · {$channel}");

            return $code;
        });

        $this->moderate->sendRequest($code, $actor);
        $request = DB::table('crm_review_requests')->where('code', $code)->first(['code', 'status', 'channel', 'to_address', 'sent_at', 'expires_at']);

        return [
            'reservation' => $reservation->code,
            'request' => $request->code,
            'status' => $request->status,
            'channel' => $request->channel,
            'to' => $request->to_address,
            'sent_at' => $request->sent_at,
            'expires_at' => $request->expires_at,
        ];
    }
}
