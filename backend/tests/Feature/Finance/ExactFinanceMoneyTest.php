<?php

use App\Domain\Finance\Support\AmountInWords;
use App\Domain\Shared\Money\Decimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockTreasury();
    freezeBusinessToday();
});

function servicesTotal(string $reservationId): string
{
    return (string) DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->sum('price_amount');
}

it('el importe en letras toma los céntimos exactos', function () {
    expect(AmountInWords::of('1234.05', 'PEN'))->toEndWith('CON 05/100 SOLES')
        ->and(AmountInWords::of(0.29, 'USD'))->toBe('SON: CERO CON 29/100 DÓLARES AMERICANOS')
        ->and((string) Decimal::withoutIgv('118.00'))->toBe('100.00')
        ->and((string) Decimal::money(0.1 + 0.2))->toBe('0.30');
});

it('tres pagos parciales liquidan la cuenta por pagar sin dejar céntimos', function () {
    actingAsSeed('U07');
    withinTenant(tenantA(), fn () => DB::table('fin_payables')->where('code', 'CXP-00402')->update(['amount' => '100.10', 'paid_amount' => 0, 'status' => 'aprobada', 'approved_at' => now()]));

    foreach (['33.37', '33.37', '33.36'] as $index => $amount) {
        $version = (int) rowOf('fin_payables', 'CXP-00402')->lock_version;
        $this->postJson('/api/v1/finance/payables/CXP-00402/payouts', ['method' => 'transferencia', 'amount' => $amount, 'paid_on' => '2026-09-29', 'operation_ref' => "OP-{$index}"], [...critical(), 'If-Match' => (string) $version])->assertCreated();
    }

    $payable = rowOf('fin_payables', 'CXP-00402');

    expect((string) $payable->paid_amount)->toBe('100.10')
        ->and($payable->status)->toBe('pagada');
});

it('un pago que supera el saldo por un céntimo se rechaza', function () {
    actingAsSeed('U07');
    withinTenant(tenantA(), fn () => DB::table('fin_payables')->where('code', 'CXP-00402')->update(['amount' => '100.10', 'paid_amount' => 0, 'status' => 'aprobada', 'approved_at' => now()]));
    $version = (int) rowOf('fin_payables', 'CXP-00402')->lock_version;

    $response = $this->postJson('/api/v1/finance/payables/CXP-00402/payouts', ['method' => 'transferencia', 'amount' => '100.11', 'paid_on' => '2026-09-29', 'operation_ref' => 'OP-X'], [...critical(), 'If-Match' => (string) $version]);

    expect($response)->toBeApiError(422, 'FIN-BR-22');
});

it('la diferencia por temporada al reprogramar es la suma exacta de las líneas', function () {
    actingAsSeed('U01');
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('status', 'confirmada')->orderByDesc('travel_from')->first(['id', 'code', 'travel_from']));
    withinTenant(tenantA(), function () use ($reservation): void {
        $season = (string) DB::table('catalog_seasons')->insertGetId(['ref' => 'TMP-ALTA', 'name' => 'Alta de prueba', 'type' => 'Alta', 'date_from' => '2026-11-01', 'date_to' => '2026-12-31', 'priority' => 9, 'factor' => '1.137'], 'id');
        $product = (string) DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('code')->value('id');
        DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->update(['product_id' => $product]);
        DB::table('catalog_product_seasons')->where('product_id', $product)->delete();
        DB::table('catalog_product_seasons')->insert(['product_id' => $product, 'season_id' => $season]);
    });
    $start = CarbonImmutable::parse($reservation->travel_from)->addDays(35)->toDateString();

    $plan = $this->postJson("/api/v1/reservations/{$reservation->code}/reschedule/preview", ['new_start' => $start])->assertOk()->json('data');
    $sum = collect($plan['lines'])->reduce(fn (string $carry, array $line): string => bcadd($carry, bcsub($line['new_price'], $line['price'], 2), 2), '0.00');

    expect($plan['diff'])->toBe($sum)
        ->and(bccomp($plan['diff'], '0', 2))->toBe(1);
});

it('agregar un pasajero reparte el cargo entre los servicios y la reserva sube exactamente lo mismo', function () {
    actingAsSeed('U01');
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('status', 'confirmada')->orderByDesc('travel_from')->first(['id', 'code', 'total_amount', 'lock_version']));
    withinTenant(tenantA(), fn () => DB::table('booking_inventory_holds')->where('reservation_id', $reservation->id)->update(['status' => 'liberada']));
    $before = withinTenant(tenantA(), fn () => servicesTotal($reservation->id));

    $preview = $this->postJson("/api/v1/reservations/{$reservation->code}/changes/preview", ['type' => 'pax', 'extra_pax' => 1])->assertOk()->json('data');
    $this->postJson("/api/v1/reservations/{$reservation->code}/changes", ['type' => 'pax', 'extra_pax' => 1, 'description' => 'Se suma un pasajero', 'delta' => '100.01', 'apply_now' => true], [...critical(), 'If-Match' => (string) $reservation->lock_version])->assertSuccessful();

    [$after, $total] = withinTenant(tenantA(), fn () => [servicesTotal($reservation->id), (string) DB::table('booking_reservations')->where('id', $reservation->id)->value('total_amount')]);

    expect($preview['suggested'])->toMatch('/^\d+\.\d{2}$/')
        ->and(bcsub($after, $before, 2))->toBe('100.01')
        ->and($total)->toBe(bcadd((string) $reservation->total_amount, '100.01', 2));
});
