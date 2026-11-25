<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('lista los medios de cobro con sus usos y la cuenta que los recibe', function () {
    actingAsSeed('U01');
    $data = $this->getJson('/api/v1/treasury/payment-methods')->assertOk()->json('data');
    $rows = collect($data['rows']);

    expect($data['can']['manage'])->toBeTrue()
        ->and($rows->pluck('code'))->toContain('yape', 'credito_b2b', 'transferencia_bcp')
        ->and($rows->firstWhere('code', 'yape'))->toMatchArray(['label' => 'Yape', 'b2b' => false, 'active' => true, 'destination' => 'bank'])
        ->and($rows->firstWhere('code', 'yape')['accounts']['PEN'])->not->toBeNull()
        ->and($rows->firstWhere('code', 'credito_b2b')['destination'])->toBe('none')
        ->and($rows->sum('uses'))->toBeGreaterThan(0);
});

it('crea, renombra, desactiva y elimina un medio de cobro, con auditoría', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/treasury/payment-methods', ['label' => '  Depósito   en agente ', 'requires_reference' => true])->assertCreated()->json('data.code');
    expect($code)->toBe('deposito_en_agente');
    expect(collect($this->getJson('/api/v1/finance/receivables/'.withinTenant(tenantA(), fn () => DB::table('fin_receivables')->whereNull('deleted_at')->orderBy('code')->value('code')))->json('data.methods'))->pluck('value'))->toContain('deposito_en_agente');

    expect($this->postJson('/api/v1/treasury/payment-methods', ['label' => 'depósito en agente']))->toBeApiError(409, 'FIN-PM-01');
    expect($this->postJson('/api/v1/treasury/payment-methods', ['label' => 'Yape']))->toBeApiError(409, 'FIN-PM-01');
    expect($this->postJson('/api/v1/treasury/payment-methods', ['label' => 'ab']))->toBeApiError(422);

    $this->patchJson("/api/v1/treasury/payment-methods/{$code}", ['label' => 'Depósito en agente BCP', 'requires_reference' => false])->assertOk();
    $row = collect($this->getJson('/api/v1/treasury/payment-methods')->json('data.rows'))->firstWhere('code', $code);
    expect($row)->toMatchArray(['label' => 'Depósito en agente BCP', 'requires_reference' => false]);
    expect($this->patchJson("/api/v1/treasury/payment-methods/{$code}", ['label' => 'Plin']))->toBeApiError(409, 'FIN-PM-01');

    $this->patchJson("/api/v1/treasury/payment-methods/{$code}", ['active' => false])->assertOk();
    expect(collect($this->getJson('/api/v1/treasury/payment-methods')->json('data.rows'))->firstWhere('code', $code)['active'])->toBeFalse();

    $this->deleteJson("/api/v1/treasury/payment-methods/{$code}")->assertNoContent();
    expect(withinTenant(tenantA(), fn () => DB::table('fin_payment_methods')->where('code', $code)->exists()))->toBeFalse();

    $actions = withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Medio de cobro')->where('entity_id', $code)->pluck('action')->all());
    expect($actions)->toContain('crear', 'editar', 'eliminar');
});

it('protege el crédito B2B, los medios con pagos y el último medio activo', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/treasury/payment-methods/credito_b2b', ['active' => false]))->toBeApiError(409, 'FIN-PM-02');
    expect($this->deleteJson('/api/v1/treasury/payment-methods/credito_b2b'))->toBeApiError(409, 'FIN-PM-02');

    $used = withinTenant(tenantA(), fn () => DB::table('fin_payments')->groupBy('method')->orderByRaw('count(*) desc')->value('method'));
    expect($this->deleteJson("/api/v1/treasury/payment-methods/{$used}"))->toBeApiError(409, 'FIN-PM-04');

    withinTenant(tenantA(), fn () => DB::table('fin_payment_methods')->where('is_b2b_credit', false)->where('code', '<>', 'yape')->update(['active' => false]));
    expect($this->patchJson('/api/v1/treasury/payment-methods/yape', ['active' => false]))->toBeApiError(409, 'FIN-PM-03');

    $this->patchJson('/api/v1/treasury/payment-methods/no_existe', ['label' => 'Algo nuevo'])->assertNotFound();
});

it('solo quien configura la agencia cambia el catálogo', function () {
    actingAsSeed('U07');
    expect($this->getJson('/api/v1/treasury/payment-methods')->assertOk()->json('data.can.manage'))->toBeFalse();
    expect($this->postJson('/api/v1/treasury/payment-methods', ['label' => 'Depósito en agente']))->toBeApiError(403);
    expect($this->patchJson('/api/v1/treasury/payment-methods/yape', ['label' => 'Yape empresa']))->toBeApiError(403);
    expect($this->deleteJson('/api/v1/treasury/payment-methods/yape'))->toBeApiError(403);
});

it('elige desde el panel del medio la cuenta de tesorería que lo recibe, y la regla queda auditada', function () {
    actingAsSeed('U01');
    $catalog = $this->getJson('/api/v1/treasury/payment-methods')->assertOk()->json('data');
    expect($catalog['banks'])->not->toBeEmpty();
    $bank = $catalog['banks'][0];

    $code = $this->postJson('/api/v1/treasury/payment-methods', ['label' => 'Efectivo en counter', 'requires_reference' => false, 'destination' => 'petty_cash'])->assertCreated()->json('data.code');
    expect(collect($this->getJson('/api/v1/treasury/payment-methods')->json('data.rows'))->firstWhere('code', $code))->toMatchArray(['destination' => 'petty_cash', 'bank' => null]);

    $this->patchJson("/api/v1/treasury/payment-methods/{$code}", ['destination' => 'bank', 'bank' => mb_strtolower($bank), 'currency' => 'PEN'])->assertOk();
    $row = collect($this->getJson('/api/v1/treasury/payment-methods')->json('data.rows'))->firstWhere('code', $code);
    expect($row)->toMatchArray(['destination' => 'bank', 'bank' => $bank, 'currency' => 'PEN'])->and($row['accounts']['PEN'])->not->toBeNull();
    expect(collect($this->getJson('/api/v1/treasury/settings')->json('data.payment_routing'))->firstWhere('method', $code)['destination'])->toBe('bank');

    expect($this->patchJson("/api/v1/treasury/payment-methods/{$code}", ['destination' => 'bank']))->toBeApiError(422);
    expect($this->patchJson("/api/v1/treasury/payment-methods/{$code}", ['destination' => 'bank', 'bank' => 'Banco que no existe']))->toBeApiError(422);
    expect($this->patchJson('/api/v1/treasury/payment-methods/credito_b2b', ['destination' => 'bank', 'bank' => $bank]))->toBeApiError(422, 'TES-BR-04');
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Configuración de tesorería')->where('entity_id', 'tesoreria')->where('action', 'editar')->exists()))->toBeTrue();
});
