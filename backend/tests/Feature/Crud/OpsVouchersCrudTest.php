<?php

use Illuminate\Support\Facades\DB;

function opsVouAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function opsVouLock(string $code): int
{
    return (int) rowOf('ops_vouchers', $code)->lock_version;
}

it('emite una nueva versión del voucher con su motivo y conserva el código', function () {
    actingAsSeed('U05');
    $before = rowOf('ops_vouchers', 'VOU-2026-01201');

    $this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/versions', ['reason' => 'x'], critical(opsVouLock('VOU-2026-01201')))->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/versions', ['reason' => 'Cambio de hora de recojo.'], critical(opsVouLock('VOU-2026-01201')))->assertOk()->assertJsonPath('data.code', 'VOU-2026-01201');

    $after = rowOf('ops_vouchers', 'VOU-2026-01201');
    $version = withinTenant(tenantA(), fn () => DB::table('ops_voucher_versions')->where('voucher_id', $after->id)->where('version', 2)->first());
    expect((int) $after->version)->toBe(2)
        ->and($after->status)->toBe('emitido')
        ->and($after->qr_token)->not->toBe($before->qr_token)
        ->and($version->reason)->toBe('Cambio de hora de recojo.')
        ->and(json_decode((string) $version->snapshot, true)['service'])->toBe($after->service_label)
        ->and(opsVouAudit(['entity' => 'Voucher', 'entity_id' => 'VOU-2026-01201', 'action' => 'versionar', 'before_value' => 'v1']))->toBeTrue();

    $listed = collect($this->getJson('/api/v1/ops/vouchers')->assertOk()->json('data.items'))->firstWhere('code', 'VOU-2026-01201');
    expect($listed['version'])->toBe(2);
});

it('no versiona un voucher cuyo servicio ya no está confirmado', function () {
    actingAsSeed('U05');
    withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('code', 'RS-3476')->update(['status' => 'cancelado']));

    expect($this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/versions', ['reason' => 'Cambio de hora de recojo.'], critical(opsVouLock('VOU-2026-01201'))))->toBeApiError(422, 'OPS-BR-44');
    expect((int) rowOf('ops_vouchers', 'VOU-2026-01201')->version)->toBe(1);
});

it('marca el voucher como utilizado y ya no se puede versionar ni anular', function () {
    $actor = actingAsSeed('U05');

    $this->postJson('/api/v1/ops/vouchers/VOU-2026-01203/redeem', [], critical(opsVouLock('VOU-2026-01203')))->assertOk();
    $row = rowOf('ops_vouchers', 'VOU-2026-01203');
    expect($row->status)->toBe('utilizado')
        ->and($row->used_by)->toBe($actor->getKey())
        ->and($row->used_via)->toBe('web')
        ->and(opsVouAudit(['entity' => 'Voucher', 'entity_id' => 'VOU-2026-01203', 'action' => 'marcar_utilizado']))->toBeTrue();

    expect($this->postJson('/api/v1/ops/vouchers/VOU-2026-01203/redeem', [], critical(opsVouLock('VOU-2026-01203'))))->toBeApiError(409, 'OPS-BR-45');
    expect($this->postJson('/api/v1/ops/vouchers/VOU-2026-01203/void', ['reason' => 'Error de emisión.'], critical(opsVouLock('VOU-2026-01203'))))->toBeApiError(409, 'OPS-BR-45');
    expect($this->postJson('/api/v1/ops/vouchers/VOU-2026-01203/versions', ['reason' => 'Cambio tardío.'], critical(opsVouLock('VOU-2026-01203'))))->toBeApiError(409, 'OPS-BR-45');
    $this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/redeem', [], critical(opsVouLock('VOU-2026-01201') + 2))->assertStatus(409);
});

it('anula el voucher con motivo, lo conserva en el historial y libera el servicio para otro voucher', function () {
    actingAsSeed('U05');

    $this->postJson('/api/v1/ops/vouchers/VOU-2026-01204/void', [], critical(opsVouLock('VOU-2026-01204')))->assertStatus(422)->assertJsonValidationErrors('reason');
    expect($this->postJson('/api/v1/ops/vouchers', ['service_code' => 'RS-3482'], critical()))->toBeApiError(409, 'OPS-BR-41');

    $this->postJson('/api/v1/ops/vouchers/VOU-2026-01204/void', ['reason' => 'El hotel cambió la categoría.'], critical(opsVouLock('VOU-2026-01204')))->assertOk();
    $row = rowOf('ops_vouchers', 'VOU-2026-01204');
    expect($row->status)->toBe('anulado')
        ->and($row->void_reason)->toBe('El hotel cambió la categoría.')
        ->and($row->void_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/ops/vouchers')->json('data.items'))->firstWhere('code', 'VOU-2026-01204')['status'])->toBe('anulado')
        ->and(opsVouAudit(['entity' => 'Voucher', 'entity_id' => 'VOU-2026-01204', 'action' => 'anular']))->toBeTrue();

    $code = $this->postJson('/api/v1/ops/vouchers', ['service_code' => 'RS-3482', 'note' => 'Reemplaza al anulado.'], critical())->assertCreated()->json('data.code');
    expect($code)->not->toBe('VOU-2026-01204')
        ->and(rowOf('ops_vouchers', $code)->reservation_service_id)->toBe(serviceRow('RS-3482')->id);
});

it('solo quien gestiona vouchers los versiona, usa o anula, y otra agencia no los ve', function () {
    foreach (['U03', 'U07'] as $user) {
        actingAsSeed($user);
        expect($this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/versions', ['reason' => 'Cambio ajeno.'], critical(opsVouLock('VOU-2026-01201'))))->toBeApiError(403);
        expect($this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/redeem', [], critical(opsVouLock('VOU-2026-01201'))))->toBeApiError(403);
        expect($this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/void', ['reason' => 'Anulación ajena.'], critical(opsVouLock('VOU-2026-01201'))))->toBeApiError(403);
    }

    actingAsTenantBAdmin();
    $this->postJson('/api/v1/ops/vouchers/VOU-2026-01201/void', ['reason' => 'Desde otra agencia.'], critical(opsVouLock('VOU-2026-01201')))->assertNotFound();
    expect(rowOf('ops_vouchers', 'VOU-2026-01201')->status)->toBe('emitido');
});
