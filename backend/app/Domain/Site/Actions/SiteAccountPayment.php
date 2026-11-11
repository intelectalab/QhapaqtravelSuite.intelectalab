<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Finance\Events\PaymentApplied;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\CardPayments;
use App\Domain\Site\Support\CheckoutRules;
use App\Domain\Site\Support\CheckoutTerms;
use App\Domain\Site\Support\SiteAccountDirectory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SiteAccountPayment
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly ReceivableLedger $ledger,
        private readonly AuditLogger $audit,
        private readonly CardPayments $cards,
    ) {}

    public function pay(PortalAccount $account, string $code, array $data): array
    {
        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'Los pagos los hace quien compró el viaje.');
        }

        $payment = CheckoutRules::retry($data);

        return DB::transaction(function () use ($account, $code, $payment): array {
            $receivable = DB::table('fin_receivables')->where('code', $code)->where('client_id', $account->client->id)->whereNull('deleted_at')->lockForUpdate()->first();

            if ($receivable === null || in_array($receivable->status, ['cancelada', 'pagada'], true)) {
                throw ApiException::notFound('No encontramos una cuota pendiente con ese código en tu cuenta.');
            }

            $pending = SiteAccountDirectory::pending((string) $receivable->id);
            $amount = SiteAccountDirectory::payable($receivable, $pending);

            if (! $amount->isPositive()) {
                throw ApiException::conflict('SIT-BR-20', 'Ya informaste un pago que cubre esta cuota; lo estamos validando.');
            }

            $method = (string) $payment['method'];
            $card = $method === 'tarjeta' ? $this->cards->charge('receivable', (string) $receivable->code, (string) $amount, (string) $receivable->currency, (string) ($account->user->email ?? ''), (string) $payment['card_token'], $payment['session_id'] ?? null) : null;
            $result = $method === 'tarjeta' ? ($card['approved'] ? 'aprobado' : 'rechazado') : 'por_validar';
            $txn = $card['txn'] ?? null;
            $orderId = DB::table('booking_reservations')->where('id', $receivable->reservation_id)->value('ecom_order_id');
            $paymentId = null;
            $today = Carbon::now($this->context->timezone())->toDateString();

            if ($result !== 'rechazado') {
                $paymentId = (string) Str::uuid7();
                DB::table('fin_payments')->insert([
                    'id' => $paymentId,
                    'tenant_id' => $this->context->idOrFail(),
                    'code' => $this->sequences->next('payment'),
                    'reservation_id' => $receivable->reservation_id,
                    'receivable_id' => $receivable->id,
                    'kind' => 'cobro',
                    'source' => 'ecommerce',
                    'method' => $method === 'tarjeta' ? 'tarjeta_e_commerce' : $method,
                    'amount' => (string) $amount,
                    'currency' => $receivable->currency,
                    'fx_rate' => $receivable->fx_rate ?? null,
                    'paid_on' => $today,
                    'reference' => $result === 'aprobado' ? $txn : $payment['operation_ref'],
                    'note' => $result === 'aprobado' ? "Pago en línea de la cuota {$receivable->code} desde Mi cuenta (pasarela {$this->cards->gatewayName()})." : "Pago informado desde Mi cuenta para la cuota {$receivable->code}. Por validar.",
                    'status' => $result === 'aprobado' ? 'aplicado' : 'pendiente',
                ]);

                if ($result === 'aprobado') {
                    DB::table('fin_payment_applications')->insert(['payment_id' => $paymentId, 'receivable_id' => $receivable->id, 'amount' => (string) $amount, 'applied_at' => now()]);
                    $this->ledger->recalculate((string) $receivable->id, null);
                    PaymentApplied::dispatch($paymentId, (string) $account->user->getKey());
                }
            }

            if ($orderId) {
                DB::table('channel_ecom_payment_attempts')->insert([
                    'order_id' => $orderId,
                    'attempted_at' => now(),
                    'method' => $method,
                    'card_masked' => $card['masked'] ?? null,
                    'operation_ref' => $method === 'tarjeta' ? null : $payment['operation_ref'],
                    'result' => $result,
                    'gateway_code' => $card['code'] ?? null,
                    'message' => $card['message'] ?? 'Pago informado; lo validamos en un plazo de 4 horas hábiles.',
                    'gateway_txn_id' => $txn,
                    'amount' => (string) $amount,
                    'currency' => $receivable->currency,
                    'payment_id' => $paymentId,
                ]);
            }

            $label = CheckoutTerms::METHODS[$method]." · {$receivable->currency} {$amount}";
            $this->audit->log('Cuenta por cobrar', (string) $receivable->code, match ($result) {
                'aprobado' => 'pago_en_linea',
                'rechazado' => 'pago_rechazado',
                default => 'pago_informado',
            }, after: $result === 'rechazado' ? "{$label} · código {$card['code']}" : $label);

            return [
                'result' => $result,
                'amount' => (string) $amount,
                'currency' => $receivable->currency,
                'message' => match ($result) {
                    'aprobado' => 'Pago aprobado. Te enviamos el comprobante por correo.',
                    'rechazado' => (string) $card['message'],
                    default => 'Recibimos tu número de operación. Validamos el pago en un plazo de 4 horas hábiles.',
                },
            ];
        });
    }
}
