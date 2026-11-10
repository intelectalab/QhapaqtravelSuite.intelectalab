<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catHoldAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catHoldRow(string $ref): object
{
    return rowOf('catalog_availability_holds', $ref, column: 'ref');
}

function catHoldAvailable(string $departure): int
{
    return (int) collect(test()->getJson('/api/v1/catalog/departures')->assertOk()->json('data.departures'))->firstWhere('ref', $departure)['available'];
}

function catHoldCreate(string $departure, int $quantity, array $overrides = []): string
{
    return (string) test()->postJson('/api/v1/catalog/holds', [
        'departure_id' => departureRow($departure)->id, 'quantity' => $quantity, 'reference' => 'COT-2026-00190', 'minutes' => 60, ...$overrides,
    ], critical())->assertCreated()->json('data.ref');
}

function catHoldAction(string $ref, string $action, array $body = [])
{
    $lock = (int) catHoldRow($ref)->lock_version;

    return test()->postJson("/api/v1/catalog/holds/{$ref}/{$action}", $body, critical($lock));
}

beforeEach(fn () => Queue::fake());

it('crea un hold que retiene cupo sin tocar lo vendido', function () {
    actingAsSeed('U05');
    $before = catHoldAvailable('SAL-0405');
    $sold = (int) departureRow('SAL-0405')->sold;

    $ref = catHoldCreate('SAL-0405', 3);
    $hold = catHoldRow($ref);

    expect($ref)->toStartWith('HLD-')
        ->and($hold->status)->toBe('hold')
        ->and((int) $hold->quantity)->toBe(3)
        ->and(catHoldAvailable('SAL-0405'))->toBe($before - 3)
        ->and((int) departureRow('SAL-0405')->sold)->toBe($sold)
        ->and(catHoldAudit(['entity' => 'Hold', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();
});

it('valida el hold y rechaza la sobreventa sugiriendo alternativas', function () {
    actingAsSeed('U01');
    $available = catHoldAvailable('SAL-0403');

    $this->postJson('/api/v1/catalog/holds', ['departure_id' => departureRow('SAL-0403')->id, 'quantity' => 0, 'reference' => 'X'], critical())
        ->assertStatus(422)->assertJsonValidationErrors(['quantity', 'reference']);
    $response = $this->postJson('/api/v1/catalog/holds', ['departure_id' => departureRow('SAL-0403')->id, 'quantity' => $available + 1, 'reference' => 'COT-PRUEBA'], critical());
    expect($response)->toBeApiError(422, 'PRD-BR-012');
    expect($response->json('message'))->toContain('Alternativas');
    expect($this->postJson('/api/v1/catalog/holds', ['departure_id' => departureRow('SAL-0402')->id, 'quantity' => 1, 'reference' => 'COT-PRUEBA'], critical()))->toBeApiError(422, 'CAT-BR-21');
    expect(catHoldAvailable('SAL-0403'))->toBe($available);
});

it('ventas y finanzas no gestionan bloqueos de cupo', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/catalog/holds', ['departure_id' => departureRow('SAL-0405')->id, 'quantity' => 1, 'reference' => 'COT-PRUEBA'], critical()))->toBeApiError(403);
    expect(catHoldAction('HLD-0001', 'confirm'))->toBeApiError(403);
    expect(catHoldAction('HLD-0003', 'release', ['reason' => 'Prueba']))->toBeApiError(403);
    expect(catHoldAction('HLD-0003', 'consume'))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/holds/expire'))->toBeApiError(403);
    expect(catHoldRow('HLD-0001')->status)->toBe('hold');
})->with(['U03', 'U07']);

it('confirmar suma lo vendido, completa la salida llena y no se repite', function () {
    actingAsSeed('U01');
    $departure = departureRow('SAL-0405');
    $free = (int) $departure->capacity - (int) $departure->sold;
    $ref = catHoldCreate('SAL-0405', $free);

    catHoldAction($ref, 'confirm')->assertOk()->assertJsonPath('data.ref', $ref);

    expect(catHoldRow($ref)->status)->toBe('confirmada')
        ->and((int) departureRow('SAL-0405')->sold)->toBe((int) $departure->capacity)
        ->and(departureRow('SAL-0405')->status)->toBe('completa')
        ->and(catHoldAudit(['entity' => 'Hold', 'entity_id' => $ref, 'action' => 'confirmar']))->toBeTrue();
    expect(catHoldAction($ref, 'confirm'))->toBeApiError(409, 'CAT-BR-22');
});

it('no confirma un hold expirado, con versión vieja o de un producto que dejó de estar activo', function () {
    actingAsSeed('U01');

    expect(catHoldAction('HLD-0002', 'confirm'))->toBeApiError(409, 'CAT-BR-22');
    expect($this->postJson('/api/v1/catalog/holds/HLD-0001/confirm', [], critical(7)))->toBeApiError(409, 'STALE_VERSION');
    expect($this->postJson('/api/v1/catalog/holds/HLD-0001/confirm', [], ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');

    $ref = catHoldCreate('SAL-0405', 2);
    $lock = (int) rowOf('catalog_products', 'CUS-HUM-FD')->lock_version;
    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/suspend', ['reason' => 'Cierre del acceso', 'lock_version' => $lock], critical($lock))->assertOk();
    $sold = (int) departureRow('SAL-0405')->sold;

    expect(catHoldAction($ref, 'confirm'))->toBeApiError(422, 'PRD-BR-002');
    expect(catHoldRow($ref)->status)->toBe('hold')->and((int) departureRow('SAL-0405')->sold)->toBe($sold);
});

it('liberar un hold confirmado devuelve lo vendido y reabre la salida completa', function () {
    actingAsSeed('U05');
    $departure = departureRow('SAL-0405');
    $ref = catHoldCreate('SAL-0405', (int) $departure->capacity - (int) $departure->sold);
    catHoldAction($ref, 'confirm')->assertOk();
    expect(departureRow('SAL-0405')->status)->toBe('completa');

    catHoldAction($ref, 'release')->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson("/api/v1/catalog/holds/{$ref}/release", ['reason' => 'Cliente desistió'], critical((int) catHoldRow($ref)->lock_version))->assertOk();

    $hold = catHoldRow($ref);
    expect($hold->status)->toBe('liberada')
        ->and($hold->released_reason)->toBe('Cliente desistió')
        ->and((int) departureRow('SAL-0405')->sold)->toBe((int) $departure->sold)
        ->and(departureRow('SAL-0405')->status)->toBe('abierta')
        ->and(catHoldAudit(['entity' => 'Hold', 'entity_id' => $ref, 'action' => 'liberar']))->toBeTrue();
    expect(catHoldAction($ref, 'release', ['reason' => 'Otra vez']))->toBeApiError(409, 'CAT-BR-24');
});

it('liberar un hold pendiente devuelve el cupo retenido', function () {
    actingAsSeed('U01');
    $before = catHoldAvailable('SAL-0103');

    catHoldAction('HLD-0001', 'release', ['reason' => 'Cotización vencida'])->assertOk();

    expect(catHoldRow('HLD-0001')->status)->toBe('liberada')
        ->and(catHoldAvailable('SAL-0103'))->toBe($before + 2)
        ->and((int) departureRow('SAL-0103')->sold)->toBe(9);
});

it('consumir marca usados los cupos confirmados sin cambiar lo vendido', function () {
    actingAsSeed('U05');
    $sold = (int) departureRow('SAL-0404')->sold;

    $this->postJson('/api/v1/catalog/holds/HLD-0003/consume', [], critical((int) catHoldRow('HLD-0003')->lock_version))->assertOk();

    expect(catHoldRow('HLD-0003')->status)->toBe('consumida')
        ->and((int) departureRow('SAL-0404')->sold)->toBe($sold)
        ->and(catHoldAudit(['entity' => 'Hold', 'entity_id' => 'HLD-0003', 'action' => 'consumir']))->toBeTrue();
    expect(catHoldAction('HLD-0001', 'consume'))->toBeApiError(409, 'CAT-BR-24');
    expect(catHoldAction('HLD-0003', 'release', ['reason' => 'Tarde']))->toBeApiError(409, 'CAT-BR-24');
});

it('expira los holds vencidos y devuelve su cupo', function () {
    actingAsSeed('U05');
    $before = catHoldAvailable('SAL-0403');

    $this->postJson('/api/v1/catalog/holds/expire')->assertOk()->assertJsonPath('data.expired', 1);

    expect(catHoldRow('HLD-0002')->status)->toBe('expirada')
        ->and(catHoldRow('HLD-0001')->status)->toBe('hold')
        ->and(catHoldAvailable('SAL-0403'))->toBe($before + 4)
        ->and(catHoldAudit(['entity' => 'Hold', 'entity_id' => 'HLD-0002', 'action' => 'expirar']))->toBeTrue();
    $this->postJson('/api/v1/catalog/holds/expire')->assertOk()->assertJsonPath('data.expired', 0);
});
