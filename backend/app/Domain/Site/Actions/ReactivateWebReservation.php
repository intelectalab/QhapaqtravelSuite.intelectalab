<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Finance\Actions\PaymentWorkflow;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class ReactivateWebReservation
{
    public const MODES = ['reactivar' => 'Reactivar la reserva', 'reprogramar' => 'Reprogramar a otra fecha', 'devolver' => 'Devolver el dinero'];

    public const EVENT = 'reserva.reactivada';

    public function __construct(
        private readonly PaymentWorkflow $payments,
        private readonly AuditLogger $audit,
        private readonly SequenceService $sequences,
        private readonly StaffNotices $notices,
    ) {}

    public function preview(string $code): array
    {
        $reservation = $this->reservation($code);
        $order = $reservation->ecom_order_id ? DB::table('channel_ecom_orders')->where('id', $reservation->ecom_order_id)->first(['id', 'code', 'status', 'cancel_reason']) : null;
        $payments = $this->rejected((string) $reservation->id);
        $reason = match (true) {
            $reservation->status !== 'cancelada' => 'La reserva no está cancelada.',
            $order === null => 'La reserva no viene de un pedido del sitio web.',
            $order->status !== 'cancelado' => 'El pedido del sitio no está cancelado.',
            $payments->isEmpty() => 'La reserva no tiene un pago informado que se haya rechazado o vencido.',
            default => null,
        };
        $seats = $order ? $this->seats((string) $order->id) : collect();
        $free = $seats->every(fn (array $seat): bool => $seat['free'] >= $seat['needed']);

        return [
            'eligible' => $reason === null,
            'reason' => $reason,
            'order' => $order?->code,
            'cancel_reason' => $reservation->cancel_reason,
            'amount' => (string) Decimal::toApi($this->total($payments)),
            'currency' => $payments->first()->currency ?? $reservation->currency,
            'payments' => $payments->map(fn (stdClass $p): array => ['code' => $p->code, 'amount' => (string) Decimal::toApi((string) $p->amount), 'currency' => $p->currency, 'reference' => $p->reference, 'reason' => $p->reject_reason])->values()->all(),
            'seats_available' => $free,
            'seats' => $seats->values()->all(),
            'modes' => collect($free ? ['reactivar'] : ['reprogramar', 'devolver'])->map(fn (string $mode): array => ['value' => $mode, 'label' => self::MODES[$mode]])->all(),
        ];
    }

    public function apply(string $code, string $mode, ?string $note, User $actor): array
    {
        $preview = $this->preview($code);

        if (! $preview['eligible']) {
            throw ApiException::conflict('SIT-REACT-01', (string) $preview['reason']);
        }

        if (! in_array($mode, array_column($preview['modes'], 'value'), true)) {
            throw ApiException::conflict('SIT-REACT-02', $preview['seats_available'] ? 'Hay cupos libres: reactiva la reserva.' : 'Ya no hay cupos en la salida: reprograma la reserva a otra fecha o devuelve el dinero.');
        }

        DB::transaction(function () use ($code, $mode, $note, $actor): void {
            $reservation = DB::table('booking_reservations')->where('code', $code)->lock('for no key update')->first();
            $order = DB::table('channel_ecom_orders')->where('id', $reservation->ecom_order_id)->lockForUpdate()->first();
            $payments = $this->rejected((string) $reservation->id);
            $detail = $note ? " · {$note}" : '';

            foreach ($payments as $payment) {
                $this->payments->retry((string) $payment->code, null, 'El dinero sí llegó: reactivación de la reserva web', $actor);
            }

            if ($mode === 'devolver') {
                foreach ($payments as $payment) {
                    $this->payments->confirm((string) $payment->code, null, $actor, false);
                    $refund = $this->sequences->next('payment');
                    DB::table('fin_payments')->insert(['code' => $refund, 'reservation_id' => $reservation->id, 'kind' => 'reembolso', 'source' => 'ecommerce', 'method' => 'Devolución (mismo medio de pago)', 'amount' => $payment->amount, 'currency' => $payment->currency, 'fx_rate' => $payment->fx_rate, 'paid_on' => now()->toDateString(), 'reference' => "Devolución del pago {$payment->code}", 'status' => 'pendiente', 'registered_by' => $actor->getKey(), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                    $this->audit->log('Pago', $refund, 'crear_reembolso', null, "{$payment->currency} {$payment->amount} · pedido {$order->code}", actor: $actor);
                }

                $this->audit->log('Reserva', (string) $reservation->code, 'devolver', 'cancelada', "cancelada · dinero recibido, se devuelve · pedido {$order->code}{$detail}", actor: $actor);
                $this->email($order, $reservation, 'devolver');

                return;
            }

            DB::table('fin_receivables')->where('reservation_id', $reservation->id)->where('status', 'cancelada')->update(['status' => 'abierta', 'cancel_reason' => null, 'updated_at' => now()]);
            DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->where('status', 'cancelado')->update(['status' => $mode === 'reactivar' ? 'solicitado' : 'pendiente', 'updated_at' => now()]);

            if ($mode === 'reactivar') {
                $this->reclaimSeats((string) $order->id);
            }

            DB::table('booking_reservations')->where('id', $reservation->id)->update(['status' => $mode === 'reactivar' ? 'pendiente_pago' : 'pendiente_disponibilidad', 'cancelled_at' => null, 'cancel_reason' => null, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
            DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'pago_por_validar', 'cancel_reason' => null, 'updated_at' => now()]);

            foreach ($payments as $payment) {
                $this->payments->confirm((string) $payment->code, null, $actor);
            }

            if ($mode === 'reprogramar') {
                DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'confirmado', 'updated_at' => now()]);
            }

            $this->audit->log('Reserva', (string) $reservation->code, 'reactivar', 'cancelada', ($mode === 'reactivar' ? 'reactivada con sus cupos' : 'reactivada sin cupos: por reprogramar')." · pedido {$order->code}{$detail}", actor: $actor);
            $this->audit->log('Pedido web', (string) $order->code, 'reactivar', 'cancelado', DB::table('channel_ecom_orders')->where('id', $order->id)->value('status'), actor: $actor);
            $this->email($order, $reservation, $mode);
        });

        return ['mode' => $mode, 'reservation' => $code, 'status' => DB::table('booking_reservations')->where('code', $code)->value('status')];
    }

    private function reservation(string $code): stdClass
    {
        return DB::table('booking_reservations')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'status', 'currency', 'cancel_reason', 'ecom_order_id', 'title'])
            ?? throw ApiException::notFound('La reserva no existe.');
    }

    private function rejected(string $reservationId): Collection
    {
        return DB::table('fin_payments')->where('reservation_id', $reservationId)->where('kind', 'cobro')->where('status', 'rechazado')->orderBy('created_at')
            ->get(['id', 'code', 'amount', 'currency', 'fx_rate', 'reference', 'reject_reason']);
    }

    private function seats(string $orderId): Collection
    {
        return DB::table('catalog_availability_holds as h')->join('catalog_product_departures as d', 'd.id', '=', 'h.departure_id')
            ->where('h.reference_id', $orderId)->where('h.status', 'liberada')
            ->get(['h.quantity', 'd.ref', 'd.departure_date', 'd.capacity', 'd.sold', 'd.status'])
            ->map(fn (stdClass $row): array => [
                'departure' => $row->ref,
                'date' => $row->departure_date,
                'needed' => (int) $row->quantity,
                'free' => in_array($row->status, ['cerrada', 'cancelada'], true) ? 0 : max(0, (int) $row->capacity - (int) $row->sold),
            ]);
    }

    private function reclaimSeats(string $orderId): void
    {
        foreach (DB::table('catalog_availability_holds')->where('reference_id', $orderId)->where('status', 'liberada')->orderBy('departure_id')->get(['id', 'departure_id', 'quantity']) as $hold) {
            if ($hold->departure_id) {
                $departure = DB::table('catalog_product_departures')->where('id', $hold->departure_id)->lock('for no key update')->first(['capacity', 'sold', 'status']);

                if ($departure === null || (int) $departure->capacity - (int) $departure->sold < (int) $hold->quantity) {
                    throw ApiException::conflict('SIT-REACT-02', 'Ya no hay cupos en la salida: reprograma la reserva a otra fecha o devuelve el dinero.');
                }

                $sold = (int) $departure->sold + (int) $hold->quantity;
                DB::table('catalog_product_departures')->where('id', $hold->departure_id)->update(['sold' => $sold, 'status' => $sold >= (int) $departure->capacity ? 'completa' : $departure->status, 'updated_at' => now()]);
            }

            DB::table('catalog_availability_holds')->where('id', $hold->id)->update(['status' => 'confirmada', 'released_reason' => null, 'updated_at' => now()]);
        }
    }

    private function total(Collection $payments): BigDecimal
    {
        return $payments->reduce(fn (BigDecimal $sum, stdClass $p): BigDecimal => $sum->plus((string) $p->amount), BigDecimal::zero()->toScale(2));
    }

    private function email(stdClass $order, stdClass $reservation, string $mode): void
    {
        $agency = $this->notices->agency();
        $text = match ($mode) {
            'reactivar' => "Confirmamos que tu pago sí llegó, así que reactivamos tu reserva {$reservation->code} ({$reservation->title}) con los mismos cupos. Te enviaremos los vouchers cuando estén listos.",
            'reprogramar' => "Confirmamos que tu pago sí llegó. Los cupos de la fecha original ya no están disponibles, así que reactivamos tu reserva {$reservation->code} para elegir otra fecha contigo. Te escribiremos para coordinarla.",
            default => "Confirmamos que tu pago sí llegó, pero ya no hay cupos para tu reserva {$reservation->code}. Te devolvemos el dinero por el mismo medio de pago; el banco puede tardar unos días hábiles en reflejarlo.",
        };

        $this->notices->email((string) $order->customer_email, self::EVENT, "Novedades de tu reserva {$reservation->code} · {$agency}", "Hola {$order->customer_name}:\n\n{$text}\n\n{$agency}", 'booking_reservation', (string) $reservation->id, 'client');
    }
}
