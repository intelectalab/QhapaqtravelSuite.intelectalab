<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('C-v2.5: la agencia no puede cambiar su razón social desde Configuración', function () {
    actingAsSeed('U01');
    $tenant = tenantA();

    expect($this->patchJson('/api/v1/settings/agency', ['legal_name' => 'Otra Razón S.A.C.'], ['If-Match' => (string) $tenant->lock_version]))->toBeApiError(422);
    expect(tenantA()->legal_name)->toBe($tenant->legal_name);
});

it('C-v2.5: la conexión de la app solo actualiza las columnas de perfil de tenants', function () {
    $tenant = tenantA();

    expect(fn () => withinTenant($tenant, fn () => DB::table('tenants')->where('id', $tenant->getKey())->update(['legal_name' => 'Otra Razón S.A.C.'])))->toThrow(QueryException::class);
    expect(fn () => withinTenant($tenant, fn () => DB::table('tenants')->where('id', $tenant->getKey())->update(['status' => 'activo'])))->toThrow(QueryException::class);
    expect(withinTenant($tenant, fn () => DB::table('tenants')->where('id', $tenant->getKey())->update(['commercial_name' => $tenant->commercial_name])))->toBe(1);
});

it('C-v2.5: una agencia no puede dar permisos a un rol de otra agencia', function () {
    $foreignRole = DB::connection('pgsql_platform')->table('roles')->where('tenant_id', tenantB()->getKey())->value('id');
    $permission = DB::connection('pgsql_platform')->table('permissions')->value('id');

    expect(fn () => withinTenant(tenantA(), fn () => DB::table('role_has_permissions')->insert(['role_id' => $foreignRole, 'permission_id' => $permission])))->toThrow(QueryException::class);
});
