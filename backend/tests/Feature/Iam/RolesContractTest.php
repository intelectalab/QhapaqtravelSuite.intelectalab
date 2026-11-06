<?php

use App\Domain\Iam\Models\Role;
use Illuminate\Support\Facades\DB;

it('iam/users/{id} devuelve detalle, permisos efectivos y actividad por id o código', function () {
    actingAsSeed('U01');
    $user = seedUser('U03');

    $byId = $this->getJson("/api/v1/iam/users/{$user->id}")->assertOk()->json('data');
    $byCode = $this->getJson('/api/v1/iam/users/U03')->assertOk()->json('data');

    expect($byId['email'])->toBe('lparedes@andeshorizonte.pe')
        ->and($byId['permissions'])->toContain('quotes.view')
        ->and($byId['activity'])->toBeArray()
        ->and(count($byId['activity']))->toBeLessThanOrEqual(8)
        ->and($byCode['id'])->toBe($byId['id']);
    expect($this->getJson('/api/v1/iam/users/U99'))->toBeApiError(404);
});

it('el catálogo, la matriz y el mapa de acceso responden a admin.roles.manage', function () {
    actingAsSeed('U01');

    $catalog = $this->getJson('/api/v1/iam/permissions')->assertOk()->json('data');
    $matrix = $this->getJson('/api/v1/iam/role-permissions')->assertOk()->json('data');
    $map = $this->getJson('/api/v1/iam/access-map')->assertOk()->json('data');

    expect(collect($catalog)->pluck('permissions')->flatten())->toContain('quotes.view')->not->toContain('admin.tenant.manage')
        ->and($matrix['matrix']['sales']['quotes.view'])->toBeTrue()
        ->and($matrix['matrix']['sales']['admin.settings.manage'])->toBeFalse()
        ->and(collect($map['roles'])->firstWhere('role', 'sales')['screens']['/cotizaciones'])->toBeTrue()
        ->and(collect($map['roles'])->firstWhere('role', 'sales')['screens']['/admin/usuarios'])->toBeFalse()
        ->and(collect($map['roles'])->firstWhere('role', 'customer')['allowed'])->toBe(0);
});

it('responde 403 a quien no administra roles ni usuarios', function (string $method, string $uri) {
    actingAsSeed('U02');

    expect($this->json($method, $uri))->toBeApiError(403);
})->with([
    ['GET', '/api/v1/iam/users/U03'],
    ['GET', '/api/v1/iam/permissions'],
    ['GET', '/api/v1/iam/role-permissions'],
    ['GET', '/api/v1/iam/access-map'],
    ['PUT', '/api/v1/iam/roles/sales/permissions/reports.view'],
    ['DELETE', '/api/v1/iam/roles/sales/permissions/quotes.view'],
]);

it('PUT y DELETE otorgan y revocan un permiso y lo auditan', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/iam/roles/operations/permissions/reports.export')->assertOk()->assertJsonPath('data.granted', true);
    expect(withinTenant(tenantA(), fn () => Role::query()->where('name', 'operations')->first()->hasPermissionTo('reports.export')))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Permiso', 'entity_id' => 'operations:reports.export', 'action' => 'otorgar_permiso'])->exists()))->toBeTrue();

    $this->deleteJson('/api/v1/iam/roles/operations/permissions/reports.export')->assertNoContent();
    expect(withinTenant(tenantA(), fn () => Role::query()->where('name', 'operations')->first()->hasPermissionTo('reports.export')))->toBeFalse();
});

it('T-12: los bloqueos de seguridad responden 422 con su regla', function (string $method, string $role, string $permission, string $code) {
    actingAsSeed('U01');

    expect($this->json($method, "/api/v1/iam/roles/{$role}/permissions/{$permission}"))->toBeApiError(422, $code);
})->with([
    'revocar admin.users.manage al Tenant Admin' => ['DELETE', 'tenant_admin', 'admin.users.manage', 'RBAC-BR-02'],
    'otorgar finanzas a un rol de canal' => ['PUT', 'b2b', 'finance.receivables', 'RBAC-BR-04'],
    'otorgar admin a un rol móvil' => ['PUT', 'guide', 'admin.settings.manage', 'RBAC-BR-03'],
    'otorgar admin.tenant.manage a manager' => ['PUT', 'manager', 'admin.tenant.manage', 'RBAC-BR-05'],
]);

it('un permiso inexistente responde 404', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/iam/roles/sales/permissions/no.existe'))->toBeApiError(404);
});
