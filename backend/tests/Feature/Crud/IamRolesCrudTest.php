<?php

use App\Domain\Iam\Models\Role;
use Illuminate\Support\Facades\DB;

function iamRole(string $code): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('roles')->where('name', $code)->first());
}

function iamRolePermissions(string $code): array
{
    return withinTenant(tenantA(), fn () => Role::query()->where('name', $code)->firstOrFail()->permissions->pluck('name')->sort()->values()->all());
}

function iamTenantAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('crea un rol personalizado, lo guarda con su alcance y lo audita', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/iam/roles', ['name' => 'Coordinación de grupos', 'description' => 'Arma los grupos de viaje', 'scope' => 'tenant'])
        ->assertCreated()->json('data.code');

    $role = iamRole($code);

    expect($code)->toStartWith('custom_coordinacion_de_grupos_')
        ->and($role->display_name)->toBe('Coordinación de grupos')
        ->and($role->scope)->toBe('tenant')
        ->and((bool) $role->is_custom)->toBeTrue()
        ->and($role->experience)->toBe('backoffice')
        ->and(iamTenantAudit(['entity' => 'Rol', 'entity_id' => $code, 'action' => 'crear_rol']))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/iam/roles')->assertOk()->json('data'))->firstWhere('code', $code)['name'])->toBe('Coordinación de grupos');
});

it('RBAC-BR-06: al copiar permisos a un rol de canal se descartan los de administración y finanzas', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/iam/roles', ['name' => 'Socio externo', 'description' => 'Agencia aliada con acceso limitado', 'scope' => 'canal', 'copy_from' => 'tenant_admin'])
        ->assertCreated()->json('data.code');
    $copied = iamRolePermissions($code);

    expect($copied)->not->toBeEmpty()
        ->and(collect($copied)->filter(fn (string $permission) => str_starts_with($permission, 'admin.') || str_starts_with($permission, 'finance.') || str_contains($permission, 'profitability'))->all())->toBe([])
        ->and($copied)->toContain('quotes.view')
        ->and(iamRole($code)->experience)->toBe('portal');
});

it('valida los datos del rol nuevo', function (array $body, string $field) {
    actingAsSeed('U01');

    $this->postJson('/api/v1/iam/roles', $body)->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'sin nombre' => [['description' => 'Algo', 'scope' => 'tenant'], 'name'],
    'sin descripción' => [['name' => 'Rol X', 'scope' => 'tenant'], 'description'],
    'alcance inválido' => [['name' => 'Rol X', 'description' => 'Algo', 'scope' => 'global'], 'scope'],
]);

it('RBAC-BR-06: no admite dos roles con el mismo nombre sin importar mayúsculas', function () {
    actingAsSeed('U01');
    $existing = iamRole('sales')->display_name;

    expect($this->postJson('/api/v1/iam/roles', ['name' => mb_strtoupper($existing), 'description' => 'Duplicado', 'scope' => 'tenant']))->toBeApiError(422, 'RBAC-BR-06');
});

it('edita el nombre y la descripción de un rol personalizado y no deja cambiar su alcance', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/iam/roles', ['name' => 'Rol temporal', 'description' => 'Para pruebas', 'scope' => 'tenant'])->json('data.code');

    $this->patchJson("/api/v1/iam/roles/{$code}", ['name' => 'Rol de temporada', 'description' => 'Refuerzo de temporada alta'])->assertOk();

    expect(iamRole($code)->display_name)->toBe('Rol de temporada')
        ->and(iamRole($code)->description)->toBe('Refuerzo de temporada alta')
        ->and(iamTenantAudit(['entity' => 'Rol', 'entity_id' => $code, 'action' => 'editar_rol']))->toBeTrue();
    $this->patchJson("/api/v1/iam/roles/{$code}", ['name' => 'Rol de temporada', 'description' => 'Otra', 'scope' => 'canal'])->assertStatus(422)->assertJsonValidationErrors('scope');
    expect(iamRole($code)->scope)->toBe('tenant');
});

it('los roles base no se renombran ni se eliminan y el de plataforma no se toca', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/iam/roles/sales', ['name' => 'Comercial', 'description' => 'Ventas']))->toBeApiError(403, 'RBAC-BR-06')
        ->and($this->deleteJson('/api/v1/iam/roles/sales'))->toBeApiError(403, 'RBAC-BR-06')
        ->and($this->patchJson('/api/v1/iam/roles/super_admin', ['name' => 'Otro', 'description' => 'Otro']))->toBeApiError(403, 'RBAC-BR-01')
        ->and($this->patchJson('/api/v1/iam/roles/no_existe', ['name' => 'Otro', 'description' => 'Otro']))->toBeApiError(404);
    expect(iamRole('sales')->display_name)->not->toBe('Comercial');
});

