<?php

use Illuminate\Support\Facades\DB;

function opsResAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function opsResGuide(array $extra = []): array
{
    return ['full_name' => 'Rocío Mamani Quispe', 'languages' => ['ES', 'EN', 'FR'], 'license_number' => 'GT-20931', 'rating' => 4.6, 'phone' => '+51 984 112 233', 'status' => 'disponible', ...$extra];
}

function opsResVehicle(array $extra = []): array
{
    return ['plate' => 'z9k-501', 'vehicle_type' => 'Minivan Hyundai H1', 'capacity' => 10, 'soat_expires_on' => '2027-08-30', 'status' => 'disponible', ...$extra];
}

it('registra un guía nuevo con código propio y queda disponible para asignar', function () {
    actingAsSeed('U05');

    $id = $this->postJson('/api/v1/ops/resources/guias', opsResGuide())->assertCreated()->json('data.id');
    $row = rowOf('ops_guides', $id, column: 'id');

    expect($row->full_name)->toBe('Rocío Mamani Quispe')
        ->and($row->code)->toStartWith('G')
        ->and($row->languages)->toBe('{ES,EN,FR}')
        ->and(opsResAudit(['entity' => 'Guía', 'entity_id' => $row->code, 'action' => 'crear']))->toBeTrue();

    $overview = $this->getJson('/api/v1/ops/resources')->assertOk()->json('data');
    expect(collect($overview['guides'])->firstWhere('id', $id)['languages'])->toBe(['ES', 'EN', 'FR'])
        ->and(collect($overview['options']['guides'])->pluck('value'))->toContain($id);
});

it('edita un conductor y un vehículo con sus vencimientos', function () {
    actingAsSeed('U01');
    $driver = idOf('ops_drivers', 'C03');

    $this->patchJson("/api/v1/ops/resources/conductores/{$driver}", ['full_name' => 'Víctor Hanco Mayta', 'license_number' => 'Q-44120', 'license_class' => 'A-IIIb', 'license_expires_on' => '2028-01-15', 'status' => 'descanso'])->assertOk();
    $row = rowOf('ops_drivers', $driver, column: 'id');
    expect($row->license_expires_on)->toBe('2028-01-15')
        ->and($row->status)->toBe('descanso')
        ->and(collect($this->getJson('/api/v1/ops/resources')->json('data.drivers'))->firstWhere('id', $driver)['document'])->toBe('vigente')
        ->and(opsResAudit(['entity' => 'Conductor', 'entity_id' => 'C03', 'action' => 'editar', 'before_value' => 'disponible', 'after_value' => 'descanso']))->toBeTrue();

    $vehicle = $this->postJson('/api/v1/ops/resources/vehiculos', opsResVehicle())->assertCreated()->json('data.id');
    expect(rowOf('ops_vehicles', $vehicle, column: 'id')->plate)->toBe('Z9K-501');
    $this->patchJson("/api/v1/ops/resources/vehiculos/{$vehicle}", opsResVehicle(['capacity' => 12, 'status' => 'mantenimiento']))->assertOk();
    expect((int) rowOf('ops_vehicles', $vehicle, column: 'id')->capacity)->toBe(12)
        ->and(rowOf('ops_vehicles', $vehicle, column: 'id')->status)->toBe('mantenimiento');
});

it('valida los datos del recurso y no repite placas', function () {
    actingAsSeed('U05');

    $this->postJson('/api/v1/ops/resources/guias', opsResGuide(['full_name' => 'Ro', 'languages' => []]))->assertStatus(422)->assertJsonValidationErrors(['full_name', 'languages']);
    $this->postJson('/api/v1/ops/resources/guias', opsResGuide(['languages' => ['XX']]))->assertStatus(422)->assertJsonValidationErrors('languages.0');
    $this->postJson('/api/v1/ops/resources/conductores', ['full_name' => 'Nuevo Conductor', 'license_number' => 'Q-1', 'status' => 'disponible'])->assertStatus(422)->assertJsonValidationErrors('license_expires_on');
    $this->postJson('/api/v1/ops/resources/vehiculos', opsResVehicle(['capacity' => 0]))->assertStatus(422)->assertJsonValidationErrors('capacity');
    expect($this->postJson('/api/v1/ops/resources/vehiculos', opsResVehicle(['plate' => 'x4g-310'])))->toBeApiError(422, 'VALIDATION_ERROR');
    $this->postJson('/api/v1/ops/resources/barcos', opsResVehicle())->assertNotFound();
    $this->patchJson('/api/v1/ops/resources/guias/no-existe', opsResGuide())->assertNotFound();

    expect(withinTenant(tenantA(), fn () => DB::table('ops_vehicles')->where('plate', 'Z9K-501')->exists()))->toBeFalse();
});

it('da de baja un recurso libre y conserva su historial, pero no uno con servicios por delante', function () {
    actingAsSeed('U05');
    $busy = idOf('ops_guides', 'G01');
    $free = idOf('ops_guides', 'G05');

    expect($this->deleteJson("/api/v1/ops/resources/guias/{$busy}"))->toBeApiError(409, 'OPS-BR-24');
    expect(rowOf('ops_guides', 'G01')->deleted_at)->toBeNull();

    $this->deleteJson("/api/v1/ops/resources/guias/{$free}")->assertOk();
    expect(rowOf('ops_guides', 'G05')->deleted_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/ops/resources')->json('data.guides'))->pluck('id'))->not->toContain($free)
        ->and(opsResAudit(['entity' => 'Guía', 'entity_id' => 'G05', 'action' => 'desactivar']))->toBeTrue();

    $pending = withinTenant(tenantA(), fn () => DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->where('o.code', 'OP-2026-0414')->first(['a.id', 'a.lock_version']));
    expect($this->putJson("/api/v1/ops/assignments/{$pending->id}/resources", ['guide_id' => $free, 'ack_warnings' => true], critical((int) $pending->lock_version)))->toBeApiError(422, 'VALIDATION_ERROR');
    $this->deleteJson("/api/v1/ops/resources/guias/{$free}")->assertNotFound();
});

it('solo quien asigna recursos los crea, edita o da de baja', function (string $user) {
    actingAsSeed($user);
    $guide = idOf('ops_guides', 'G05');

    expect($this->postJson('/api/v1/ops/resources/guias', opsResGuide()))->toBeApiError(403);
    expect($this->patchJson("/api/v1/ops/resources/guias/{$guide}", opsResGuide()))->toBeApiError(403);
    expect($this->deleteJson("/api/v1/ops/resources/guias/{$guide}"))->toBeApiError(403);
    expect(rowOf('ops_guides', 'G05')->deleted_at)->toBeNull();
})->with(['U03', 'U07']);

it('otra agencia no edita ni da de baja los recursos', function () {
    actingAsTenantBAdmin();
    $guide = idOf('ops_guides', 'G05');

    $this->patchJson("/api/v1/ops/resources/guias/{$guide}", opsResGuide())->assertNotFound();
    $this->deleteJson("/api/v1/ops/resources/guias/{$guide}")->assertNotFound();
    expect(rowOf('ops_guides', 'G05')->full_name)->toBe('Óscar Delgado Paz');
});
