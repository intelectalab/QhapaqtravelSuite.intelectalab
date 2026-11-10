<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function chnAgencyBody(array $overrides = []): array
{
    return [
        'legal_name' => 'Inka Rutas Operador E.I.R.L.',
        'ruc' => '20611122233',
        'contact_name' => 'Milagros Quispe',
        'booking_email' => 'reservas@inkarutas.pe',
        'price_list_id' => withinTenant(tenantA(), fn () => DB::table('channel_b2b_price_lists')->where('name', 'Mayorista 2026')->value('id')),
        'commission_pct' => '8.5',
        'currency' => 'PEN',
        'credit_limit' => '12000.50',
        'valid_from' => '2026-09-01',
        'valid_to' => '2027-08-31',
        ...$overrides,
    ];
}

function chnAgencyEdit(string $code, array $overrides = []): array
{
    $row = rowOf('channel_b2b_agencies', $code);

    return [
        'legal_name' => $row->legal_name,
        'ruc' => $row->ruc,
        'contact_name' => $row->contact_name,
        'booking_email' => $row->booking_email,
        'client' => $row->crm_client_id ? withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $row->crm_client_id)->value('code')) : null,
        'price_list_id' => $row->price_list_id,
        'commission_pct' => (string) $row->commission_pct,
        'currency' => $row->credit_currency,
        'credit_limit' => (string) $row->credit_limit,
        'valid_from' => $row->valid_from,
        'valid_to' => $row->valid_to,
        ...$overrides,
    ];
}

function chnAgencyLock(string $code): int
{
    return (int) rowOf('channel_b2b_agencies', $code)->lock_version;
}

function chnAgencyAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Agencia B2B', 'entity_id' => $code, 'action' => $action])->exists());
}

beforeEach(fn () => Queue::fake());

it('dar de alta una agencia aliada la deja activa, sin crédito usado y en el listado', function () {
    actingAsSeed('U02');

    $code = $this->postJson('/api/v1/channels/b2b/agencies', chnAgencyBody())->assertCreated()->json('data.code');
    $row = rowOf('channel_b2b_agencies', $code);

    expect($code)->toBe('AGB-04')
        ->and($row->status)->toBe('activa')
        ->and($row->legal_name)->toBe('Inka Rutas Operador E.I.R.L.')
        ->and((string) $row->commission_pct)->toBe('8.50')
        ->and((string) $row->credit_limit)->toBe('12000.50')
        ->and((string) $row->credit_used)->toBe('0.00')
        ->and($row->credit_currency)->toBe('PEN')
        ->and(collect($this->getJson('/api/v1/channels/b2b')->assertOk()->json('data.items'))->pluck('code'))->toContain($code)
        ->and(chnAgencyAudit($code, 'crear'))->toBeTrue();
});

it('B2B-BR-01 / B2B-BR-09: RUC único de 11 dígitos, comisión de 0 a 30 % y vigencia coherente', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/channels/b2b/agencies', chnAgencyBody(['ruc' => rowOf('channel_b2b_agencies', 'AGB-01')->ruc])))->toBeApiError(409, 'B2B-BR-01');
    $this->postJson('/api/v1/channels/b2b/agencies', chnAgencyBody(['ruc' => '2061112223', 'commission_pct' => '35', 'valid_to' => '2026-08-01', 'legal_name' => '', 'price_list_id' => '00000000-0000-0000-0000-000000000000']))
        ->assertStatus(422)->assertJsonValidationErrors(['ruc', 'commission_pct', 'valid_to', 'legal_name', 'price_list_id']);

    expect(withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->count()))->toBe(3);
});

it('editar una agencia cambia su convenio y la nueva línea de crédito se ve en el portal de la agencia', function () {
    actingAsSeed('U01');
    $used = (string) rowOf('channel_b2b_agencies', 'AGB-01')->credit_used;

    $this->patchJson('/api/v1/channels/b2b/agencies/AGB-01', chnAgencyEdit('AGB-01', ['credit_limit' => '40000.00', 'contact_name' => 'Rosa Huamán']), critical(chnAgencyLock('AGB-01')))->assertOk();

    $row = rowOf('channel_b2b_agencies', 'AGB-01');
    expect((string) $row->credit_limit)->toBe('40000.00')
        ->and($row->contact_name)->toBe('Rosa Huamán')
        ->and((string) $row->credit_used)->toBe($used)
        ->and(chnAgencyAudit('AGB-01', 'editar'))->toBeTrue();

    actingAsSeed('U13');
    $credit = $this->postJson('/api/v1/b2b/reservations/quote-price', ['product' => 'CUS-HUM-FD', 'date' => '2026-10-06', 'adults' => 2])->assertOk()->json('data.credit');
    expect((string) $credit['available'])->toBe(bcsub('40000.00', $used, 2));
});