it('RBAC-BR-07: un rol con usuarios no se elimina; sin usuarios sí y se audita', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/iam/roles', ['name' => 'Rol para borrar', 'description' => 'Se elimina en la prueba', 'scope' => 'tenant', 'copy_from' => 'sales'])->json('data.code');
    $sede = idOf('iam_sedes', 'SED-01');
    $this->patchJson('/api/v1/iam/users/U04', ['name' => 'Diego Fernández', 'role' => $code, 'sede_id' => $sede])->assertOk();

    expect($this->deleteJson("/api/v1/iam/roles/{$code}"))->toBeApiError(409, 'RBAC-BR-07');
    expect(iamRole($code))->not->toBeNull();

    $this->patchJson('/api/v1/iam/users/U04', ['name' => 'Diego Fernández', 'role' => 'sales', 'sede_id' => $sede])->assertOk();
    $this->deleteJson("/api/v1/iam/roles/{$code}")->assertOk();

    expect(iamRole($code))->toBeNull()
        ->and(iamTenantAudit(['entity' => 'Rol', 'entity_id' => $code, 'action' => 'eliminar_rol']))->toBeTrue();
});

it('RBAC-BR-08: el cambio masivo aplica los permitidos e informa los bloqueados', function () {
    actingAsSeed('U01');

    $result = $this->postJson('/api/v1/iam/roles/guide/permissions/bulk', ['permissions' => ['reports.view', 'admin.settings.manage', 'finance.receivables', 'no.existe'], 'grant' => true])
        ->assertOk()->json('data');

    expect($result['applied'])->toBe(['reports.view'])
        ->and(collect($result['blocked'])->pluck('permission')->all())->toBe(['admin.settings.manage', 'finance.receivables', 'no.existe'])
        ->and(iamRolePermissions('guide'))->toContain('reports.view')->not->toContain('admin.settings.manage')
        ->and(iamTenantAudit(['entity' => 'Permiso', 'entity_id' => 'guide:reports.view', 'action' => 'otorgar_permiso']))->toBeTrue();
});

it('el cambio masivo valida su cuerpo', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/iam/roles/sales/permissions/bulk', ['permissions' => [], 'grant' => true])->assertStatus(422)->assertJsonValidationErrors('permissions');
    $this->postJson('/api/v1/iam/roles/sales/permissions/bulk', ['permissions' => ['quotes.view']])->assertStatus(422)->assertJsonValidationErrors('grant');
});

it('RBAC-BR-09: quitar un permiso al rol deja a sus usuarios sin acceso en la siguiente solicitud y devolverlo lo restablece', function () {
    actingAsSeed('U03');
    $this->getJson('/api/v1/quotes/kpis')->assertOk();

    actingAsSeed('U01');
    $this->postJson('/api/v1/iam/roles/sales/permissions/bulk', ['permissions' => ['quotes.view'], 'grant' => false])->assertOk()->assertJsonPath('data.applied', ['quotes.view']);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/quotes/kpis'))->toBeApiError(403);

    actingAsSeed('U01');
    $this->postJson('/api/v1/iam/roles/sales/permissions/bulk', ['permissions' => ['quotes.view'], 'grant' => true])->assertOk();

    actingAsSeed('U03');
    $this->getJson('/api/v1/quotes/kpis')->assertOk();
});

it('el anti-bloqueo impide quitar la gestión de usuarios al administrador en el cambio masivo', function () {
    actingAsSeed('U01');

    $result = $this->postJson('/api/v1/iam/roles/tenant_admin/permissions/bulk', ['permissions' => ['admin.users.manage', 'admin.roles.manage'], 'grant' => false])->assertOk()->json('data');

    expect($result['applied'])->toBe([])
        ->and(collect($result['blocked'])->pluck('permission')->all())->toBe(['admin.users.manage', 'admin.roles.manage'])
        ->and(iamRolePermissions('tenant_admin'))->toContain('admin.users.manage')->toContain('admin.roles.manage');
});

it('solo quien administra roles puede crearlos, editarlos, borrarlos o cambiar sus permisos', function (string $method, string $uri, array $body) {
    actingAsSeed('U02');

    expect($this->json($method, $uri, $body))->toBeApiError(403);
})->with([
    ['POST', '/api/v1/iam/roles', ['name' => 'Rol X', 'description' => 'Algo', 'scope' => 'tenant']],
    ['PATCH', '/api/v1/iam/roles/sales', ['name' => 'Rol X', 'description' => 'Algo']],
    ['DELETE', '/api/v1/iam/roles/sales', []],
    ['POST', '/api/v1/iam/roles/sales/permissions/bulk', ['permissions' => ['reports.view'], 'grant' => true]],
]);
