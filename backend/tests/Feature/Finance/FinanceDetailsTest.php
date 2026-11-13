<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('entrega el detalle de una cuota, un pago, una obligación y una comisión', function () {
    actingAsSeed('U07');
    [$receivable, $payment, $payable, $commission] = withinTenant(tenantA(), fn () => [
        DB::table('fin_receivables')->whereNull('deleted_at')->orderBy('code')->value('code'),
        DB::table('fin_payments')->orderBy('code')->value('code'),
        DB::table('fin_payables')->whereNull('deleted_at')->orderBy('code')->value('code'),
        DB::table('fin_commissions')->whereNull('deleted_at')->orderBy('code')->value('code'),
    ]);

    expect($this->getJson("/api/v1/finance/receivables/{$receivable}")->assertOk()->json('data'))->toHaveKeys(['balance', 'payments', 'invoices', 'reminders', 'audit']);
    expect($this->getJson("/api/v1/finance/payments/{$payment}")->assertOk()->json('data'))->toHaveKeys(['pen', 'applications', 'bank_line', 'history']);
    expect($this->getJson("/api/v1/finance/payables/{$payable}")->assertOk()->json('data'))->toHaveKeys(['balance', 'payouts', 'provider', 'history']);
    expect($this->getJson("/api/v1/finance/commissions/{$commission}")->assertOk()->json('data'))->toHaveKeys(['base', 'pct', 'current_rule', 'history']);
    $this->getJson('/api/v1/finance/receivables/CXC-99999')->assertNotFound();
});

it('la liquidación muestra el estado de resultados y solo se cierra cuando todo está saldado', function () {
    actingAsSeed('U01');

    $open = $this->getJson('/api/v1/finance/reservations/RES-2026-000350/settlement')->assertOk()->json('data');
    expect($open['statement'])->toHaveKeys(['income', 'cost', 'commissions', 'net', 'margin_pct'])
        ->and($open['checks'])->toHaveCount(6)
        ->and($open['can_close'])->toBeFalse();
    expect($this->postJson('/api/v1/finance/reservations/RES-2026-000350/settlement'))->toBeApiError(409, 'FIN-BR-36');

    withinTenant(tenantA(), function () {
        $id = DB::table('booking_reservations')->where('code', 'RES-2026-000346')->value('id');
        DB::table('fin_receivables')->where('reservation_id', $id)->update(['paid_amount' => DB::raw('amount'), 'status' => 'pagada']);
        DB::table('fin_payables')->where('reservation_id', $id)->update(['paid_amount' => DB::raw('amount'), 'status' => 'pagada']);
        DB::table('fin_commissions')->where('reservation_id', $id)->update(['status' => 'pagada']);
    });

    $this->postJson('/api/v1/finance/reservations/RES-2026-000346/settlement')->assertCreated();
    expect($this->getJson('/api/v1/finance/reservations/RES-2026-000346/settlement')->json('data.closed'))->not->toBeNull();
    expect($this->postJson('/api/v1/finance/reservations/RES-2026-000346/settlement'))->toBeApiError(409, 'FIN-BR-37');
});
