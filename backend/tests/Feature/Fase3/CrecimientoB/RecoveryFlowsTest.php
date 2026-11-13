<?php

use Illuminate\Support\Facades\DB;

if (! function_exists('crecbAudited')) {
    function crecbAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function crecbEmailTemplate(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('mkt_templates')->where('channel', 'email')->orderBy('code')->value('code'));
}

it('crea, edita y activa un flujo de recuperación por correo', function () {
    actingAsSeed('U02');
    $template = crecbEmailTemplate();

    $code = $this->postJson('/api/v1/marketing/recovery-flows', ['name' => 'Carrito abandonado 2 h', 'trigger_kind' => 'cart', 'delay_minutes' => 120, 'channel' => 'email', 'template_ref' => $template])
        ->assertCreated()
        ->assertJsonPath('data.active', false)
        ->json('data.code');

    expect($code)->toStartWith('REC-');

    $this->patchJson("/api/v1/marketing/recovery-flows/{$code}", ['delay_minutes' => 180, 'max_attempts' => 3])->assertOk()->assertJsonPath('data.max_attempts', 3);
    $this->patchJson("/api/v1/marketing/recovery-flows/{$code}", ['active' => true])->assertOk()->assertJsonPath('data.active', true);

    $this->getJson('/api/v1/marketing/recovery-flows')->assertOk()->assertJsonPath('data.flows', fn (array $flows) => collect($flows)->firstWhere('code', $code)['active'] === true);

    expect(crecbAudited(['entity' => 'Flujo de recuperación', 'entity_id' => $code, 'action' => 'activar']))->toBeTrue()
        ->and(crecbAudited(['entity' => 'Flujo de recuperación', 'entity_id' => $code, 'action' => 'editar']))->toBeTrue();
});

it('SC-05: un flujo por WhatsApp solo se activa con una plantilla aprobada', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/inbox/whatsapp-templates', ['name' => 'recupera_pest', 'lang' => 'es', 'category' => 'marketing', 'purpose' => 'recuperacion', 'body' => 'Hola {{nombre}}, tu carrito te espera. Responde BAJA para no recibir más.'])->assertCreated();

    $payload = ['name' => 'Carrito por WhatsApp', 'trigger_kind' => 'cart', 'delay_minutes' => 60, 'channel' => 'whatsapp', 'template_ref' => 'recupera_pest'];

    expect($this->postJson('/api/v1/marketing/recovery-flows', [...$payload, 'active' => true]))->toBeApiError(422, 'SC-05');
    $this->postJson('/api/v1/marketing/recovery-flows', $payload)->assertCreated();
    $this->postJson('/api/v1/marketing/recovery-flows', [...$payload, 'template_ref' => 'no_existe'])->assertStatus(422);
});

it('lista los intentos con su origen, el destino enmascarado y el filtro por estado', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/marketing/recovery-flows', ['name' => 'Cotización sin respuesta', 'trigger_kind' => 'quote', 'delay_minutes' => 1440, 'channel' => 'email', 'template_ref' => crecbEmailTemplate()])->json('data.code');
    $quote = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->orderBy('code')->first(['id', 'code', 'client_id']));
    withinTenant(tenantA(), fn () => DB::table('mkt_recovery_attempts')->insert([
        'flow_id' => DB::table('mkt_recovery_flows')->where('code', $code)->value('id'),
        'quote_id' => $quote->id,
        'client_id' => $quote->client_id,
        'to_address' => 'cliente.prueba@example.com',
        'attempt_no' => 1,
        'scheduled_at' => now(),
        'sent_at' => now(),
        'status' => 'enviado',
    ]));

    $response = $this->getJson("/api/v1/marketing/recovery-attempts?filter[status]=enviado&filter[flow]={$code}")->assertOk()->assertJsonCount(1, 'data');

    expect($response->json('data.0.origin.code'))->toBe($quote->code)
        ->and($response->json('data.0.to'))->not->toContain('cliente.prueba')
        ->and($response->json('meta.counts.enviado'))->toBeGreaterThanOrEqual(1);

    $this->getJson("/api/v1/marketing/recovery-attempts?filter[status]=recuperado&filter[flow]={$code}")->assertOk()->assertJsonCount(0, 'data');
    $this->patchJson('/api/v1/marketing/recovery-flows/REC-99', ['active' => true])->assertNotFound();
});
