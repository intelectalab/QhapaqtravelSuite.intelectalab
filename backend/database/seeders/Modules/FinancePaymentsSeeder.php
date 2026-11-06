<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Finance\Support\PaymentMethods;
use Database\Seeders\Modules\Concerns\SeedsFinance;
use Database\Support\KitSeeds;
use Illuminate\Support\Facades\DB;

final class FinancePaymentsSeeder
{
    use SeedsFinance;

    public function run(): void
    {
        foreach (PaymentMethods::DEFAULTS as $label => [$requiresReference, $b2b]) {
            $this->upsert('fin_payment_methods', ['code' => PaymentMethods::code($label)], ['label' => $label, 'requires_reference' => $requiresReference, 'is_b2b_credit' => $b2b, 'active' => true]);
        }

        foreach (array_reverse(KitSeeds::read('payments')) as $seed) {
            $reservationId = $this->codeId('booking_reservations', $seed['resId']);
            if ($reservationId === null) {
                continue;
            }

            $receivableId = $this->codeId('fin_receivables', $seed['receivableId']);
            $by = $this->actor($seed['by']);
            $at = $this->moment($seed['date'].' 10:30');
            $reverted = $seed['status'] === 'revertido';
            $request = $seed['reversalRequest'] ?? null;
            $paymentId = $this->upsert('fin_payments', ['code' => $seed['id']], [
                'reservation_id' => $reservationId,
                'receivable_id' => $receivableId,
                'kind' => $receivableId === null ? 'reembolso' : 'cobro',
                'source' => $seed['by'] === 'Sistema' ? 'ecommerce' : ($seed['by'] === 'U07' ? 'backoffice' : 'reserva'),
                'method' => PaymentMethods::code($seed['method']),
                'amount' => $seed['amount'],
                'currency' => $seed['currency'],
                'fx_rate' => $this->fxFor($seed['currency']),
                'paid_on' => $this->day($seed['date']),
                'reference' => $seed['ref'] ?? null,
                'note' => $request ? 'Solicitud de reversión: '.$request['reason'] : null,
                'status' => $seed['status'],
                'reverted_at' => $reverted ? $this->moment($seed['date'].' 16:00') : null,
                'reverted_by' => $reverted ? $this->userId('U07') : null,
                'revert_reason' => $reverted ? 'Reembolso al cliente por cancelación de la reserva.' : null,
                'registered_by' => $by,
                'created_by' => $by,
                'created_at' => $at,
                'updated_at' => $at,
            ]);

            $this->history('payment', $paymentId, $seed['status'] === 'pendiente' ? 'pendiente' : 'confirmado', $seed['status'] === 'pendiente' ? 'Pago reportado, por validar' : 'Pago registrado y validado', $by, $at);

            if ($seed['status'] === 'aplicado' && $receivableId !== null) {
                $this->history('payment', $paymentId, 'aplicado', "Aplicado a {$seed['receivableId']}", $by, $at);
                $exists = DB::table('fin_payment_applications')->where('payment_id', $paymentId)->exists();
                if (! $exists) {
                    DB::table('fin_payment_applications')->insert([
                        'tenant_id' => $this->tenant->getKey(),
                        'payment_id' => $paymentId,
                        'receivable_id' => $receivableId,
                        'amount' => $seed['amount'],
                        'applied_at' => $at,
                        'applied_by' => $by,
                        'created_by' => $by,
                    ]);
                }
            }

            if ($reverted) {
                $this->history('payment', $paymentId, 'revertido', 'Reembolso al cliente por cancelación de la reserva.', $this->userId('U07'), $this->moment($seed['date'].' 16:00'));
            }
        }
    }
}
