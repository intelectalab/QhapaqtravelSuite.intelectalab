<?php

use Illuminate\Support\Facades\DB;

function lockOf(string $table, string $code): int
{
    return (int) rowOf($table, $code)->lock_version;
}

function portalQuoteFor(string $code): void
{
    $customer = seedUser('U14');
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('code', $code)->update(['client_id' => $customer->client_id]));
}

it('las acciones de postventa, reclamaciones y órdenes responden 428 IF_MATCH_REQUIRED sin versión', function (string $route, string $path) {
    actingAsSeed('U01');

    $response = $this->postJson("/api/v1/{$path}", ['note' => 'Nota de prueba suficiente'], ['Idempotency-Key' => idem('ifm')]);

    expect(app('router')->getRoutes()->getByName($route))->not->toBeNull()
        ->and(config('api_contract.if_match'))->toHaveKey($route)
        ->and($response)->toBeApiError(428, 'IF_MATCH_REQUIRED');
})->with([
    'caso iniciar' => ['crm.cases.start', 'crm/cases/REC-0013/start'],
    'caso resolver' => ['crm.cases.resolve', 'crm/cases/REC-0014/resolve'],
    'caso cerrar' => ['crm.cases.close', 'crm/cases/REC-0012/close'],
    'hoja evaluar' => ['crm.claims.evaluate', 'crm/claim-book/REC-0021/review'],
    'hoja cerrar' => ['crm.claims.close', 'crm/claim-book/REC-0018/close'],
    'orden a asignación' => ['ops.orders.to-assignment', 'ops/orders/OP-2026-0414/to-assignment'],
    'orden asignada' => ['ops.orders.mark-assigned', 'ops/orders/OP-2026-0414/mark-assigned'],
    'orden confirmar' => ['ops.orders.confirm', 'ops/orders/OP-2026-0413/confirm'],
    'orden iniciar' => ['ops.orders.start', 'ops/orders/OP-2026-0413/start'],
    'orden cerrar' => ['ops.orders.close', 'ops/orders/OP-2026-0412/close'],
]);

it('aprobar y rechazar una propuesta en el portal responden 428 IF_MATCH_REQUIRED sin versión', function (string $route, string $action) {
    portalQuoteFor('COT-2026-00188');
    actingAsSeed('U14');

    $response = $this->postJson("/api/v1/portal/client/quotes/COT-2026-00188/{$action}", ['name' => 'Gabriela Ríos Montoya', 'accept' => true, 'reason' => 'Precio', 'comment' => 'Prueba'], ['Idempotency-Key' => idem('ifm')]);

    expect(config('api_contract.if_match'))->toHaveKey($route)
        ->and($response)->toBeApiError(428, 'IF_MATCH_REQUIRED')
        ->and(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('enviada');
})->with([
    'aprobar' => ['portal.quotes.approve', 'approve'],
    'rechazar' => ['portal.quotes.reject', 'reject'],
]);

it('postventa: el caso avanza con su versión, la sube y rechaza la versión vieja con 409 STALE_VERSION', function () {
    actingAsSeed('U01');
    $version = lockOf('crm_cases', 'REC-0013');
    expect(collect($this->getJson('/api/v1/crm/after-sales')->assertOk()->json('data.cases'))->firstWhere('code', 'REC-0013')['lock_version'])->toBe($version);

    $this->postJson('/api/v1/crm/cases/REC-0013/start', [], critical($version))->assertOk();
    expect(lockOf('crm_cases', 'REC-0013'))->toBe($version + 1);

    $stale = $this->postJson('/api/v1/crm/cases/REC-0013/resolve', ['note' => 'Resuelto con versión vieja'], critical($version));

    expect($stale)->toBeApiError(409, 'STALE_VERSION')
        ->and(rowOf('crm_cases', 'REC-0013')->status)->toBe('en_proceso');
});

it('reclamaciones: la hoja se evalúa con la versión en el cuerpo y la versión vieja responde 409 STALE_VERSION', function () {
    actingAsSeed('U01');
    $version = lockOf('crm_cases', 'REC-0020');
    expect(collect($this->getJson('/api/v1/crm/claim-book')->assertOk()->json('data.claims'))->firstWhere('code', 'REC-0020')['lock_version'])->toBe($version);

    $this->postJson('/api/v1/crm/claim-book/REC-0020/review', ['lock_version' => $version], critical())->assertOk();
    expect(lockOf('crm_cases', 'REC-0020'))->toBe($version + 1);

    $stale = $this->postJson('/api/v1/crm/claim-book/REC-0020/review', [], critical($version));

    expect($stale)->toBeApiError(409, 'STALE_VERSION')
        ->and(rowOf('crm_cases', 'REC-0020')->book_status)->toBe('in_review');
});

it('órdenes: la orden avanza con su versión y la versión vieja responde 409 STALE_VERSION', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('code', 'OP-2026-0414')->update(['status' => 'planificada']));
    $version = lockOf('ops_orders', 'OP-2026-0414');
    expect($this->getJson('/api/v1/ops/orders/OP-2026-0414')->assertOk()->json('data.lock_version'))->toBe($version)
        ->and(collect($this->getJson('/api/v1/ops/orders')->assertOk()->json('data.items'))->firstWhere('code', 'OP-2026-0414')['lock_version'])->toBe($version);

    $this->postJson('/api/v1/ops/orders/OP-2026-0414/to-assignment', [], critical($version))->assertOk();
    expect(lockOf('ops_orders', 'OP-2026-0414'))->toBe($version + 1);

    withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('code', 'OP-2026-0414')->update(['status' => 'planificada']));
    $stale = $this->postJson('/api/v1/ops/orders/OP-2026-0414/to-assignment', [], critical($version));

    expect($stale)->toBeApiError(409, 'STALE_VERSION')
        ->and(rowOf('ops_orders', 'OP-2026-0414')->status)->toBe('planificada');
});

it('portal: el cliente responde la propuesta con su versión y la versión vieja responde 409 STALE_VERSION', function () {
    portalQuoteFor('COT-2026-00188');
    actingAsSeed('U14');
    $shown = $this->getJson('/api/v1/portal/client/quotes/COT-2026-00188')->assertOk()->json('data.lock_version');
    $version = lockOf('quote_quotes', 'COT-2026-00188');
    expect($shown)->toBe($version);

    $this->postJson('/api/v1/portal/client/quotes/COT-2026-00188/reject', ['reason' => 'Precio', 'comment' => 'Elegimos otra fecha', 'lock_version' => $version], critical())->assertOk();
    expect(lockOf('quote_quotes', 'COT-2026-00188'))->toBeGreaterThan($version)
        ->and(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('rechazada');

    $stale = $this->postJson('/api/v1/portal/client/quotes/COT-2026-00188/approve', ['name' => 'Gabriela Ríos Montoya', 'accept' => true], critical($version));

    expect($stale)->toBeApiError(409, 'STALE_VERSION')
        ->and(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('rechazada');
});
