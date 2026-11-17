<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Finance\Actions\PaymentWorkflow;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class RecreateWebReservation
{
    public const EVENT = 'reserva.recreada';

    private const RESERVATION_RESET = ['cancelled_at' => null, 'cancel_reason' => null, 'penalty_amount' => null, 'refund_amount' => null, 'rescheduled_at' => null, 'cancel_request_id' => null, 'deleted_at' => null, 'lock_version' => 0];

    private const SERVICE_RESET = ['confirmation_code' => null, 'confirmed_by_name' => null, 'confirmed_by' => null, 'confirmed_at' => null, 'reject_reason' => null, 'alt_of_id' => null, 'replaced_by_id' => null, 'lock_version' => 0];

    public function __construct(
        private readonly PaymentWorkflow $payments,
        private readonly AuditLogger $audit,
        private readonly SequenceService $sequences,
        private readonly CodeSequence $codes,
        private readonly StaffNotices $notices,
    ) {}

    public function preview(string $code): array
    {
        $reservation = $this->reservation($code);
        $order = $reservation->ecom_order_id ? DB::table('channel_ecom_orders')->where('id', $reservation->ecom_order_id)->first(['id', 'code', 'status']) : null;
        $payments = $this->rejected((string) $reservation->id);
        $replacement = DB::table('booking_reservations')->where('replaces_reservation_id', $reservation->id)->value('code');
        $reason = match (true) {
            $reservation->status !== 'cancelada' => 'La reserva no está cancelada.',
            $order === null => 'La reserva no viene de un pedido del sitio web.',
            $replacement !== null => "Ya se recreó como {$replacement}.",
            $payments->isEmpty() => 'La reserva no tiene un pago informado que se haya rechazado o vencido.',
            default => null,
        };
        $seats = $order ? $this->seats((string) $order->id, (string) $reservation->id) : collect();
        $free = $seats->every(fn (array $seat): bool => $seat['free'] >= $seat['needed']);

        return [
            'eligible' => $reason === null,
            'reason' => $reason,
            'order' => $order?->code,
            'replaced_by' => $replacement,
            'cancel_reason' => $reservation->cancel_reason,
            'amount' => (string) Decimal::toApi($this->total($payments)),
            'currency' => $payments->first()->currency ?? $reservation->currency,
            'payments' => $payments->map(fn (stdClass $p): array => ['code' => $p->code, 'amount' => (string) Decimal::toApi((string) $p->amount), 'currency' => $p->currency, 'reference' => $p->reference, 'reason' => $p->reject_reason])->values()->all(),
            'seats_available' => $free,
            'seats' => $seats->values()->all(),
            'outcome' => $free ? 'confirmada' : 'pendiente_disponibilidad',
        ];
    }

    public function apply(string $code, ?string $note, User $actor): array
    {
        $preview = $this->preview($code);

        if (! $preview['eligible']) {
            throw ApiException::conflict('SIT-RECREATE-01', (string) $preview['reason']);
        }

        $created = DB::transaction(function () use ($code, $note, $actor, $preview): string {
            $old = DB::table('booking_reservations')->where('code', $code)->lock('for no key update')->first();

            if (DB::table('booking_reservations')->where('replaces_reservation_id', $old->id)->exists()) {
                throw ApiException::conflict('SIT-RECREATE-01', 'La reserva ya se recreó.');
            }

            $order = DB::table('channel_ecom_orders')->where('id', $old->ecom_order_id)->lockForUpdate()->first();
            $withSeats = (bool) $preview['seats_available'];

            if ($withSeats) {
                $this->reclaimSeats((string) $order->id, (string) $old->id);
            }

            $newId = (string) Str::uuid7();
            $newCode = $this->sequences->next('reservation');
            $notes = trim("Reemplaza a {$old->code}: el pago del pedido {$order->code} sí llegó después de la cancelación.".($note ? " {$note}" : '')."\n".(string) $old->notes);
            DB::table('booking_reservations')->insert([
                ...(array) $old,
                ...self::RESERVATION_RESET,
                'id' => $newId,
                'code' => $newCode,
                'status' => $withSeats ? 'pendiente_pago' : 'pendiente_disponibilidad',
                'notes' => $notes,
                'replaces_reservation_id' => $old->id,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $services = $this->copy('booking_reservation_services', $old->id, $newId, fn (array $row): array => [
                ...self::SERVICE_RESET,
                'code' => $this->codes->next('booking_reservation_services', 'RS-'),
                'status' => $withSeats ? 'solicitado' : 'pendiente',
                'requested_at' => $withSeats ? now() : null,
                'requested_by' => $withSeats ? $actor->getKey() : null,
            ]);
            $this->copy('booking_passengers', $old->id, $newId);
            $legs = $this->copy('booking_trip_legs', $old->id, $newId);
            $this->copy('booking_trip_items', $old->id, $newId, fn (array $row): array => [
                'trip_leg_id' => $row['trip_leg_id'] ? ($legs[$row['trip_leg_id']] ?? null) : null,
                'reservation_service_id' => $row['reservation_service_id'] ? ($services[$row['reservation_service_id']] ?? null) : null,
            ]);
            $snapshots = $this->copy('booking_reservation_web_snapshots', $old->id, $newId);

            foreach (['booking_reservation_web_lodging', 'booking_reservation_web_addons'] as $table) {
                foreach ($snapshots as $from => $to) {
                    $this->copy($table, $from, $to, column: 'snapshot_id');
                }
            }

            $receivables = $this->copy('fin_receivables', $old->id, $newId, fn (array $row): array => [
                'code' => $this->sequences->next('receivable'),
                'status' => 'abierta',
                'paid_amount' => '0',
                'cancelled_at' => null,
                'cancel_reason' => null,
                'last_reminder_at' => null,
                'lock_version' => 0,
            ], fn ($query) => $query->where('status', 'cancelada')->where('kind', '<>', 'penalidad')->whereNull('deleted_at'));

            $ids = array_map(fn (mixed $id): string => (string) $id, array_filter(explode(',', trim((string) $order->reservation_ids, '{}'))));
            $ids = in_array((string) $old->id, $ids, true) ? array_map(fn (string $id): string => $id === (string) $old->id ? $newId : $id, $ids) : [...$ids, $newId];
            DB::table('channel_ecom_orders')->where('id', $order->id)->update([
                'status' => $withSeats ? 'pago_por_validar' : 'confirmado',
                'cancel_reason' => null,
                'reservation_id' => (string) $order->reservation_id === (string) $old->id ? $newId : $order->reservation_id,
                'reservation_ids' => '{'.implode(',', $ids).'}',
                'updated_at' => now(),
            ]);

            foreach ($this->rejected((string) $old->id) as $payment) {
                DB::table('fin_payments')->where('id', $payment->id)->update(['reservation_id' => $newId, 'receivable_id' => $payment->receivable_id ? ($receivables[$payment->receivable_id] ?? null) : null, 'updated_at' => now()]);
                $this->audit->log('Pago', (string) $payment->code, 'trasladar', $old->code, "{$newCode} · el dinero sí llegó", actor: $actor);
                $this->payments->retry((string) $payment->code, null, "El dinero sí llegó: pasa a la reserva {$newCode}", $actor);
                $this->payments->confirm((string) $payment->code, null, $actor);
            }

            $detail = $note ? " · {$note}" : '';
            $this->audit->log('Reserva', $newCode, 'recrear', null, ($withSeats ? 'con sus cupos' : 'sin cupos: pendiente de disponibilidad')." · reemplaza a {$old->code} · pedido {$order->code}{$detail}", actor: $actor);
            $this->audit->log('Reserva', (string) $old->code, 'reemplazar', 'cancelada', "cancelada · reemplazada por {$newCode}", actor: $actor);
            $this->audit->log('Pedido web', (string) $order->code, 'recrear_reserva', $order->status, DB::table('channel_ecom_orders')->where('id', $order->id)->value('status'), actor: $actor);
            $this->email($order, $old, $newId, $newCode, $withSeats);

            return $newCode;
        });

        return ['reservation' => $created, 'replaces' => $code, 'status' => DB::table('booking_reservations')->where('code', $created)->value('status')];
    }

    private function copy(string $table, string $from, string $to, ?callable $override = null, ?callable $scope = null, string $column = 'reservation_id'): array
    {
        $map = [];
        $rows = DB::table($table)->where($column, $from)->when($scope, fn ($query) => $scope($query))->orderBy('id')->get();

        foreach ($rows as $row) {
            $data = (array) $row;
            $id = (string) Str::uuid7();
            $map[(string) $data['id']] = $id;
            $data = [...$data, ...($override ? $override($data) : []), 'id' => $id, $column => $to];

            foreach (['created_at', 'updated_at'] as $stamp) {
                if (array_key_exists($stamp, $data)) {
                    $data[$stamp] = now();
                }
            }

            DB::table($table)->insert($data);
        }

        return $map;
    }

    private function reservation(string $code): stdClass
    {
        return DB::table('booking_reservations')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'status', 'currency', 'cancel_reason', 'ecom_order_id', 'title'])
            ?? throw ApiException::notFound('La reserva no existe.');
    }

    private function rejected(string $reservationId): Collection
    {
        return DB::table('fin_payments')->where('reservation_id', $reservationId)->where('kind', 'cobro')->where('status', 'rechazado')->orderBy('created_at')
            ->get(['id', 'code', 'amount', 'currency', 'fx_rate', 'reference', 'reject_reason', 'receivable_id']);
    }

    private function holds(string $orderId, string $reservationId): Builder
    {
        $departures = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->whereNotNull('departure_id')->pluck('departure_id');

        return DB::table('catalog_availability_holds as h')->where('h.reference_id', $orderId)->where('h.status', 'liberada')->whereIn('h.departure_id', $departures);
    }

    private function seats(string $orderId, string $reservationId): Collection
    {
        return $this->holds($orderId, $reservationId)->join('catalog_product_departures as d', 'd.id', '=', 'h.departure_id')
            ->get(['h.quantity', 'd.ref', 'd.departure_date', 'd.capacity', 'd.sold', 'd.status'])
            ->map(fn (stdClass $row): array => [
                'departure' => $row->ref,
                'date' => $row->departure_date,
                'needed' => (int) $row->quantity,
                'free' => in_array($row->status, ['cerrada', 'cancelada'], true) ? 0 : max(0, (int) $row->capacity - (int) $row->sold),
            ]);
    }

    private function reclaimSeats(string $orderId, string $reservationId): void
    {
        foreach ($this->holds($orderId, $reservationId)->orderBy('h.departure_id')->get(['h.id', 'h.departure_id', 'h.quantity']) as $hold) {
            $departure = DB::table('catalog_product_departures')->where('id', $hold->departure_id)->lock('for no key update')->first(['capacity', 'sold', 'status']);

            if ($departure === null || (int) $departure->capacity - (int) $departure->sold < (int) $hold->quantity) {
                throw ApiException::conflict('SIT-RECREATE-02', 'Ya no hay cupos en la salida: vuelve a abrir la vista para recrearla pendiente de disponibilidad.');
            }

            $sold = (int) $departure->sold + (int) $hold->quantity;
            DB::table('catalog_product_departures')->where('id', $hold->departure_id)->update(['sold' => $sold, 'status' => $sold >= (int) $departure->capacity ? 'completa' : $departure->status, 'updated_at' => now()]);
            DB::table('catalog_availability_holds')->where('id', $hold->id)->update(['status' => 'confirmada', 'released_reason' => null, 'updated_at' => now()]);
        }
    }

    private function total(Collection $payments): BigDecimal
    {
        return $payments->reduce(fn (BigDecimal $sum, stdClass $p): BigDecimal => $sum->plus((string) $p->amount), BigDecimal::zero()->toScale(2));
    }

    private function email(stdClass $order, stdClass $old, string $newId, string $newCode, bool $withSeats): void
    {
        $agency = $this->notices->agency();
        $text = $withSeats
            ? "Confirmamos que tu pago sí llegó. Como tu reserva {$old->code} ({$old->title}) ya se había cancelado, creamos la reserva {$newCode} con los mismos datos, los mismos cupos y tu pago aplicado. Te enviaremos los vouchers cuando estén listos."
            : "Confirmamos que tu pago sí llegó. Tu reserva {$old->code} ({$old->title}) ya se había cancelado y los cupos de esa fecha ya no están disponibles, así que creamos la reserva {$newCode} con los mismos datos y tu pago. Te escribiremos para elegir otra fecha o, si lo prefieres, devolverte el dinero.";

        $this->notices->email((string) $order->customer_email, self::EVENT, "Tu reserva {$newCode} · {$agency}", "Hola {$order->customer_name}:\n\n{$text}\n\n{$agency}", 'booking_reservation', $newId, 'client');
    }
}
