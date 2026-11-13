<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Support\TenantBookingEngine;
use App\Domain\Booking\Support\TripReservations;
use App\Domain\Finance\Support\DerivedTokens;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class InTripOffers
{
    public const CHANNELS = ['portal', 'whatsapp', 'email', 'app', 'asesor'];

    public function __construct(
        private readonly TripReservations $trips,
        private readonly TripBooking $booking,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function create(stdClass $reservation, string $kind, string $itemId, string $channel, ?string $userId): array
    {
        return DB::transaction(function () use ($reservation, $kind, $itemId, $channel, $userId): array {
            DB::table('booking_reservations')->where('id', $reservation->id)->lock('for no key update')->first(['id']);
            $item = $this->trips->candidate($reservation, $kind, $itemId);
            if (! ((float) $item['amount'] > 0)) {
                throw ApiException::unprocessable('TB-10', 'Ese servicio no tiene precio para este grupo; consulta con tu asesor.');
            }
            $start = $this->trips->startsAt($item['date'], $item['time']);
            $expires = $start->subHours((int) $item['min_hours_before'])->utc();
            $id = (string) Str::uuid7();
            $code = $this->sequences->next('in_trip_offer');
            DB::table('booking_in_trip_offers')->insert([
                'id' => $id,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'reservation_id' => $reservation->id,
                'kind' => $kind === 'tour' ? 'tour' : 'transporte',
                'leg_tour_id' => $kind === 'tour' ? $item['uuid'] : null,
                'transport_option_id' => $kind === 'tour' ? null : $item['uuid'],
                'service_date' => $item['date'],
                'currency' => $item['currency'],
                'amount' => $item['amount'],
                'status' => 'ofrecida',
                'expires_at' => $expires,
                'channel' => $channel,
                'created_by' => $userId,
            ]);
            $this->audit->log('Venta en ruta', $code, 'crear', null, "{$reservation->code} · {$item['name']} · {$item['date']} · {$item['currency']} {$item['amount']}");

            $link = $this->paymentLink($reservation, $item, $expires, $channel, $userId);
            DB::table('booking_in_trip_offers')->where('id', $id)->update(['status' => 'link_enviado', 'payment_link_id' => $link['id'], 'updated_at' => now()]);
            $this->audit->log('Venta en ruta', $code, 'link_enviado', 'ofrecida', "link_enviado · {$link['code']}");

            return $this->find($reservation->id, $code);
        });
    }

    public function cancel(stdClass $reservation, string $code, ?string $userId): array
    {
        return DB::transaction(function () use ($reservation, $code, $userId): array {
            $offer = DB::table('booking_in_trip_offers')->where('reservation_id', $reservation->id)->where('code', $code)->lock('for no key update')->first()
                ?? throw ApiException::notFound('La oferta no existe en esta reserva.');
            if (! in_array($offer->status, ['ofrecida', 'link_enviado'], true)) {
                throw ApiException::conflict('TB-10', 'Solo se cancela una oferta que todavía no se pagó.', ['status' => $offer->status]);
            }
            DB::table('booking_in_trip_offers')->where('id', $offer->id)->update(['status' => 'cancelada', 'updated_at' => now()]);
            $this->release($offer, 'anulado', $userId);
            $this->audit->log('Venta en ruta', $offer->code, 'cancelar', $offer->status, 'cancelada');

            return $this->find($reservation->id, $offer->code);
        });
    }

    public function paid(string $offerId, string $paymentId): array
    {
        return DB::transaction(function () use ($offerId, $paymentId): array {
            $offer = DB::table('booking_in_trip_offers')->where('id', $offerId)->lock('for no key update')->first() ?? throw ApiException::notFound('La oferta no existe.');
            if ($offer->status !== 'link_enviado') {
                throw ApiException::conflict('TB-10', 'La oferta ya no espera pago.', ['status' => $offer->status]);
            }
            DB::table('fin_payment_links')->where('id', $offer->payment_link_id)->where('status', 'activo')->update(['status' => 'pagado', 'paid_at' => now(), 'payment_id' => $paymentId, 'updated_at' => now()]);
            DB::table('booking_in_trip_offers')->where('id', $offer->id)->update(['status' => 'pagada', 'updated_at' => now()]);
            $this->audit->log('Venta en ruta', $offer->code, 'pagar', 'link_enviado', 'pagada');

            return $this->find($offer->reservation_id, $offer->code);
        });
    }

    public function confirm(string $offerId, ?string $userId = null): array
    {
        return DB::transaction(function () use ($offerId, $userId): array {
            $offer = DB::table('booking_in_trip_offers')->where('id', $offerId)->lock('for no key update')->first() ?? throw ApiException::notFound('La oferta no existe.');
            if ($offer->status !== 'pagada') {
                throw ApiException::conflict('TB-10', 'Solo se confirma una oferta pagada.', ['status' => $offer->status]);
            }
            $reservation = $this->trips->byId($offer->reservation_id);
            $item = $offer->kind === 'tour' ? DB::table('catalog_leg_tours')->where('id', $offer->leg_tour_id)->first() : DB::table('catalog_transport_options')->where('id', $offer->transport_option_id)->first();
            $pax = $this->trips->pax($reservation->id);
            $tripLeg = $offer->kind === 'tour'
                ? DB::table('booking_trip_legs')->where('reservation_id', $reservation->id)->where('leg_id', $item->leg_id)->value('id')
                : DB::table('booking_trip_legs')->where('reservation_id', $reservation->id)->where('leg_id', $item->to_leg_id ?? $item->from_leg_id)->value('id');
            $vehicle = null;
            $units = null;
            if ($offer->kind !== 'tour' && $item->pricing === 'vehiculo') {
                $vehicles = DB::table('catalog_transport_vehicles')->where('option_id', $item->id)->get()->map(fn (stdClass $v): array => ['name' => $v->name, 'maxPax' => (int) $v->max_pax, 'price' => (string) $v->price])->all();
                $pick = app(TenantBookingEngine::class)->engine()->vehicleFor($vehicles, $pax['adt'] + $pax['chd']);
                $vehicle = $pick['vehicle']['name'] ?? null;
                $units = $pick['units'] ?? null;
            }
            $itemId = $this->booking->item($reservation->id, $tripLeg, $offer->kind === 'tour' ? 'tour' : 'transport', $item, [
                'date' => (string) $offer->service_date,
                'time' => $offer->kind === 'tour' ? substr((string) $item->start_time, 0, 5) : null,
                'adults' => $pax['adt'],
                'children' => $offer->kind === 'tour' && $item->min_age !== null && ! ((float) $item->price_child > 0) ? 0 : $pax['chd'],
                'vehicle' => $vehicle,
                'units' => $units,
                'amount' => (string) $offer->amount,
                'currency' => $offer->currency,
                'label' => $item->name,
            ], (string) ($reservation->fx_rate ?? '1'), true, $userId);
            DB::table('booking_in_trip_offers')->where('id', $offer->id)->update(['status' => 'confirmada', 'trip_item_id' => $itemId, 'updated_at' => now()]);
            if ($offer->currency === $reservation->currency) {
                DB::table('booking_reservations')->where('id', $reservation->id)->update(['total_amount' => DB::raw('total_amount + '.(string) $offer->amount), 'updated_at' => now()]);
            }
            $this->audit->log('Venta en ruta', $offer->code, 'confirmar', 'pagada', 'confirmada');

            return $this->find($reservation->id, $offer->code);
        });
    }

    public function expire(): int
    {
        $due = DB::table('booking_in_trip_offers')->whereIn('status', ['ofrecida', 'link_enviado'])->where('expires_at', '<=', now())->get(['id', 'code', 'status', 'payment_link_id']);
        foreach ($due as $offer) {
            DB::table('booking_in_trip_offers')->where('id', $offer->id)->update(['status' => 'vencida', 'updated_at' => now()]);
            $this->release($offer, 'vencido', null);
            $this->audit->log('Venta en ruta', $offer->code, 'vencer', $offer->status, 'vencida');
        }

        return $due->count();
    }

    public function find(string $reservationId, string $code): array
    {
        $offer = collect($this->trips->offers($reservationId))->firstWhere('code', $code);

        return $offer ?? throw ApiException::notFound('La oferta no existe en esta reserva.');
    }

    private function release(stdClass $offer, string $linkStatus, ?string $userId): void
    {
        $link = $offer->payment_link_id === null ? null : DB::table('fin_payment_links')->where('id', $offer->payment_link_id)->first(['id', 'receivable_id', 'status']);
        if ($link === null || $link->status !== 'activo') {
            return;
        }
        DB::table('fin_payment_links')->where('id', $link->id)->update(['status' => $linkStatus, 'updated_by' => $userId, 'updated_at' => now()]);
        if ($link->receivable_id !== null) {
            DB::table('fin_receivables')->where('id', $link->receivable_id)->where('status', 'abierta')->where('paid_amount', 0)->update(['status' => 'cancelada', 'updated_at' => now()]);
        }
    }

    private function paymentLink(stdClass $reservation, array $item, CarbonImmutable $expires, string $channel, ?string $userId): array
    {
        $id = (string) Str::uuid7();
        $token = DerivedTokens::for('payment-link', $id);
        $code = $this->sequences->next('payment_link');
        $url = DerivedTokens::siteUrl('pagar/'.$token);
        $receivableId = (string) Str::uuid7();
        DB::table('fin_receivables')->insert([
            'id' => $receivableId,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $this->sequences->next('receivable'),
            'reservation_id' => $reservation->id,
            'client_id' => $reservation->client_id,
            'kind' => 'cargo',
            'concept' => Str::limit("Venta en ruta — {$item['name']} · {$item['date']}", 250),
            'amount' => $item['amount'],
            'currency' => $item['currency'],
            'fx_rate' => $reservation->fx_rate ?? 1,
            'due_date' => $expires->setTimezone($this->context->timezone())->toDateString(),
            'status' => 'abierta',
        ]);
        DB::table('fin_payment_links')->insert([
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'reservation_id' => $reservation->id,
            'receivable_id' => $receivableId,
            'amount' => $item['amount'],
            'currency' => $item['currency'],
            'methods' => '{card}',
            'installments_max' => 1,
            'provider' => (string) config('integrations.drivers.payments', 'fake'),
            'url' => $url,
            'token_hash' => DerivedTokens::hash($token),
            'sent_via' => match ($channel) {
                'whatsapp' => 'whatsapp',
                'email', 'portal', 'app' => 'email',
                default => 'copia',
            },
            'expires_at' => $expires,
            'status' => 'activo',
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
        $this->audit->log('Link de pago', $code, 'crear', null, "Venta en ruta {$reservation->code} · {$item['currency']} {$item['amount']}");

        return ['id' => $id, 'code' => $code, 'url' => $url, 'token' => $token];
    }
}
