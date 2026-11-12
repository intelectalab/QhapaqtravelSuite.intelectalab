<?php

use Illuminate\Support\Facades\DB;

function codeOwnedBy(string $table, string $user): string
{
    $owner = seedUser($user);

    return (string) withinTenant(tenantA(), fn () => DB::table($table)->where('owner_id', $owner->id)->whereNull('deleted_at')->orderBy('code')->value('code'));
}

it('If-Match obligatorio: sin versión una ruta marcada responde 428 IF_MATCH_REQUIRED y no cambia nada', function () {
    actingAsSeed('U01');
    $quote = rowOf('quote_quotes', 'COT-2026-00189');

    $response = $this->postJson('/api/v1/quotes/COT-2026-00189/versions', [], ['Idempotency-Key' => idem('ver')]);

    expect($response)->toBeApiError(428, 'IF_MATCH_REQUIRED')
        ->and((int) rowOf('quote_quotes', 'COT-2026-00189')->lock_version)->toBe((int) $quote->lock_version);
});

it('If-Match obligatorio: la versión en el cuerpo sigue aceptándose durante la transición', function () {
    actingAsSeed('U01');
    $quote = rowOf('quote_quotes', 'COT-2026-00189');

    $response = $this->postJson('/api/v1/quotes/COT-2026-00189/versions', ['lock_version' => (int) $quote->lock_version], ['Idempotency-Key' => idem('ver')]);

    expect($response)->toBeApiError(409, 'QTE-BR-18');
});

it('If-Match obligatorio en todas las rutas con versión: incidencias, metas, ajustes y agencias responden 428 sin versión', function (string $method, string $path, string $actor) {
    actingAsSeed($actor);

    $response = $this->json($method, "/api/v1/{$path}", [], ['Idempotency-Key' => idem('v')]);

    expect($response)->toBeApiError(428, 'IF_MATCH_REQUIRED');
})->with([
    'reserva' => ['PATCH', 'reservations/RES-2026-000343', 'U01'],
    'incidencia' => ['POST', 'ops/incidents/INC-0088/take', 'U05'],
    'ajustes' => ['PATCH', 'settings/general', 'U01'],
]);

it('cada ruta con versión del catálogo exige If-Match', function () {
    $routes = collect(app('router')->getRoutes()->getRoutes())->filter(fn ($route) => isset(config('api_contract.if_match')[(string) $route->getName()]));

    expect($routes)->toHaveCount(count(config('api_contract.if_match')))
        ->and($routes->every(fn ($route) => collect($route->gatherMiddleware())->contains(fn ($m) => str_starts_with((string) $m, 'if-match:'))))->toBeTrue();
});

it('SEC-BR-09: Ventas recibe 403 con mensaje de cartera en un lead, una oportunidad y un cliente ajenos', function (string $table, string $path) {
    $code = codeOwnedBy($table, 'U04');
    if ($table === 'crm_clients') {
        detachFromPortfolio($code, 'U03');
    }
    actingAsSeed('U03');

    $response = $this->getJson("/api/v1/{$path}/{$code}");

    expect($code)->not->toBe('')
        ->and($response)->toBeApiError(403, 'SEC-BR-09');
    expect($response->json('message'))->toContain('cartera de otro asesor');
})->with([
    'lead' => ['crm_leads', 'crm/leads'],
    'oportunidad' => ['crm_opportunities', 'crm/opportunities'],
    'cliente' => ['crm_clients', 'crm/clients'],
]);

it('SEC-BR-09: un código que no existe sigue respondiendo 404', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/quotes/COT-2026-99999'))->toBeApiError(404);
});

it('SEC-BR-09: Gerencia ve el registro de cualquier asesor', function () {
    $code = codeOwnedBy('crm_opportunities', 'U04');
    actingAsSeed('U02');

    $this->getJson("/api/v1/crm/opportunities/{$code}")->assertOk();
});

it('SEC-BR-09: Ventas no puede editar una cotización ajena (403, no 404)', function () {
    actingAsSeed('U04');
    $quote = rowOf('quote_quotes', 'COT-2026-00189');

    expect($this->postJson('/api/v1/quotes/COT-2026-00189/versions', [], critical((int) $quote->lock_version, idem('ver'))))->toBeApiError(403, 'SEC-BR-09');
});