it('editar sin línea de crédito la deja en cero en lugar de fallar', function () {
    actingAsSeed('U01');
    $body = chnAgencyEdit('AGB-02', ['contact_name' => 'Nuevo contacto']);
    unset($body['credit_limit']);

    $this->patchJson('/api/v1/channels/b2b/agencies/AGB-02', $body, critical(chnAgencyLock('AGB-02')))->assertOk();

    expect((string) rowOf('channel_b2b_agencies', 'AGB-02')->credit_limit)->toBe('0.00')
        ->and(rowOf('channel_b2b_agencies', 'AGB-02')->contact_name)->toBe('Nuevo contacto');
});

it('B2B-BR-03: la línea no baja del crédito ya utilizado, el RUC sigue siendo único y se exige la versión', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/channels/b2b/agencies/AGB-01', chnAgencyEdit('AGB-01', ['credit_limit' => '100.00']), critical(chnAgencyLock('AGB-01'))))->toBeApiError(422, 'B2B-BR-03')
        ->and($this->patchJson('/api/v1/channels/b2b/agencies/AGB-01', chnAgencyEdit('AGB-01', ['ruc' => rowOf('channel_b2b_agencies', 'AGB-02')->ruc]), critical(chnAgencyLock('AGB-01'))))->toBeApiError(409, 'B2B-BR-01')
        ->and($this->patchJson('/api/v1/channels/b2b/agencies/AGB-01', chnAgencyEdit('AGB-01'), critical()))->toBeApiError(428, 'IF_MATCH_REQUIRED')
        ->and($this->patchJson('/api/v1/channels/b2b/agencies/AGB-01', chnAgencyEdit('AGB-01'), critical(chnAgencyLock('AGB-01') + 3)))->toBeApiError(409, 'STALE_VERSION')
        ->and((string) rowOf('channel_b2b_agencies', 'AGB-01')->credit_limit)->toBe('25000.00');
});

it('bloquear una agencia le impide reservar a crédito, pero puede seguir con prepago', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/channels/b2b/agencies/AGB-01/block', ['reason' => 'Pagos vencidos'], critical(chnAgencyLock('AGB-01')))->assertOk();

    actingAsSeed('U13');
    $body = ['product' => 'CUS-HUM-FD', 'date' => '2026-10-06', 'adults' => 2, 'agency_ref' => 'WAY-BLQ'];
    $count = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->count());

    expect($this->postJson('/api/v1/b2b/reservations', [...$body, 'pay_mode' => 'credito'], critical()))->toBeApiError(422, 'B2B-BR-03')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->count()))->toBe($count);

    $code = $this->postJson('/api/v1/b2b/reservations', [...$body, 'pay_mode' => 'prepago'], critical())->assertOk()->json('data.code');
    expect(reservationRow($code)->status)->toBe('pendiente_pago');
});

it('desactivar una agencia es lógico: conserva su historial y el portal deja de permitirle reservar', function () {
    actingAsSeed('U01');

    $this->deleteJson('/api/v1/channels/b2b/agencies/AGB-01', ['reason' => 'Fin del convenio'])->assertOk()->assertJsonPath('data.code', 'AGB-01');

    $row = rowOf('channel_b2b_agencies', 'AGB-01');
    expect($row->status)->toBe('inactiva')
        ->and($row->deleted_at)->toBeNull()
        ->and((string) $row->credit_used)->toBe('8960.00')
        ->and(collect($this->getJson('/api/v1/channels/b2b')->assertOk()->json('data.items'))->firstWhere('code', 'AGB-01')['status'])->toBe('inactiva')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Agencia B2B', 'entity_id' => 'AGB-01', 'action' => 'desactivar'])->where('after_value', 'like', '%Fin del convenio%')->exists()))->toBeTrue();

    expect($this->deleteJson('/api/v1/channels/b2b/agencies/AGB-01'))->toBeApiError(409, 'B2B-BR-05');

    actingAsSeed('U13');
    expect($this->postJson('/api/v1/b2b/reservations', ['product' => 'CUS-HUM-FD', 'date' => '2026-10-06', 'adults' => 2, 'pay_mode' => 'prepago'], critical()))->toBeApiError(403, 'B2B-BR-02');
});

it('Ventas no administra agencias aliadas', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/channels/b2b/agencies', chnAgencyBody()))->toBeApiError(403)
        ->and($this->patchJson('/api/v1/channels/b2b/agencies/AGB-02', chnAgencyEdit('AGB-02'), critical(chnAgencyLock('AGB-02'))))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/channels/b2b/agencies/AGB-02'))->toBeApiError(403)
        ->and(rowOf('channel_b2b_agencies', 'AGB-02')->status)->toBe('activa');
});
