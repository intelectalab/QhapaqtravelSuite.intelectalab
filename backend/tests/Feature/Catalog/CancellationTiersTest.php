<?php

use App\Domain\Catalog\Support\CancellationTiers;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

function tiersLock(string $code): int
{
    return (int) rowOf('catalog_products', $code)->lock_version;
}

function tiersPolicies(array $extra = []): array
{
    return ['cancellation' => 'Sin costo hasta 30 días antes.', 'modification' => 'Cambios sujetos a disponibilidad.', 'no_show' => 'Se cobra el 100 %.', 'refund' => 'Reembolso en 15 días hábiles.', ...$extra];
}

it('H-10: los tramos se deducen del texto solo como respaldo y se describen en lenguaje claro', function () {
    expect(CancellationTiers::fromText('Sin penalidad hasta 15 días antes. 50% entre 14 y 7 días. 100% dentro de 7 días o no-show.'))->toBe(CancellationTiers::STANDARD)
        ->and(CancellationTiers::fromText('Sin penalidad hasta 48 h antes.'))->toBe([['min_days' => 2, 'pct' => 0], ['min_days' => 0, 'pct' => 100]])
        ->and(CancellationTiers::resolve('[{"min_days": 30, "pct": 0}, {"min_days": 0, "pct": 80}]', 'cualquier texto'))->toBe([['min_days' => 30, 'pct' => 0], ['min_days' => 0, 'pct' => 80]])
        ->and(CancellationTiers::pct([['min_days' => 0, 'pct' => 80], ['min_days' => 30, 'pct' => 0]], 12))->toBe(80)
        ->and(CancellationTiers::pct([['min_days' => 30, 'pct' => 0]], 5))->toBe(100)
        ->and(CancellationTiers::describe(CancellationTiers::STANDARD))->toBe('15 días o más: sin penalidad · 7 a 14 días: 50 % · Menos de 7 días: 100 %');
});

it('H-10: la política del producto guarda tramos estructurados, los audita y los devuelve en el editor', function () {
    actingAsSeed('U01');
    $tiers = [['min_days' => 0, 'pct' => 100], ['min_days' => 30, 'pct' => 0], ['min_days' => 10, 'pct' => 40]];

    $data = $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/policies', ['lock_version' => tiersLock('LOR-AMZ-4D'), ...tiersPolicies(['penalty_tiers' => $tiers])], critical(tiersLock('LOR-AMZ-4D')))->assertOk()->json('data.policies');

    $stored = withinTenant(tenantA(), fn () => DB::table('catalog_product_policies')->where('product_id', rowOf('catalog_products', 'LOR-AMZ-4D')->id)->value('penalty_tiers'));
    expect($data['penalty_tiers'])->toBe([['min_days' => 30, 'pct' => 0], ['min_days' => 10, 'pct' => 40], ['min_days' => 0, 'pct' => 100]])
        ->and($data['tiers_from_text'])->toBeFalse()
        ->and(CancellationTiers::normalize($stored))->toBe($data['penalty_tiers'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Producto', 'entity_id' => 'LOR-AMZ-4D'])->where('after_value', 'like', 'Tramos de cancelación:%')->exists()))->toBeTrue();
});

it('H-10: los tramos se validan (días distintos, de 0 a 365; penalidad de 0 a 100)', function () {
    actingAsSeed('U01');
    $lock = tiersLock('LOR-AMZ-4D');

    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/policies', ['lock_version' => $lock, ...tiersPolicies(['penalty_tiers' => [['min_days' => 7, 'pct' => 50], ['min_days' => 7, 'pct' => 20]]])], critical($lock))
        ->assertStatus(422)->assertJsonValidationErrors('penalty_tiers.0.min_days');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/policies', ['lock_version' => $lock, ...tiersPolicies(['penalty_tiers' => [['min_days' => 400, 'pct' => 150]]])], critical($lock))
        ->assertStatus(422)->assertJsonValidationErrors(['penalty_tiers.0.min_days', 'penalty_tiers.0.pct']);
});

it('H-10: la cancelación cobra según los tramos congelados en la reserva, aunque el producto cambie después', function () {
    Queue::fake();
    freezeBusinessToday();
    actingAsSeed('U01');
    $productId = rowOf('catalog_products', 'CUS-HUM-FD')->id;
    $setTiers = fn (array $tiers) => withinTenant(tenantA(), fn () => DB::table('catalog_product_policies')->updateOrInsert(['product_id' => $productId], [...tiersPolicies(), 'penalty_tiers' => json_encode($tiers)]));
    $setTiers([['min_days' => 0, 'pct' => 35]]);

    $code = (string) $this->postJson('/api/v1/reservations', ['client_id' => 'CLI-0003', 'product_id' => 'CUS-HUM-FD', 'departure_id' => departureRow('SAL-0403')->id, 'adt' => 2, 'confirm' => false], critical())->assertCreated()->json('data.code');
    $snapshot = json_decode((string) rowOf('booking_reservations', $code)->policies_snapshot, true);
    $setTiers([['min_days' => 0, 'pct' => 90]]);

    $lines = collect($this->postJson("/api/v1/reservations/{$code}/cancellation/preview")->assertOk()->json('data.lines'));
    $line = $lines->first();

    expect(CancellationTiers::normalize($snapshot['CUS-HUM-FD']['penalty_tiers'] ?? null))->toBe([['min_days' => 0, 'pct' => 35]])
        ->and($lines->pluck('pct')->unique()->values()->all())->toBe([35])
        ->and($line['tiers_source'])->toBe('tramos')
        ->and($line['tiers'])->toBe('En cualquier momento: 35 %')
        ->and($line['penalty'])->toBe(number_format(round((float) $line['price'] * 0.35, 2), 2, '.', ''));

    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', $code)->update(['policies_snapshot' => '{}']));
    expect(collect($this->postJson("/api/v1/reservations/{$code}/cancellation/preview")->assertOk()->json('data.lines'))->pluck('pct')->unique()->values()->all())->toBe([90]);
});

it('H-10: el asistente propone los tramos estándar para un producto nuevo', function () {
    actingAsSeed('U01');

    $defaults = $this->getJson('/api/v1/catalog/products/form-options')->assertOk()->json('data.defaults.policies.penalty_tiers');

    expect($defaults)->toBe(CancellationTiers::STANDARD);
});
