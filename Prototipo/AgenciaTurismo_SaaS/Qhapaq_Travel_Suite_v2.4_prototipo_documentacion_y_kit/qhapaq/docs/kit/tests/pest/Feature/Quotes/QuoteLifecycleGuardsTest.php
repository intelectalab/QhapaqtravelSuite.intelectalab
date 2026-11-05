<?php

/*
| Guardas de negocio de la máquina de estados de cotización vía API (esp. 03 §4.1, §5; H-04).
| Complementa Unit/Quotes/QuoteStateMachineTest.php (grafo) con las reglas que dependen de datos.
*/

use App\Domain\Quotes\Models\Quote;

it('no se envía con aprobación interna pendiente (QTE-BR-12)', function () {
    actingAsSeed('U04');
    $q = withinTenant(tenantA(), fn () => Quote::query()->where('code', 'COT-2026-00185')->firstOrFail()); // borrador de U04
    $this->postJson("/api/v1/quotes/{$q->id}/internal-approval-requests")->assertSuccessful();

    $res = $this->postJson("/api/v1/quotes/{$q->id}/send", ['channels' => ['email']], critical($q->fresh()->lock_version));

    expect($res)->toBeApiError(409, 'QTE-BR-12');
});

it('H-04: el cliente no aprueba desde el portal mientras la aprobación interna está pendiente', function () {
    // Arrange: cotización enviada con solicitud pendiente, cliente CLI-0001 (portal U14)
    $q = quoteSentWithPendingInternalApproval('CLI-0001', owner: 'U04');
    actingAsSeed('U14');

    $res = $this->postJson("/api/v1/portal/client/quotes/{$q->code}/approve", [
        'approver_name' => 'Gabriela Ríos Montoya', 'accept_terms' => true,
    ], critical($q->lock_version));

    expect($res)->toBeApiError(409);
    expect($res->json('code'))->toBeIn(['QTE-BR-13', 'H-04']);
});

it('no se aprueba una cotización vencida (QTE-BR-16)', function () {
    actingAsSeed('U02');
    $q = withinTenant(tenantA(), fn () => Quote::query()->where('code', 'COT-2026-00182')->firstOrFail()); // vencida

    expect($this->postJson("/api/v1/quotes/{$q->id}/approve", ['approved_by_name' => 'X', 'channel' => 'email'], critical($q->lock_version)))
        ->toBeApiError(409);
});

it('rechazar exige motivo (422) y registra el estado', function () {
    actingAsSeed('U04');
    $q = withinTenant(tenantA(), fn () => Quote::query()->where('code', 'COT-2026-00190')->firstOrFail()); // vista

    $this->postJson("/api/v1/quotes/{$q->id}/reject", [], critical($q->lock_version))->assertUnprocessable()->assertJsonValidationErrors('reason');
    $this->postJson("/api/v1/quotes/{$q->id}/reject", ['reason' => 'Presupuesto'], critical($q->lock_version))->assertSuccessful();

    expect($q->fresh()->status)->toBe('rechazada');
});

it('If-Match desactualizado → 409 STALE_VERSION', function () {
    actingAsSeed('U04');
    $q = withinTenant(tenantA(), fn () => Quote::query()->where('code', 'COT-2026-00190')->firstOrFail());

    expect($this->postJson("/api/v1/quotes/{$q->id}/reject", ['reason' => 'x'], critical($q->lock_version - 1)))
        ->toBeApiError(409, 'STALE_VERSION');
});

it('el job JOB-02 vence cotizaciones con validez pasada y audita como Sistema', function () {
    withinTenant(tenantA(), fn () => Quote::query()->where('code', 'COT-2026-00188')->update(['valid_until' => '2026-09-28']));

    (new \App\Domain\Quotes\Jobs\ExpireQuotes())->handle();

    expect(withinTenant(tenantA(), fn () => Quote::query()->where('code', 'COT-2026-00188')->value('status')))->toBe('vencida');
});

/** Arrange reutilizable (mover a Support/ cuando lo usen otros tests). */
function quoteSentWithPendingInternalApproval(string $clientCode, string $owner): Quote
{
    return withinTenant(tenantA(), fn () => \Database\Factories\QuoteFactory::new()
        ->forClient($clientCode)->ownedBy(seedUser($owner))
        ->withDiscountPct(12)          // > tope 10 %: requiere gerencia
        ->sent()->withPendingInternalApproval()
        ->create());
}
