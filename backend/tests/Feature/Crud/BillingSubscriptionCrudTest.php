<?php

use Illuminate\Support\Facades\DB;

function billBody(array $overrides = []): array
{
    return [
        'ruc' => '20612345671',
        'name' => 'Andes Horizonte Viajes S.A.C.',
        'address' => 'Av. El Sol 820, Cusco',
        'ubigeo' => '080101',
        'email' => 'facturas@andeshorizonte.pe',
        ...$overrides,
    ];
}

it('actualizar los datos de facturación los guarda en la suscripción y la pantalla los muestra', function () {
    actingAsSeed('U01');

    $changed = $this->patchJson('/api/v1/billing/subscription', billBody())->assertOk()->json('data.changed');

    expect($changed)->toContain('billing_ruc', 'billing_email');
    $this->getJson('/api/v1/billing/subscription')->assertOk()
        ->assertJsonPath('data.subscription.billing.ruc', '20612345671')
        ->assertJsonPath('data.subscription.billing.name', 'Andes Horizonte Viajes S.A.C.')
        ->assertJsonPath('data.subscription.billing.address', 'Av. El Sol 820, Cusco')
        ->assertJsonPath('data.subscription.billing.ubigeo', '080101')
        ->assertJsonPath('data.subscription.billing.email', 'facturas@andeshorizonte.pe');

    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Suscripción', 'entity_id' => 'facturacion.ruc', 'action' => 'actualizar', 'after_value' => '20612345671'])->exists()))->toBeTrue();
});

it('solo audita los campos que cambian y rechaza guardar sin cambios', function () {
    actingAsSeed('U01');
    $this->patchJson('/api/v1/billing/subscription', billBody())->assertOk();

    expect($this->patchJson('/api/v1/billing/subscription', billBody()))->toBeApiError(422, 'CFG-BR-01');

    $changed = $this->patchJson('/api/v1/billing/subscription', billBody(['email' => 'contabilidad@andeshorizonte.pe']))->assertOk()->json('data.changed');
    expect($changed)->toBe(['billing_email']);
});

it('SUB-BR-09: valida RUC, correo, ubigeo y campos obligatorios', function () {
    actingAsSeed('U01');
    $before = $this->getJson('/api/v1/billing/subscription')->assertOk()->json('data.subscription.billing');

    $this->patchJson('/api/v1/billing/subscription', billBody(['ruc' => '30612345671', 'email' => 'no-es-correo', 'ubigeo' => '0801', 'name' => '']))
        ->assertStatus(422)->assertJsonValidationErrors(['ruc', 'email', 'ubigeo', 'name']);

    expect($this->getJson('/api/v1/billing/subscription')->json('data.subscription.billing'))->toBe($before);
});

it('solo la Administración cambia los datos de facturación', function (string $user) {
    actingAsSeed($user);

    expect($this->patchJson('/api/v1/billing/subscription', billBody()))->toBeApiError(403);
})->with(['U02', 'U07']);
