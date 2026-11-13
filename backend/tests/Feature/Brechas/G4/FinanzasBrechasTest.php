<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

function g4SettleReady(string $code): string
{
    return withinTenant(tenantA(), function () use ($code): string {
        $id = (string) DB::table('booking_reservations')->where('code', $code)->value('id');
        DB::table('fin_receivables')->where('reservation_id', $id)->update(['paid_amount' => DB::raw('amount'), 'status' => 'pagada']);
        DB::table('fin_payables')->where('reservation_id', $id)->update(['paid_amount' => DB::raw('amount'), 'status' => 'pagada', 'approved_at' => now()]);
        DB::table('fin_commissions')->where('reservation_id', $id)->update(['status' => 'pagada']);

        return $id;
    });
}

it('la liquidación separa costo de servicios, costos adicionales y margen bruto, y guarda el margen bruto', function () {
    actingAsSeed('U01');
    $id = g4SettleReady('RES-2026-000346');

    $statement = $this->getJson('/api/v1/finance/reservations/RES-2026-000346/settlement')->assertOk()->json('data.statement');
    $gross = round((float) $statement['income'] - (float) $statement['cost'], 2);

    expect($statement)->toHaveKeys(['service_cost', 'extra_cost', 'pending_extra_cost', 'gross', 'net_pct'])
        ->and((float) $statement['gross'])->toEqual($gross)
        ->and(round((float) $statement['service_cost'] + (float) $statement['extra_cost'], 2))->toEqual(round((float) $statement['cost'], 2))
        ->and($statement['margin_pct'])->toBe((float) $statement['income'] === 0.0 ? null : number_format($gross * 100 / (float) $statement['income'], 1, '.', ''));

    $this->postJson('/api/v1/finance/reservations/RES-2026-000346/settlement')->assertCreated();

    expect((float) withinTenant(tenantA(), fn () => DB::table('fin_settlements')->where('reservation_id', $id)->value('gross_margin_pct')))->toEqual((float) $statement['margin_pct']);
});

it('cerrar la liquidación exige además registrar pagos (FIN-BR-59) y avisa al responsable de la reserva', function () {
    $id = g4SettleReady('RES-2026-000346');

    actingAsSeed('U02');
    $response = $this->postJson('/api/v1/finance/reservations/RES-2026-000346/settlement');
    expect($response)->toBeApiError(403, 'FIN-BR-59')
        ->and($response->json('required_permissions'))->toContain('finance.payments.register');

    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/reservations/RES-2026-000346/settlement')->assertCreated();

    $owner = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('id', $id)->value('owner_id'));
    $notice = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'reserva.liquidada')->where('reservation_id', $id)->first(['recipient_user_id', 'channel']));

    expect($notice)->not->toBeNull()
        ->and($notice->recipient_user_id)->toBe($owner)
        ->and($notice->channel)->toBe('portal');
});

it('el pago informa el saldo de su cuota antes y después de revertir y el KPI cuenta los confirmados por aplicar', function () {
    actingAsSeed('U07');

    $data = $this->getJson('/api/v1/finance/payments')->assertOk()->json('data');
    $applied = collect($data['rows'])->first(fn (array $row): bool => $row['status'] === 'aplicado' && $row['application'] !== null);

    expect($data['kpis'])->toHaveKey('to_apply_count')
        ->and($data['kpis']['to_apply_count'])->toBe(collect($data['rows'])->where('kind', 'cobro')->where('status', 'confirmado')->count());

    if ($applied !== null) {
        expect(round($applied['application']['balance_after'] - $applied['application']['balance_before'], 2))->toEqual(round($applied['application']['amount'], 2));
    }
});

it('las cuentas por pagar dicen si el proveedor ya cargó su factura', function () {
    actingAsSeed('U07');

    $rows = $this->getJson('/api/v1/finance/payables')->assertOk()->json('data.rows');

    expect($rows)->not->toBeEmpty()
        ->and(array_key_exists('supplier_invoice', $rows[0]))->toBeTrue();
});

it('las reservas para anticipo traen su título para armar el concepto', function () {
    actingAsSeed('U07');

    $options = $this->getJson('/api/v1/finance/receivables')->assertOk()->json('data.advance_reservations');

    expect($options === [] || array_key_exists('title', $options[0]))->toBeTrue();
});

it('el tipo de cambio entrega la tendencia de los últimos 30 días sin fechas repetidas', function () {
    actingAsSeed('U01');

    $currencies = $this->getJson('/api/v1/finance/fx-rates')->assertOk()->json('data.currencies');

    foreach ($currencies as $currency) {
        $dates = collect($currency['trend'])->pluck('date');
        expect($dates->count())->toBe($dates->unique()->count())->and($dates->count())->toBeLessThanOrEqual(30);
    }
});
