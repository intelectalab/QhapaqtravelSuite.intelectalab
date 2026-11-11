<?php

use Illuminate\Routing\Middleware\ThrottleRequests;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

it('RBAC: el detalle del rol trae sus usuarios, cuántas pantallas ve y la auditoría de cambios de permisos', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/iam/roles/sales/permissions/bulk', ['permissions' => ['admin.audit.view'], 'grant' => true], critical())->assertOk();
    $detail = $this->getJson('/api/v1/iam/roles/sales')->assertOk()->json('data');

    expect($detail['code'])->toBe('sales')
        ->and($detail['users'])->not->toBeEmpty()
        ->and($detail['users'][0])->toHaveKeys(['code', 'name', 'email', 'status', 'sede'])
        ->and($detail['screens']['allowed'])->toBeGreaterThan(0)
        ->and($detail['screens']['total'])->toBeGreaterThanOrEqual($detail['screens']['allowed'])
        ->and(collect($detail['audit'])->pluck('permission'))->toContain('admin.audit.view');

    expect($this->getJson('/api/v1/iam/roles/super_admin'))->toBeApiError(404);
    expect($this->getJson('/api/v1/iam/roles/no-existe'))->toBeApiError(404);
});

it('solo quien configura roles ve el detalle de un rol', function () {
    actingAsSeed('U03');
    expect($this->getJson('/api/v1/iam/roles/sales')->status())->toBe(403);
});
