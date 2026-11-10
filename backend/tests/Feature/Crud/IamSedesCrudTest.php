<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

function iamSede(string $code): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('code', $code)->first());
}

function iamSedeAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Sede', 'entity_id' => $code, 'action' => $action])->exists());
}

function iamSetSedeLimit(?int $value): void
{
    DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', tenantA()->plan_id)->where('metric', 'sedes')->update(['value' => $value]);
}

function iamNewSede(array $overrides = []): TestResponse
{
    return test()->postJson('/api/v1/iam/sedes', ['name' => 'Puno — Bahía', 'city' => 'Puno', 'address' => 'Jr. Lima 410, Puno', 'phone' => '+51 51 360000', ...$overrides]);
}

it('crea una sede activa con el código siguiente, la lista y la audita', function () {
    actingAsSeed('U01');

    $code = iamNewSede(['manager_id' => seedUser('U03')->id])->assertCreated()->json('data.code');
    $sede = iamSede($code);
    $listed = collect($this->getJson('/api/v1/iam/sedes')->assertOk()->json('data'))->firstWhere('code', $code);

    expect($code)->toBe('SED-04')
        ->and($sede->status)->toBe('activa')
        ->and((bool) $sede->is_main)->toBeFalse()
        ->and($sede->manager_user_id)->toBe(seedUser('U03')->id)
        ->and($listed['manager']['name'])->toBe(seedUser('U03')->name)
        ->and($listed['users'])->toBe(0)
        ->and(iamSedeAudit($code, 'crear'))->toBeTrue();
});

it('SED-BR-01: el nombre es único sin importar mayúsculas y la dirección es obligatoria', function () {
    actingAsSeed('U01');

    expect(iamNewSede(['name' => mb_strtoupper(iamSede('SED-02')->name)]))->toBeApiError(422, 'SED-BR-01');
    iamNewSede(['address' => ''])->assertStatus(422)->assertJsonValidationErrors('address');
    iamNewSede(['name' => ''])->assertStatus(422)->assertJsonValidationErrors('name');
    expect(iamSede('SED-04'))->toBeNull();
});

it('SED-BR-05: el responsable debe ser un usuario activo de un rol interno', function (string $user) {
    actingAsSeed('U01');

    expect(iamNewSede(['manager_id' => seedUser($user)->id]))->toBeApiError(422, 'SED-BR-05');
})->with(['guía' => ['U09'], 'inactivo' => ['U12'], 'cliente' => ['U14']]);

it('SED-BR-02: el plan limita las sedes activas al crear y al reactivar', function () {
    actingAsSeed('U01');
    $code = iamNewSede()->json('data.code');
    $this->postJson("/api/v1/iam/sedes/{$code}/deactivate")->assertOk();
    iamSetSedeLimit(3);

    expect(iamNewSede(['name' => 'Tacna — Centro']))->toBeApiError(409, 'SED-BR-02')
        ->and($this->postJson("/api/v1/iam/sedes/{$code}/activate"))->toBeApiError(409, 'SED-BR-02');
    expect(iamSede($code)->status)->toBe('inactiva');

    iamSetSedeLimit(4);
    $this->postJson("/api/v1/iam/sedes/{$code}/activate")->assertOk();
    expect(iamSede($code)->status)->toBe('activa')
        ->and(iamSedeAudit($code, 'activar'))->toBeTrue();
});

it('edita los datos de la sede y audita solo los campos que cambian', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/iam/sedes/SED-03', ['name' => 'Arequipa — Cayma', 'city' => 'Arequipa', 'address' => 'Av. Ejército 101, Cayma', 'manager_id' => seedUser('U03')->id])->assertOk();
    $sede = iamSede('SED-03');

    expect($sede->name)->toBe('Arequipa — Cayma')
        ->and($sede->address)->toBe('Av. Ejército 101, Cayma')
        ->and($sede->manager_user_id)->toBe(seedUser('U03')->id)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Sede', 'entity_id' => 'SED-03', 'action' => 'editar'])->value('after_value')))->toContain('Nombre')->toContain('Dirección');
    expect($this->patchJson('/api/v1/iam/sedes/SED-03', ['name' => iamSede('SED-01')->name, 'address' => 'Otra']))->toBeApiError(422, 'SED-BR-01');
    expect($this->patchJson('/api/v1/iam/sedes/SED-99', ['name' => 'X', 'address' => 'Y']))->toBeApiError(404);
});

it('SED-BR-03: no se desactiva una sede con usuarios activos; vacía sí y deja de contar', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/iam/sedes/SED-03/deactivate'))->toBeApiError(409, 'SED-BR-03');
    expect(iamSede('SED-03')->status)->toBe('activa');

    $code = iamNewSede()->json('data.code');
    $this->postJson("/api/v1/iam/sedes/{$code}/deactivate")->assertOk();

    expect(iamSede($code)->status)->toBe('inactiva')
        ->and(collect($this->getJson('/api/v1/iam/sedes')->json('data'))->firstWhere('code', $code)['status'])->toBe('inactiva')
        ->and(iamSedeAudit($code, 'desactivar'))->toBeTrue();
});

it('SED-BR-03: la agencia conserva al menos una sede activa', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('code', '<>', 'SED-03')->update(['status' => 'inactiva']));
    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('sede_id', iamSede('SED-03')->id)->update(['sede_id' => iamSede('SED-01')->id]));

    $response = $this->postJson('/api/v1/iam/sedes/SED-03/deactivate');

    expect($response)->toBeApiError(409, 'SED-BR-03')
        ->and($response->json('message'))->toContain('al menos una sede activa');
});

it('SED-BR-04: no se elimina la sede principal ni una con usuarios; una vacía sí', function () {
    actingAsSeed('U01');

    expect($this->deleteJson('/api/v1/iam/sedes/SED-01'))->toBeApiError(409, 'SED-BR-04')
        ->and($this->deleteJson('/api/v1/iam/sedes/SED-02'))->toBeApiError(409, 'SED-BR-04');

    $code = iamNewSede()->json('data.code');
    $this->deleteJson("/api/v1/iam/sedes/{$code}")->assertOk();

    expect(iamSede($code)->deleted_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/iam/sedes')->json('data'))->pluck('code'))->not->toContain($code)
        ->and(iamSedeAudit($code, 'eliminar'))->toBeTrue();
    expect($this->deleteJson("/api/v1/iam/sedes/{$code}"))->toBeApiError(404);
});

it('solo quien administra usuarios gestiona las sedes', function (string $method, string $uri, array $body) {
    actingAsSeed('U02');

    expect($this->json($method, $uri, $body))->toBeApiError(403);
})->with([
    ['POST', '/api/v1/iam/sedes', ['name' => 'X', 'address' => 'Y']],
    ['PATCH', '/api/v1/iam/sedes/SED-03', ['name' => 'X', 'address' => 'Y']],
    ['DELETE', '/api/v1/iam/sedes/SED-03', []],
    ['POST', '/api/v1/iam/sedes/SED-03/activate', []],
    ['POST', '/api/v1/iam/sedes/SED-03/deactivate', []],
]);
