<?php

use Illuminate\Support\Facades\DB;

it('la orden avanza con la acción del contrato y rechaza la que no corresponde', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), function (): ?string {
        $code = DB::table('ops_orders')->whereNotIn('status', ['completada', 'cancelada'])->orderBy('code')->value('code');
        DB::table('ops_orders')->where('code', $code)->update(['status' => 'planificada']);

        return $code;
    });
    expect($code)->not->toBeNull();

    $this->postJson("/api/v1/ops/orders/{$code}/confirm", [], critical((int) rowOf('ops_orders', $code)->lock_version))->assertStatus(409);

    $this->postJson("/api/v1/ops/orders/{$code}/to-assignment", [], critical((int) rowOf('ops_orders', $code)->lock_version))->assertOk()->assertJsonPath('data.status', 'pendiente_asignacion');
    expect(rowOf('ops_orders', $code)->status)->toBe('pendiente_asignacion');
});

it('expone una ruta por transición de la orden', function (string $action) {
    expect(routeExists('POST', "/api/v1/ops/orders/OP-1/{$action}"))->toBeTrue();
})->with(['to-assignment', 'mark-assigned', 'confirm', 'start', 'close']);

it('la ruta antigua de estado de la orden ya no existe', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/ops/orders/OP-1/status', ['status' => 'asignada'])->status())->toBe(404);
});
