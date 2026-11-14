<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Spatie\Permission\PermissionRegistrar;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function plataformaSoloUsuarios(): void
{
    $user = actingAsSeed('U03');
    withinTenant(tenantA(), fn () => $user->givePermissionTo('admin.users.manage'));
    app(PermissionRegistrar::class)->forgetCachedPermissions();
}

it('G5-20: quien administra usuarios lee roles, permisos, matriz y mapa de acceso', function () {
    plataformaSoloUsuarios();

    $this->getJson('/api/v1/iam/roles')->assertOk();
    $this->getJson('/api/v1/iam/roles/sales')->assertOk();
    $this->getJson('/api/v1/iam/permissions')->assertOk();
    $this->getJson('/api/v1/iam/role-permissions')->assertOk();
    $this->getJson('/api/v1/iam/access-map')->assertOk();
    expect($this->getJson('/api/v1/me/access')->json('data.routes'))->toContain('/admin/roles');
});

it('G5-20: sin admin.roles.manage no crea, edita, elimina ni cambia permisos', function () {
    plataformaSoloUsuarios();

    $forbidden = $this->postJson('/api/v1/iam/roles', ['name' => 'Rol nuevo', 'description' => 'Prueba', 'scope' => 'tenant']);
    expect($forbidden)->toBeApiError(403)
        ->and($forbidden->json('required_permissions'))->toContain('admin.roles.manage');
    expect($this->patchJson('/api/v1/iam/roles/sales', ['name' => 'Otro', 'description' => 'Otro']))->toBeApiError(403);
    expect($this->deleteJson('/api/v1/iam/roles/sales'))->toBeApiError(403);
    expect($this->postJson('/api/v1/iam/roles/sales/permissions/bulk', ['permissions' => ['admin.audit.view'], 'grant' => true], critical()))->toBeApiError(403);
});

it('G5-20: sin ninguno de los dos permisos no se leen los roles', function () {
    actingAsSeed('U03');

    $response = $this->getJson('/api/v1/iam/access-map');
    expect($response)->toBeApiError(403)
        ->and($response->json('required_permissions'))->toContain('admin.roles.manage', 'admin.users.manage');
});
