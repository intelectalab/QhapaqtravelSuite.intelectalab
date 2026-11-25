<?php

use App\Domain\Finance\Support\PaymentMethods;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('traduce los códigos del sistema y humaniza los desconocidos', function () {
    $labels = ['transferencia_bcp' => 'Transferencia BCP'];

    expect(PaymentMethods::display('transferencia_bcp', $labels))->toBe('Transferencia BCP')
        ->and(PaymentMethods::display('deposito_en_caja', $labels))->toBe('Deposito en caja')
        ->and(PaymentMethods::display('Reembolso aprobado', $labels))->toBe('Reembolso aprobado');

    $all = withinTenant(tenantA(), fn () => app(PaymentMethods::class)->labels());
    expect($all)->toMatchArray(['paypal' => 'PayPal', 'mercadopago' => 'Mercado Pago', 'transferencia' => 'Transferencia bancaria', 'vale_regalo' => 'Vale de regalo', 'tarjeta_e_commerce' => 'Tarjeta (e-commerce)']);

    $customer = withinTenant(tenantA(), fn () => app(PaymentMethods::class)->customerLabels());
    expect($customer)->toMatchArray(['tarjeta_e_commerce' => 'Tarjeta en línea', 'transferencia_bcp' => 'Transferencia BCP', 'paypal' => 'PayPal']);
});

it('el pago, la cuota, la reserva y la ficha del cliente muestran el nombre del medio, no su código', function () {
    actingAsSeed('U01');
    $row = withinTenant(tenantA(), function () {
        $payment = DB::table('fin_payments as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->join('fin_payment_applications as a', 'a.payment_id', '=', 'p.id')->join('fin_receivables as f', 'f.id', '=', 'a.receivable_id')
            ->where('p.kind', 'cobro')->orderBy('p.code')->first(['p.id', 'p.code', 'r.code as reservation', 'c.code as client', 'f.code as receivable']);
        DB::table('fin_payments')->where('id', $payment->id)->update(['method' => 'paypal']);

        return $payment;
    });

    expect($this->getJson("/api/v1/finance/payments/{$row->code}")->assertOk()->json('data.method'))->toBe('PayPal');
    expect(collect($this->getJson("/api/v1/finance/receivables/{$row->receivable}")->assertOk()->json('data.payments'))->firstWhere('code', $row->code)['method'])->toBe('PayPal');

    $reservation = json_encode($this->getJson("/api/v1/reservations/{$row->reservation}")->assertOk()->json());
    expect($reservation)->toContain('"code":"'.$row->code.'"')->toContain('"method":"PayPal"')->not->toContain('"method":"paypal"');

    $payments = json_encode($this->getJson("/api/v1/crm/clients/{$row->client}/payments")->assertOk()->json());
    expect($payments)->toContain('"method":"PayPal"')->not->toContain('"method":"paypal"');
});

it('los abonos al proveedor muestran el medio con su nombre', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), function () {
        $payout = DB::table('fin_payable_payouts as o')->join('fin_payables as f', 'f.id', '=', 'o.payable_id')->whereNull('f.deleted_at')->orderBy('o.code')->first(['o.id', 'f.code']);
        if ($payout === null) {
            return null;
        }
        DB::table('fin_payable_payouts')->where('id', $payout->id)->update(['method' => 'transferencia_cci']);

        return $payout->code;
    });
    expect($code)->not->toBeNull();

    $methods = collect($this->getJson("/api/v1/finance/payables/{$code}")->assertOk()->json('data.payouts'))->pluck('method');
    expect($methods)->toContain('Transferencia interbancaria (CCI)')->not->toContain('transferencia_cci');
});
