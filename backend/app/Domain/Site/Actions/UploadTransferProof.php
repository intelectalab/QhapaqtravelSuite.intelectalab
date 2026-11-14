<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Site\Support\TransferProofs;
use Brick\Math\BigDecimal;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

final class UploadTransferProof
{
    private const PAYABLE = ['pago_pendiente', 'pago_rechazado'];

    public function __construct(private readonly SiteCheckout $checkout, private readonly TransferProofs $proofs, private readonly AuditLogger $audit) {}

    public function forOrder(string $code, ?string $token, UploadedFile $file, ?string $operationRef): array
    {
        $order = $this->checkout->authorize($code, $token);

        if (in_array($order->status, self::PAYABLE, true) && $this->proofs->pendingForOrder((string) $order->id)->isEmpty()) {
            if (blank($operationRef)) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Escribe el número de operación de tu transferencia.', ['field' => 'operation_ref']);
            }

            $this->checkout->pay($code, $token, ['method' => 'transferencia', 'operation_ref' => (string) $operationRef]);
            $order = $this->checkout->authorize($code, $token);
        }

        if ($order->status !== 'pago_por_validar') {
            throw ApiException::conflict('SIT-PROOF-04', 'Este pedido no tiene un pago por validar.');
        }

        $payments = $this->proofs->pendingForOrder((string) $order->id);
        $first = ! $this->proofs->orderHasProof((string) $order->id);
        $stored = $this->proofs->store($file, $payments, 'Pedido web', (string) $order->code);
        $this->audit->log('Pedido web', (string) $order->code, 'subir_constancia', 'pago_por_validar', "constancia recibida · {$stored['file_name']}");
        $this->proofs->notifyReceived('channel_ecom_order', (string) $order->id, "pedido {$order->code}".($first ? '' : ' (nueva versión)'), $this->sum($payments), (string) $payments->first()->currency);

        return $this->checkout->order($code, $token);
    }

    public function forAccount(PortalAccount $account, string $paymentCode, UploadedFile $file): array
    {
        $payment = DB::table('fin_payments as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->where('p.code', $paymentCode)->where('p.kind', 'cobro')->whereIn('p.reservation_id', $account->reservations()->pluck('id')->all())
            ->first(['p.id', 'p.code', 'p.status', 'p.amount', 'p.currency', 'p.reservation_id', 'r.code as reservation_code', 'r.ecom_order_id']);

        if ($payment === null) {
            throw ApiException::notFound('No encontramos ese pago en tu cuenta.');
        }

        if ($payment->status !== 'pendiente') {
            throw ApiException::conflict('SIT-PROOF-04', 'Este pago ya no está por validar.');
        }

        $order = $payment->ecom_order_id ? DB::table('channel_ecom_orders')->where('id', $payment->ecom_order_id)->first(['id', 'code', 'status']) : null;
        $payments = $order !== null && $order->status === 'pago_por_validar' ? $this->proofs->pendingForOrder((string) $order->id) : collect([$payment]);
        $stored = $this->proofs->store($file, $payments, 'Pago', (string) $payment->code, (string) $account->user->getKey());
        $this->audit->log('Pago', (string) $payment->code, 'subir_constancia', 'pendiente', "constancia recibida desde Mi cuenta · {$stored['file_name']}");
        $order !== null
            ? $this->proofs->notifyReceived('channel_ecom_order', (string) $order->id, "pedido {$order->code}", $this->sum($payments), (string) $payment->currency)
            : $this->proofs->notifyReceived('fin_payment', (string) $payment->id, "pago {$payment->code} · reserva {$payment->reservation_code}", (string) Decimal::toApi((string) $payment->amount), (string) $payment->currency);

        return ['payment' => $payment->code, ...$stored];
    }

    private function sum(iterable $payments): string
    {
        $total = BigDecimal::zero()->toScale(2);

        foreach ($payments as $payment) {
            $total = $total->plus((string) $payment->amount);
        }

        return (string) Decimal::toApi($total);
    }
}
