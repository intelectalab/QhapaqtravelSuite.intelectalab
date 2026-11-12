<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function flujoAprVersion(string $code): int
{
    return (int) rowOf('collab_approval_requests', $code)->lock_version;
}

function flujoAprAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Aprobación')->where('entity_id', $code)->where('action', $action)->exists());
}

function flujoAprItem(string $code): ?array
{
    return collect(test()->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->firstWhere('code', $code);
}

it('delegar deja la solicitud solo en manos del delegado y queda auditado', function () {
    actingAsSeed('U02');
    $item = flujoAprItem('APR-2026-0002');
    expect($item['can_delegate'])->toBeTrue()
        ->and(collect($item['delegates'])->pluck('id'))->toContain(seedUser('U01')->id)
        ->and(collect($item['delegates'])->pluck('id'))->not->toContain(seedUser('U03')->id);

    $this->postJson('/api/v1/approvals/APR-2026-0002/delegate', ['user_id' => seedUser('U01')->id, 'note' => 'Lo ve la administración'], critical(flujoAprVersion('APR-2026-0002')))->assertOk();

    expect(rowOf('collab_approval_requests', 'APR-2026-0002')->delegated_to)->toBe(seedUser('U01')->id)
        ->and(flujoAprAuditada('APR-2026-0002', 'delegar'))->toBeTrue()
        ->and(flujoAprItem('APR-2026-0002')['can_decide'])->toBeFalse();
    expect($this->postJson('/api/v1/approvals/APR-2026-0002/approve', ['note' => 'Ok'], critical(flujoAprVersion('APR-2026-0002'))))->toBeApiError(403, 'APR-BR-04');

    actingAsSeed('U01');
    expect(flujoAprItem('APR-2026-0002'))->toMatchArray(['can_decide' => true, 'delegated_to' => ['id' => seedUser('U01')->id, 'name' => seedUser('U01')->name]]);
});

it('no se delega en quien pidió la solicitud, en quien no tiene el permiso ni con una versión vieja', function () {
    actingAsSeed('U02');
    $version = flujoAprVersion('APR-2026-0002');

    expect($this->postJson('/api/v1/approvals/APR-2026-0002/delegate', ['user_id' => seedUser('U03')->id], critical($version)))->toBeApiError(422, 'APR-BR-04');
    expect($this->postJson('/api/v1/approvals/APR-2026-0002/delegate', ['user_id' => seedUser('U07')->id], critical($version)))->toBeApiError(422, 'APR-BR-04');
    expect($this->postJson('/api/v1/approvals/APR-2026-0002/delegate', ['user_id' => seedUser('U01')->id], critical($version + 5)))->toBeApiError(409);
    expect(rowOf('collab_approval_requests', 'APR-2026-0002')->delegated_to)->toBeNull();

    actingAsSeed('U03');
    $response = $this->postJson('/api/v1/approvals/APR-2026-0002/delegate', ['user_id' => seedUser('U01')->id], critical($version));
    expect($response)->toBeApiError(403, 'APR-BR-04')
        ->and($response->json('required_permissions'))->toBe(['quotes.approve_internal']);
});

it('pedir información pausa el plazo y responderla lo extiende por el tiempo en pausa', function () {
    actingAsSeed('U02');
    $before = rowOf('collab_approval_requests', 'APR-2026-0002');

    $this->postJson('/api/v1/approvals/APR-2026-0002/info-requests', ['question' => '¿Qué parte del viaje se reembolsa?'], critical(flujoAprVersion('APR-2026-0002')))->assertCreated();

    $paused = rowOf('collab_approval_requests', 'APR-2026-0002');
    expect($paused->status)->toBe('info')
        ->and($paused->paused_at)->not->toBeNull()
        ->and(flujoAprAuditada('APR-2026-0002', 'pedir_informacion'))->toBeTrue()
        ->and(flujoAprItem('APR-2026-0002'))->toMatchArray(['sla' => 'paused', 'can_decide' => false]);
    expect($this->postJson('/api/v1/approvals/APR-2026-0002/info-requests', ['question' => 'Otra pregunta más'], critical(flujoAprVersion('APR-2026-0002'))))->toBeApiError(409, 'APR-BR-10');

    $info = withinTenant(tenantA(), fn () => DB::table('collab_approval_info_requests')->where('request_id', $before->id)->value('id'));
    expect($this->postJson("/api/v1/approvals/APR-2026-0002/info-requests/{$info}/answer", ['answer' => 'Respondo yo']))->toBeApiError(403, 'APR-BR-03');

    withinTenant(tenantA(), fn () => DB::table('collab_approval_requests')->where('id', $before->id)->update(['paused_at' => now()->subHours(3)]));
    actingAsSeed('U03');
    expect(flujoAprItem('APR-2026-0002')['can_answer'])->toBeTrue();

    $this->postJson("/api/v1/approvals/APR-2026-0002/info-requests/{$info}/answer", ['answer' => 'Solo las noches de hotel no usadas.'])->assertOk();

    $after = rowOf('collab_approval_requests', 'APR-2026-0002');
    $question = withinTenant(tenantA(), fn () => DB::table('collab_approval_info_requests')->where('id', $info)->first());
    expect($after->status)->toBe('pendiente')
        ->and($after->paused_at)->toBeNull()
        ->and(abs(strtotime($after->due_at) - strtotime($before->due_at) - 3 * 3600))->toBeLessThan(60)
        ->and($question->answer)->toBe('Solo las noches de hotel no usadas.')
        ->and($question->answered_by)->toBe(seedUser('U03')->id)
        ->and(flujoAprAuditada('APR-2026-0002', 'responder_informacion'))->toBeTrue();
    expect($this->postJson("/api/v1/approvals/APR-2026-0002/info-requests/{$info}/answer", ['answer' => 'De nuevo']))->toBeApiError(409, 'APR-BR-10');
});

it('una solicitud rechazada que no es de CxP ni de comisiones no se reenvía: se pide de nuevo en su origen', function () {
    actingAsSeed('U04');
    expect(flujoAprItem('APR-2026-0004')['can_resubmit'])->toBeFalse()
        ->and($this->postJson('/api/v1/approvals/APR-2026-0004/resubmit', ['note' => 'Adjunté la cotización del proveedor.'], critical()))->toBeApiError(409, 'APR-RESUBMIT-TYPE');
});

it('reenviar una solicitud rechazada crea una nueva ronda y no se reenvía dos veces', function () {
    withinTenant(tenantA(), fn () => DB::table('collab_approval_requests')->where('code', 'APR-2026-0004')->update(['request_type' => 'payable']));
    actingAsSeed('U04');
    expect(flujoAprItem('APR-2026-0004')['can_resubmit'])->toBeTrue();

    $code = $this->postJson('/api/v1/approvals/APR-2026-0004/resubmit', ['note' => 'Adjunté la cotización del proveedor.'], critical())->assertCreated()->json('data.code');

    $original = rowOf('collab_approval_requests', 'APR-2026-0004');
    $round = rowOf('collab_approval_requests', $code);
    expect($round->status)->toBe('pendiente')
        ->and($round->title)->toBe($original->title)
        ->and($round->requester_id)->toBe(seedUser('U04')->id)
        ->and(json_decode($round->origin_snapshot, true))->toMatchArray(['resubmitted_from' => 'APR-2026-0004', 'round' => 2])
        ->and($original->status)->toBe('rechazada')
        ->and(flujoAprAuditada($code, 'reenviar'))->toBeTrue()
        ->and(flujoAprItem('APR-2026-0004')['can_resubmit'])->toBeFalse()
        ->and(flujoAprItem($code)['resubmitted_from'])->toBe('APR-2026-0004');

    expect($this->postJson('/api/v1/approvals/APR-2026-0004/resubmit', ['note' => 'Otra vez lo mismo'], critical()))->toBeApiError(409, 'APR-BR-11');
});

it('solo quien la pidió reenvía y solo lo rechazado', function () {
    withinTenant(tenantA(), fn () => DB::table('collab_approval_requests')->where('code', 'APR-2026-0004')->update(['request_type' => 'payable']));
    actingAsSeed('U03');
    expect($this->postJson('/api/v1/approvals/APR-2026-0004/resubmit', ['note' => 'No es mía pero la reenvío'], critical()))->toBeApiError(403, 'APR-BR-03');
    expect($this->postJson('/api/v1/approvals/APR-2026-0002/resubmit', ['note' => 'Aún está pendiente'], critical()))->toBeApiError(409, 'APR-BR-08');
    $this->postJson('/api/v1/approvals/APR-2026-0004/resubmit', ['note' => ''], critical())->assertStatus(422)->assertJsonValidationErrors('note');
});
