<?php

use Illuminate\Support\Facades\DB;

it('el caso se inicia, recibe seguimiento y se resuelve con las rutas del contrato', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('status', 'abierta')->orderBy('code')->value('code'));
    expect($code)->not->toBeNull();

    $this->postJson("/api/v1/crm/cases/{$code}/start", [], critical((int) rowOf('crm_cases', $code)->lock_version))->assertOk();
    expect(rowOf('crm_cases', $code)->status)->toBe('en_proceso');

    $this->postJson("/api/v1/crm/cases/{$code}/follow-ups")->assertStatus(422);
    $this->postJson("/api/v1/crm/cases/{$code}/follow-ups", ['note' => 'Seguimiento de prueba'])->assertOk();

    $this->postJson("/api/v1/crm/cases/{$code}/resolve", ['note' => 'Resuelto en prueba'], critical((int) rowOf('crm_cases', $code)->lock_version))->assertOk();
    expect(rowOf('crm_cases', $code)->status)->toBe('resuelta');

    $this->postJson("/api/v1/crm/cases/{$code}/close", [], critical((int) rowOf('crm_cases', $code)->lock_version))->assertOk();
    expect(rowOf('crm_cases', $code)->status)->toBe('cerrada');
});

it('la ruta antigua de transición del caso ya no existe', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/crm/cases/PV-1/transition', ['step' => 'start'])->status())->toBe(404);
});
