<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function plataformaReglaPropia(): string
{
    return test()->postJson('/api/v1/admin/booking-rules', ['name' => 'Seguro de viaje '.Str::lower(Str::random(6)), 'description' => 'Pide el seguro para viajes de aventura', 'group' => 'Checkout', 'scope' => ['Reservas', 'Sitio web']], critical())->assertSuccessful()->json('data.code');
}

function plataformaPedido(string $rule): array
{
    return test()->postJson("/api/v1/admin/booking-rules/{$rule}/automation-requests", ['expected' => 'Que no se pueda pagar sin adjuntar la póliza del seguro', 'trigger_when' => 'Al reservar un tour de aventura', 'example' => 'Un cliente reserva el Camino Inca y debe subir su póliza antes de pagar'])->assertCreated()->json('data');
}

it('G5-27: la regla personalizada guarda «Aplica en» y se pide automatizar una sola vez', function () {
    actingAsSeed('U01');
    $rule = plataformaReglaPropia();
    $listed = collect($this->getJson('/api/v1/admin/booking-rules')->json('data.rules'))->firstWhere('code', $rule);
    expect($listed['scope'])->toBe(['Reservas', 'Sitio web'])->and($listed['automation'])->toBeNull();

    $request = plataformaPedido($rule);
    expect($request['status'])->toBe('enviado');

    expect($this->postJson("/api/v1/admin/booking-rules/{$rule}/automation-requests", ['expected' => 'Otra vez lo mismo', 'trigger_when' => 'Siempre', 'example' => 'Un ejemplo cualquiera']))->toBeApiError(409, 'CR-05');
    expect($this->postJson('/api/v1/admin/booking-rules/R-DEPOSIT/automation-requests', ['expected' => 'Que haga otra cosa', 'trigger_when' => 'Siempre', 'example' => 'Un ejemplo cualquiera']))->toBeApiError(422, 'CR-05');
    expect(collect($this->getJson('/api/v1/admin/booking-rules')->json('data.rules'))->firstWhere('code', $rule)['automation']['status'])->toBe('enviado')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Regla de reserva', 'entity_id' => $rule, 'action' => 'pedir_automatizacion'])->exists()))->toBeTrue();
});

it('G5-27: valida el formulario del pedido y exige admin.settings.manage', function () {
    actingAsSeed('U01');
    $rule = plataformaReglaPropia();
    $this->postJson("/api/v1/admin/booking-rules/{$rule}/automation-requests", ['expected' => 'corto'])->assertStatus(422)->assertJsonValidationErrors(['expected', 'trigger_when', 'example']);

    actingAsSeed('U03');
    expect($this->postJson("/api/v1/admin/booking-rules/{$rule}/automation-requests", ['expected' => 'x'])->status())->toBe(403);
});

it('G5-27: la consola evalúa, rechaza con motivo o publica enlazando una regla estándar y avisa a la agencia', function () {
    actingAsSeed('U01');
    $rule = plataformaReglaPropia();
    $code = plataformaPedido($rule)['code'];

    actingAsPlatform();
    $inbox = $this->getJson('/api/v1/platform/rule-requests')->assertOk()->json('data');
    expect(collect($inbox['items'])->pluck('code'))->toContain($code)
        ->and(collect($inbox['standard_rules'])->pluck('code'))->toContain('R-GIFT-CARDS');

    $this->postJson("/api/v1/platform/rule-requests/{$code}/decision", ['decision' => 'evaluar'])->assertOk()->assertJsonPath('data.status', 'en_evaluacion');
    expect($this->postJson("/api/v1/platform/rule-requests/{$code}/decision", ['decision' => 'rechazar']))->toBeApiError(422);
    expect($this->postJson("/api/v1/platform/rule-requests/{$code}/decision", ['decision' => 'publicar', 'linked_rule' => 'R-NO-EXISTE']))->toBeApiError(422);
    $this->postJson("/api/v1/platform/rule-requests/{$code}/decision", ['decision' => 'publicar', 'linked_rule' => 'R-COMPANIONS'])->assertOk()->assertJsonPath('data.linked_rule', 'R-COMPANIONS');
    expect($this->postJson("/api/v1/platform/rule-requests/{$code}/decision", ['decision' => 'rechazar', 'reason' => 'Tarde']))->toBeApiError(409);

    expect(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Pedido de regla', 'entity_id' => $code, 'action' => 'publicado'])->exists())->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'regla.automatizacion')->where('subject', 'like', '%efecto automático%')->exists()))->toBeTrue();

    actingAsSeed('U01');
    expect(collect($this->getJson('/api/v1/admin/booking-rules')->json('data.rules'))->firstWhere('code', $rule)['automation'])->toMatchArray(['status' => 'publicado', 'linked_rule' => 'R-COMPANIONS']);
});

it('G5-27: el rechazo guarda el motivo para la agencia', function () {
    actingAsSeed('U01');
    $code = plataformaPedido(plataformaReglaPropia())['code'];

    actingAsPlatform();
    $this->postJson("/api/v1/platform/rule-requests/{$code}/decision", ['decision' => 'rechazar', 'reason' => 'Ya lo cubre la regla de documentos nominativos'])->assertOk()->assertJsonPath('data.status', 'rechazado')->assertJsonPath('data.reason', 'Ya lo cubre la regla de documentos nominativos');
});
