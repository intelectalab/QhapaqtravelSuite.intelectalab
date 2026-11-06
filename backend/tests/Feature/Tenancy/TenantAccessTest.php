<?php

use Illuminate\Support\Facades\DB;

it('T-06: un usuario de un tenant suspendido no inicia sesión (403 TENANT_SUSPENDED)', function () {
    $suspended = tenantByCode('TNT-0006');
    expect($suspended->status)->toBe('suspendido');

    expect(loginAs($suspended->admin_email))->toBeApiError(403, 'TENANT_SUSPENDED');
});

it('X-12: un token emitido antes de la suspensión del tenant responde 403 TENANT_SUSPENDED en cada solicitud', function () {
    $suspended = tenantByCode('TNT-0006');
    useToken(issueToken(seedUser('U01', $suspended), $suspended));

    expect($this->getJson('/api/v1/me'))->toBeApiError(403, 'TENANT_SUSPENDED');
    expect($this->getJson('/api/v1/crm/leads'))->toBeApiError(403, 'TENANT_SUSPENDED');
});

it('X-12 / T-10: el token de un usuario desactivado responde 401', function () {
    $user = seedUser('U06');
    useToken(issueToken($user, tenantA()));
    $this->getJson('/api/v1/me')->assertOk();

    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('id', $user->getKey())->update(['status' => 'inactivo', 'deactivated_at' => now()]));

    $this->getJson('/api/v1/me')->assertUnauthorized()->assertJsonPath('error', 'UNAUTHENTICATED');
});

it('X-11: con MFA obligatorio y sin verificar, un recurso responde 403 MFA_REQUIRED', function () {
    $admin = seedUser('U01');
    expect($admin->needsMfa())->toBeTrue();
    useToken(issueToken($admin, tenantA(), mfaVerified: false));

    expect($this->getJson('/api/v1/crm/leads'))->toBeApiError(403, 'MFA_REQUIRED');
});

it('el login real de un usuario sin MFA entrega un token que opera en su tenant', function () {
    $token = loginAs('lparedes@andeshorizonte.pe')->assertOk()->json('data.token');
    expect($token)->toBeString();

    useToken($token);

    $this->getJson('/api/v1/me')->assertOk();
});
