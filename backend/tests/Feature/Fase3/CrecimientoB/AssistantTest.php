<?php

use App\Domain\Growth\Assistant\PromptSanitizer;
use Illuminate\Support\Facades\DB;

if (! function_exists('crecbAudited')) {
    function crecbAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function crecbDraftQuote(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->where('status', 'borrador')->orderBy('code')->value('code'));
}

it('ai/requests crea el pedido, lo resuelve con el adaptador simulado y responde 202', function () {
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/ai/requests', ['kind' => 'itinerary', 'prompt' => 'Itinerario de 4 días a Cusco para 2 personas'], critical())
        ->assertStatus(202)
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.kind', 'itinerary');

    expect($response->json('data.output.days'))->toHaveCount(4)
        ->and($response->json('data.provider'))->toBe('fake');

    $this->getJson('/api/v1/ai/requests/'.$response->json('data.id'))->assertOk()->assertJsonPath('data.id', $response->json('data.id'));
});

it('SC-04: el filtro de PII elimina DNI, tarjeta y contraseña antes de guardar el pedido', function () {
    actingAsSeed('U03');

    $id = $this->postJson('/api/v1/ai/requests', ['kind' => 'summary', 'prompt' => 'Cliente con DNI 45879632, tarjeta 4111 1111 1111 1111 y contraseña: secreta123 quiere viajar'], critical())
        ->assertStatus(202)->json('data.id');
    $prompt = (string) withinTenant(tenantA(), fn () => DB::table('sys_ai_requests')->where('id', $id)->value('prompt'));

    expect($prompt)->not->toContain('45879632')
        ->and($prompt)->not->toContain('4111')
        ->and($prompt)->not->toContain('secreta123')
        ->and((new PromptSanitizer)->changed('Sin datos sensibles'))->toBeFalse();
});

it('SC-03: aplicar un borrador sobre una cotización en borrador anota la versión vigente sin cambiar su estado', function () {
    actingAsSeed('U01');
    $code = crecbDraftQuote();
    expect($code)->not->toBe('');
    $before = rowOf('quote_quotes', $code);

    $id = $this->postJson('/api/v1/ai/requests', ['kind' => 'quote_draft', 'prompt' => 'Propuesta de 3 días en Cusco para 2 adultos', 'source_type' => 'quote', 'source_code' => $code], critical())
        ->assertStatus(202)->json('data.id');

    $this->postJson("/api/v1/ai/requests/{$id}/apply", [], critical())
        ->assertOk()
        ->assertJsonPath('data.status', 'applied')
        ->assertJsonPath('data.applied.quote', $code);

    $after = rowOf('quote_quotes', $code);
    $notes = (string) withinTenant(tenantA(), fn () => DB::table('quote_versions')->where('id', $after->current_version_id)->value('notes'));

    expect($after->status)->toBe($before->status)
        ->and($notes)->toContain('Borrador del asistente')
        ->and(crecbAudited(['entity' => 'Pedido IA', 'entity_id' => $id, 'action' => 'aplicar']))->toBeTrue();

    $this->postJson("/api/v1/ai/requests/{$id}/apply", [], critical())->assertStatus(409);
});

it('descartar un borrador lo deja descartado y queda auditado', function () {
    actingAsSeed('U03');
    $id = $this->postJson('/api/v1/ai/requests', ['kind' => 'reply_draft', 'prompt' => 'Responder consulta de 5 días a Arequipa'], critical())->json('data.id');

    $this->postJson("/api/v1/ai/requests/{$id}/discard")->assertOk()->assertJsonPath('data.status', 'discarded');
    $this->postJson("/api/v1/ai/requests/{$id}/discard")->assertStatus(409);

    expect(crecbAudited(['entity' => 'Pedido IA', 'entity_id' => $id, 'action' => 'descartar']))->toBeTrue();
});

it('un pedido de otro asesor no se ve: 404', function () {
    actingAsSeed('U03');
    $id = $this->postJson('/api/v1/ai/requests', ['kind' => 'summary', 'prompt' => 'Resumen de una consulta larga del cliente'], critical())->json('data.id');

    actingAsSeed('U05');
    $this->getJson("/api/v1/ai/requests/{$id}")->assertNotFound();
});

it('SC-02: con el cupo del mes agotado responde 429 AI_QUOTA_EXCEEDED', function () {
    actingAsSeed('U01');
    $limit = (int) $this->getJson('/api/v1/ai/usage')->assertOk()->json('data.limit');
    withinTenant(tenantA(), fn () => DB::table('sys_ai_requests')->insert(array_map(fn (int $i) => ['kind' => 'summary', 'prompt' => "Relleno {$i}", 'status' => 'completed'], range(1, $limit))));

    expect($this->postJson('/api/v1/ai/requests', ['kind' => 'summary', 'prompt' => 'Un pedido más este mes'], critical()))
        ->toBeApiError(429, 'AI_QUOTA_EXCEEDED');

    $this->getJson('/api/v1/ai/usage')->assertOk()->assertJsonPath('data.warning', true)->assertJsonPath('data.remaining', 0);
});

it('Finanzas no usa el asistente: 403 con el permiso requerido', function () {
    actingAsSeed('U07');

    $response = $this->postJson('/api/v1/ai/requests', ['kind' => 'summary', 'prompt' => 'Resumen de prueba de permisos'], critical());

    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('ai.assistant.use');
});
